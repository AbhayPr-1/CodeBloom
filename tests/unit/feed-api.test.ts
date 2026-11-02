import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient, getSupabaseConfig } = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn(), getSupabaseConfig: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig }));
import { GET } from "@/app/api/feed/route";

const viewer = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const project = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "22222222-2222-4222-8222-222222222222",
  slug: "live-garden-12345678",
  name: "Live Garden",
  tagline: "A thoughtful live project for developers.",
  description: "This project description is long enough for the live feed endpoint.",
  repository_url: "https://github.com/example/live-garden",
  demo_url: null,
  status: "published",
  created_at: "2026-10-28T12:00:00.000Z",
  profiles: { username: "garden_dev", display_name: "Garden Developer" },
  project_tags: [{ tag: "typescript" }],
};
function query(result: { data?: unknown; error?: { code?: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit", "maybeSingle"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe("GET /api/feed", () => {
  beforeEach(() => { vi.clearAllMocks(); getSupabaseConfig.mockReturnValue({ url: "configured" }); });

  it("requires a signed-in account", async () => {
    createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });
    const response = await GET(new Request("http://localhost/api/feed"));
    expect(response.status).toBe(401);
  });

  it("returns live public projects with aggregate counts and the viewer's state", async () => {
    const tables: Record<string, unknown> = {
      projects: query({ data: [project], error: null }),
      project_vote_totals: query({ data: [{ project_id: project.id, score: 7, upvotes: 8, downvotes: 1 }], error: null }),
      project_votes: query({ data: [{ project_id: project.id, value: 1 }], error: null }),
      project_comment_totals: query({ data: [{ project_id: project.id, comment_count: 4 }], error: null }),
      project_comments: query({ data: [], error: null }),
      bookmarks: query({ data: [{ project_id: project.id }], error: null }),
      creator_follows: query({ data: [{ followed_id: project.owner_id }], error: null }),
    };
    const from = vi.fn((table: string) => tables[table]);
    createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: viewer }, error: null }) }, from });
    const response = await GET(new Request("http://localhost/api/feed?mode=Top"));
    const body = await response.json() as { mode: string; source: string; projects: Array<Record<string, unknown>> };
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({ mode: "Top", source: "live" });
    expect(body.projects[0]).toMatchObject({ slug: project.slug, score: 7, vote: 1, commentsCount: 4, bookmarked: true, followingCreator: true, live: true });
    expect(from).toHaveBeenCalledWith("projects");
    expect(from).not.toHaveBeenCalledWith("profiles");
  });

  it("supports the saved-projects workspace mode with owner-scoped bookmark queries", async () => {
    const tables: Record<string, unknown> = {
      bookmarks: query({ data: [{ project_id: project.id }], error: null }),
      projects: query({ data: [project], error: null }),
      project_vote_totals: query({ data: [], error: null }),
      project_votes: query({ data: [], error: null }),
      project_comment_totals: query({ data: [], error: null }),
      project_comments: query({ data: [], error: null }),
      creator_follows: query({ data: [], error: null }),
    };
    const from = vi.fn((table: string) => tables[table]);
    createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: viewer }, error: null }) }, from });
    const response = await GET(new Request("http://localhost/api/feed?mode=Bookmarks"));
    const body = await response.json() as { mode: string; projects: Array<{ slug: string }> };
    expect(response.status).toBe(200);
    expect(body.mode).toBe("Bookmarks");
    expect(body.projects[0]?.slug).toBe(project.slug);
    expect(from).toHaveBeenCalledWith("bookmarks");
  });
});
