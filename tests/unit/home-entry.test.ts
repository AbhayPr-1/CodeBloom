import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUser, redirect } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  redirect: vi.fn((destination: string) => { throw new Error(`redirect:${destination}`); }),
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser }));
vi.mock("@/components/landing-page", () => ({ LandingPage: vi.fn(() => null) }));
vi.mock("next/navigation", () => ({ redirect }));

import HomePage from "@/app/page";
import { LandingPage } from "@/components/landing-page";

describe("public root entry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the landing page for all visitors", () => {
    const result = HomePage();
    expect(result.type).toBe(LandingPage);
  });
});
