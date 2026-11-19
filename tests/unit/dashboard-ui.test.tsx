// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LiveProject } from "@/lib/live-feed";
import { projects as demoProjects } from "@/lib/demo-data";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  user: null as null | { id: string; email: string; username: string; displayName: string },
  toggleBookmark: vi.fn(),
}));

vi.mock("next/link", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");
  return { default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => ReactModule.createElement("a", { href, ...props }, children) };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => mocks.router }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: mocks.user, loading: false, configured: true, refresh: vi.fn() }) }));
vi.mock("@/components/theme-provider", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }));
vi.mock("@/components/community-provider", () => ({ useCommunity: () => ({ projects: [], bookmarked: [], toggleBookmark: mocks.toggleBookmark }) }));
vi.mock("@/components/tactile-haptics", () => ({ tactile: { tap: vi.fn() } }));
vi.mock("@/components/code-bloom-logo", () => ({ CodeBloomLogo: () => <span>CodeBloom</span> }));
vi.mock("@/components/project-artwork", () => ({ ProjectArtwork: ({ project }: { project: { name: string } }) => <div role="img" aria-label={`${project.name} artwork`} /> }));
vi.mock("@/components/markdown-renderer", () => ({ MarkdownRenderer: ({ content }: { content: string }) => <p>{content}</p> }));
vi.mock("@/components/use-realtime", () => ({ useRealtime: vi.fn() }));

import { AppShell } from "@/components/app-shell";
import { FeedView } from "@/components/feed-view";
import { ProjectCard } from "@/components/project-card";

const baseProject = demoProjects[0]!;
const liveProject: LiveProject = {
  ...baseProject,
  id: "live-project-1",
  ownerId: "owner-1",
  createdAt: "2026-11-16T12:00:00.000Z",
  score: 4,
  vote: 0,
  bookmarked: false,
  followingCreator: false,
  recentComments: [],
  commentsCount: 0,
  media: [],
  updates: [],
  live: true,
};
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function stubFeed(projects: LiveProject[] = [liveProject]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const mode = new URL(url, "http://localhost").searchParams.get("mode") ?? "For you";
    return jsonResponse({ projects, mode, source: "live" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
});

describe("dashboard feed experience", () => {
  it("loads live projects and requests the selected sort mode", async () => {
    const fetchMock = stubFeed();
    render(<FeedView mode="home" />);

    expect(await screen.findByText(baseProject.name)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/feed?mode=For+you"), expect.objectContaining({ cache: "no-store" }));

    const topTab = screen.getByRole("button", { name: "Top" });
    fireEvent.click(topTab);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toContain("mode=Top");
    expect(topTab).toHaveAttribute("aria-pressed", "true");
  });

  it("offers a working retry when the live feed request fails", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("The feed is temporarily unavailable."))
      .mockResolvedValueOnce(jsonResponse({ projects: [liveProject], mode: "For you", source: "live" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<FeedView mode="home" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(baseProject.name)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives the saved-project filter a relevant empty state and next action", async () => {
    stubFeed([]);
    render(<FeedView mode="home" />);
    await screen.findByText("No live projects yet");
    fireEvent.click(screen.getByRole("button", { name: "Bookmarks" }));

    expect(await screen.findByRole("heading", { name: "No saved projects yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse projects" })).toHaveAttribute("href", "/explore");
  });
});

describe("dashboard navigation and project-card actions", () => {
  it("focuses the global search when Command/Ctrl+K is pressed", () => {
    stubFeed([]);
    render(<AppShell><div>Dashboard content</div></AppShell>);
    const input = screen.getByRole("textbox", { name: "Search projects, people, and topics" });

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K");
    input.blur();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "accessible projects" } });
    const form = input.closest("form");
    if (!form) throw new Error("Global search form was not rendered");
    fireEvent.submit(form);
    expect(mocks.router.push).toHaveBeenCalledWith("/explore?q=accessible%20projects");
  });

  it("renders live project and topic aggregates instead of preview data", async () => {
    const liveHighlights = {
      projects: [{ slug: "live-meadow", name: "Live Meadow", tag: "typescript", voteCount: 12, commentCount: 3, score: 10, createdAt: "2026-11-16T12:00:00.000Z" }],
      topics: [{ slug: "react native", name: "React native", projectCount: 4 }],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/community-highlights") return jsonResponse(liveHighlights);
      if (String(input) === "/api/notifications") return jsonResponse({ unreadCount: 0 });
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AppShell><div>Dashboard content</div></AppShell>);

    expect(await screen.findByText("Live Meadow")).toBeInTheDocument();
    expect(screen.getByText("12 votes · 3 comments")).toBeInTheDocument();
    expect(screen.getByText("COMMUNITY SHOWCASE · LIVE")).toBeInTheDocument();
    expect(screen.queryByText("PROJECT SHOWCASE · PREVIEW")).not.toBeInTheDocument();
    const topicLinks = await screen.findAllByRole("link", { name: /React native/i });
    expect(topicLinks.some((link) => link.getAttribute("href") === "/explore?q=react%20native")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/community-highlights", expect.objectContaining({ cache: "no-store" }));
  });

  it("shows a truthful unavailable state instead of substituting sample community data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    render(<AppShell><div>Dashboard content</div></AppShell>);

    expect(await screen.findByText("Live project highlights are temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getAllByText("Live topics are temporarily unavailable.")).toHaveLength(2);
    expect(screen.queryByText("PROJECT SHOWCASE · PREVIEW")).not.toBeInTheDocument();
  });

  it("copies a shareable project URL from the card action", async () => {
    stubFeed([]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ProjectCard project={baseProject} />);

    fireEvent.click(screen.getByRole("button", { name: `Copy link for ${baseProject.name}` }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/projects/${baseProject.slug}`));
    expect(await screen.findByText("Project link copied to clipboard.")).toBeInTheDocument();
  });

  it("persists each signed-in project action through the live social API", async () => {
    mocks.user = { id: "viewer-1", email: "viewer@example.test", username: "viewer", displayName: "Viewer" };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { action: string; body?: string };
      const result = payload.action === "comment"
        ? { comment: { id: "comment-1", body: payload.body, created_at: "2026-11-16T12:00:00.000Z" } }
        : { action: payload.action };
      return jsonResponse(result);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ProjectCard project={baseProject} liveProject={liveProject} />);

    const upvote = screen.getByRole("button", { name: `Upvote ${baseProject.name}` });
    fireEvent.click(upvote);
    await waitFor(() => expect(upvote).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(screen.getByRole("button", { name: `Bookmark ${baseProject.name}` }));
    await screen.findByRole("button", { name: `Remove ${baseProject.name} from bookmarks` });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await screen.findByRole("button", { name: "Following" });

    fireEvent.click(screen.getByRole("button", { name: `Comments on ${baseProject.name} (0)` }));
    const commentBox = screen.getByRole("textbox", { name: `Add a comment to ${baseProject.name}` });
    fireEvent.change(commentBox, { target: { value: "A thoughtful question" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByText("A thoughtful question")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).action)).toEqual(["vote", "bookmark", "follow", "comment"]);
  });

  it("routes anonymous visitors to sign in instead of letting them submit a comment", async () => {
    stubFeed([]);
    render(<ProjectCard project={baseProject} liveProject={liveProject} />);
    fireEvent.click(screen.getByRole("button", { name: `Comments on ${baseProject.name} (0)` }));
    const commentBox = screen.getByRole("textbox", { name: `Add a comment to ${baseProject.name}` });
    fireEvent.change(commentBox, { target: { value: "A thoughtful question" } });
    const form = commentBox.closest("form");
    if (!form) throw new Error("Project comment form was not rendered");
    fireEvent.submit(form);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to comment on this project." })).toBeInTheDocument();
  });
});
