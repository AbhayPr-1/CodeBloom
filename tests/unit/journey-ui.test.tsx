// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  refreshAuth: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  sound: { playClick: vi.fn(), playSuccess: vi.fn(), playStoryTransition: vi.fn(), toggle: vi.fn(() => true) },
}));

vi.mock("next/link", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");
  return { default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => ReactModule.createElement("a", { href, ...props }, children) };
});
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ configured: true, refresh: mocks.refreshAuth }) }));
vi.mock("@/components/theme-provider", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("@/components/landing-sound", () => ({ sound: mocks.sound }));
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: () => ({ auth: {
  signUp: mocks.signUp,
  signInWithPassword: mocks.signInWithPassword,
  resetPasswordForEmail: mocks.resetPasswordForEmail,
  updateUser: mocks.updateUser,
} }) }));
vi.mock("@/components/project-card", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");
  return { ProjectArtwork: ({ project }: { project: { name: string } }) => ReactModule.createElement("div", { role: "img", "aria-label": `${project.name} artwork` }) };
});

import { AuthPage } from "@/components/auth-page";
import { DashboardWelcome } from "@/components/dashboard-welcome";
import { LandingPage } from "@/components/landing-page";
import { LandingScrollStory } from "@/components/landing-scroll-story";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.refreshAuth.mockResolvedValue(undefined);
});

function fillSignupForm(password: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText("Email address", {exact: true}), { target: { value: "builder@example.test" } });
  fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), { target: { value: password } });
  fireEvent.change(screen.getByPlaceholderText("Re-enter your password"), { target: { value: confirmation } });
  const form = screen.getByRole("button", { name: /create account/i }).closest("form");
  if (!form) throw new Error("Signup form not found");
  fireEvent.submit(form);
}

describe("entry and first-run journey", () => {
  it("opens directly on the CodeBloom landing page without a blocking intro", () => {
    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: /Every great project starts with an idea/ })).toBeInTheDocument();
    expect(document.querySelector(".brand-intro")).not.toBeInTheDocument();
    expect(document.querySelector(".hw-root")).not.toHaveAttribute("inert");
    expect(document.querySelector(".hw-root")).not.toHaveAttribute("aria-hidden");
  });

  it("offers a direct account path and a clearly labelled guest exploration path", () => {
    render(<LandingPage />);
    expect(screen.getAllByRole("link", { name: /create (your )?account/i }).every((link) => link.getAttribute("href") === "/signup")).toBe(true);
    expect(screen.getByRole("link", { name: "Explore as a guest" }).getAttribute("href")).toBe("/explore");
    expect(screen.getAllByRole("link", { name: "Sign in" }).every((link) => link.getAttribute("href") === "/login")).toBe(true);
  });

  it("offers topic trails and clearly labels the landing showcase as preview content", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { name: "Follow your curiosity." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tools that smooth the work/ })).toHaveAttribute("href", "/explore?q=Developer%20tools");
    expect(screen.getByText("Illustrative sample content, not live community totals.")).toBeInTheDocument();
    expect(screen.getByText("Are the projects and activity on this page live?")).toBeInTheDocument();
    expect(screen.getByText("Local preview only — nothing you enter here is sent or saved.")).toBeInTheDocument();
    expect(screen.queryByText("developers registered")).not.toBeInTheDocument();
  });

  it("keeps all three scroll-story chapters readable and linked to real destinations", () => {
    render(<LandingPage />);
    const story = screen.getByRole("region", { name: "From first spark to shared momentum." });
    expect(within(story).getByRole("heading", { name: "Find the spark." })).toBeInTheDocument();
    expect(within(story).getByRole("heading", { name: "See the work in progress." })).toBeInTheDocument();
    expect(within(story).getByRole("heading", { name: "Help it grow." })).toBeInTheDocument();
    expect(within(story).getByRole("link", { name: "Explore the project preview" })).toHaveAttribute("href", "/explore");
    expect(within(story).getByRole("link", { name: "See the project stories" })).toHaveAttribute("href", "/explore?q=Developer%20tools");
    expect(within(story).getByRole("link", { name: "Create your account" })).toHaveAttribute("href", "/signup");
    expect(within(story).getByText("ILLUSTRATIVE PREVIEW")).toBeInTheDocument();
    const mobilePreviews = story.querySelectorAll(".scroll-story-mobile-preview");
    expect(mobilePreviews).toHaveLength(3);
    expect(mobilePreviews[0]).toHaveTextContent("Start with a question.");
    expect(mobilePreviews[1]).toHaveTextContent("Look a little closer.");
    expect(mobilePreviews[2]).toHaveTextContent("Make room for the next step.");
  });

  it("changes the illustrative scene when the next story chapter becomes active", () => {
    const observers: Array<{
      callback: IntersectionObserverCallback;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];

    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(public callback: IntersectionObserverCallback) {
        observers.push(this);
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    try {
      render(<LandingScrollStory />);
      const initialScene = document.querySelector(".scroll-story-scene");
      const initialSceneContent = document.querySelector(".scroll-story-window-content");
      const secondChapter = screen.getByRole("heading", { name: "See the work in progress." })
        .closest<HTMLElement>("[data-story-step]");
      if (!initialScene || !initialSceneContent || !secondChapter || !observers[0]) {
        throw new Error("Story scene, content, observer, or chapter step not found");
      }

      act(() => {
        observers[0].callback(
          [{ target: secondChapter, isIntersecting: true, intersectionRatio: 0.8 } as unknown as IntersectionObserverEntry],
          observers[0] as unknown as IntersectionObserver,
        );
      });

      expect(document.querySelector(".scroll-story-scene")).toHaveClass("scene-2");
      expect(document.querySelector(".scroll-story-scene")).toBe(initialScene);
      expect(document.querySelector(".scroll-story-window-content")).not.toBe(initialSceneContent);
      expect(secondChapter).toHaveClass("is-active");
      const scene = document.querySelector<HTMLElement>(".scroll-story-scene");
      if (!scene) throw new Error("Illustrative scene not found");
      expect(within(scene).getByText("A closer look")).toBeInTheDocument();
      expect(within(secondChapter).getByText("Look a little closer.")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("routes landing interactions through one opt-in sound toggle and delegated click feedback", () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Turn landing and story sounds on" }));
    expect(mocks.sound.toggle).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Turn landing and story sounds off" })).toHaveAttribute("aria-pressed", "true");

    mocks.sound.playClick.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "Explore as a guest" }));
    expect(mocks.sound.playClick).toHaveBeenCalledOnce();
  });

  it("adds a short haptic pulse only when the browser exposes the vibration API", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "vibrate");
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });

    try {
      render(<LandingPage />);
      expect(screen.queryByRole("button", { name: /haptic/i })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: "Explore as a guest" }), { detail: 1 });
      expect(vibrate).toHaveBeenCalledWith(8);
    } finally {
      if (original) Object.defineProperty(navigator, "vibrate", original);
      else Reflect.deleteProperty(navigator, "vibrate");
    }
  });

  it("plays distinct story cues once per chapter transition with permanent haptics", async () => {
    const originalVibrate = Object.getOwnPropertyDescriptor(navigator, "vibrate");
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    const observers: Array<{
      callback: IntersectionObserverCallback;
      observedTargets: Element[];
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];

    class MockIntersectionObserver {
      observedTargets: Element[] = [];
      observe = vi.fn((target: Element) => { this.observedTargets.push(target); });
      disconnect = vi.fn();

      constructor(public callback: IntersectionObserverCallback) {
        observers.push(this);
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    try {
      render(<LandingPage />);
      fireEvent.click(screen.getByRole("button", { name: "Turn landing and story sounds on" }));
      const storyObserver = observers.find((observer) => observer.observedTargets.some((target) => target.hasAttribute("data-story-step")));
      const story = screen.getByRole("region", { name: "From first spark to shared momentum." });
      if (!storyObserver) throw new Error("Story intersection observer not found");

      const notifyChapter = (index: number) => {
        const target = story.querySelector<HTMLElement>(`[data-story-step="${index}"]`);
        if (!target) throw new Error(`Story chapter ${index + 1} not found`);
        const entries = [...story.querySelectorAll<HTMLElement>("[data-story-step]")].map((step) => ({
          target: step,
          isIntersecting: step === target,
          intersectionRatio: step === target ? 0.8 : 0,
        } as unknown as IntersectionObserverEntry));
        act(() => storyObserver.callback(
          entries,
          storyObserver as unknown as IntersectionObserver,
        ));
      };

      notifyChapter(2); // Restored scroll position: initialize silently.
      notifyChapter(2); // Repeated observer notification: no duplicate cue.
      expect(mocks.sound.playStoryTransition).not.toHaveBeenCalled();
      expect(vibrate).not.toHaveBeenCalled();

      notifyChapter(1);
      notifyChapter(1);
      notifyChapter(0);
      notifyChapter(2);
      expect(mocks.sound.playStoryTransition.mock.calls).toEqual([[1], [0], [2]]);
      expect(vibrate.mock.calls).toEqual([[[9, 34, 9]], [[12]], [[7, 22, 12, 22, 18]]]);
    } finally {
      if (originalVibrate) Object.defineProperty(navigator, "vibrate", originalVibrate);
      else Reflect.deleteProperty(navigator, "vibrate");
      vi.unstubAllGlobals();
    }
  });

  it("blocks signup before Supabase when the password confirmation differs", async () => {
    render(<AuthPage mode="signup" />);
    fillSignupForm("correct-horse-7", "different-password");
    expect(await screen.findByRole("alert")).toHaveTextContent("Those passwords do not match");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("uses the shared CodeBloom brand lockup and signup theme marker", () => {
    render(<AuthPage mode="signup" />);
    expect(screen.getByRole("main")).toHaveAttribute("data-auth-mode", "signup");
    expect(screen.getByLabelText("CodeBloom home")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("sends a matching signup back to the dashboard welcome journey when a session is returned", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { user: { id: "test-user" } } }, error: null });
    render(<AuthPage mode="signup" next="/dashboard?source=landing" />);
    fillSignupForm("correct-horse-7", "correct-horse-7");
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard?source=landing&welcome=1"));
    expect(mocks.refreshAuth).toHaveBeenCalledOnce();
  });

  it("shows an email-confirmation step when signup requires verification", async () => {
    render(<AuthPage mode="signup" />);
    fillSignupForm("correct-horse-7", "correct-horse-7");
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email to confirm your account");
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("gives new members three useful next steps and explains live account sync", () => {
    render(<DashboardWelcome emailConfirmed />);
    expect(screen.getByRole("heading", { name: "Welcome to your workshop." })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Get started on CodeBloom" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /make it yours/i }).getAttribute("href")).toBe("/settings/profile");
    expect(screen.getByRole("link", { name: /find inspiration/i }).getAttribute("href")).toBe("/explore");
    expect(screen.getByRole("link", { name: /share a build/i }).getAttribute("href")).toBe("/publish");
    expect(screen.getByRole("status")).toHaveTextContent("Email confirmed");
    expect(screen.getByRole("status")).toHaveTextContent("sync to your account");
  });
});
