import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient } = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
import { GET, POST } from "@/app/api/social/route";

const user = { id: "22222222-2222-4222-8222-222222222222", email: "member@example.test" };
const projectId = "11111111-1111-4111-8111-111111111111";
const url = "http://localhost/api/social";

function request(body: unknown, origin = "http://localhost") {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
}
function query(result: { data?: unknown; error?: { code?: string } | null } = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "insert", "upsert", "update", "delete", "eq", "in", "order", "limit", "maybeSingle", "single"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}
function authenticatedClient(from: ReturnType<typeof vi.fn>) {
  createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, from });
}

describe("POST /api/social", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated actions", async () => {
    createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });
    const response = await POST(request({ action: "vote", projectId, value: 1 }));
    expect(response.status).toBe(401);
  });

  it("rejects cross-origin and malformed actions before writing", async () => {
    const crossOrigin = await POST(request({ action: "vote", projectId, value: 1 }, "https://attacker.example"));
    expect(crossOrigin.status).toBe(403);
    const invalid = await POST(request({ action: "vote", projectId: "not-a-uuid", value: 1 }));
    expect(invalid.status).toBe(400);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("upserts a vote for the authenticated account only", async () => {
    const voteQuery = query();
    const from = vi.fn(() => voteQuery);
    authenticatedClient(from);
    const response = await POST(request({ action: "vote", projectId, value: -1 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ action: "vote", value: -1 });
    expect(from).toHaveBeenCalledWith("project_votes");
    expect(voteQuery.upsert).toHaveBeenCalledWith({ user_id: user.id, project_id: projectId, value: -1 }, { onConflict: "user_id,project_id" });
  });

  it("removes a prior vote by both authenticated user and project key", async () => {
    const voteQuery = query();
    const from = vi.fn(() => voteQuery);
    authenticatedClient(from);
    const response = await POST(request({ action: "vote", projectId, value: null }));
    expect(response.status).toBe(200);
    expect(voteQuery.delete).toHaveBeenCalledOnce();
    expect(voteQuery.eq).toHaveBeenNthCalledWith(1, "user_id", user.id);
    expect(voteQuery.eq).toHaveBeenNthCalledWith(2, "project_id", projectId);
  });

  it("saves and removes bookmarks with the signed-in account id", async () => {
    const bookmarkQuery = query();
    const from = vi.fn(() => bookmarkQuery);
    authenticatedClient(from);
    const added = await POST(request({ action: "bookmark", projectId, saved: true }));
    expect(added.status).toBe(200);
    expect(bookmarkQuery.upsert).toHaveBeenCalledWith({ user_id: user.id, project_id: projectId }, { onConflict: "user_id,project_id", ignoreDuplicates: true });
    const removed = await POST(request({ action: "bookmark", projectId, saved: false }));
    expect(removed.status).toBe(200);
    expect(bookmarkQuery.delete).toHaveBeenCalledOnce();
  });

  it("creates a follow using the resolved profile id and ignore-duplicates semantics", async () => {
    const creatorQuery = query({ data: { id: "33333333-3333-4333-8333-333333333333" }, error: null });
    const followsQuery = query();
    const from = vi.fn((table: string) => table === "profiles" ? creatorQuery : followsQuery);
    authenticatedClient(from);
    const response = await POST(request({ action: "follow", creatorUsername: "creator_name", following: true }));
    expect(response.status).toBe(200);
    expect(followsQuery.upsert).toHaveBeenCalledWith({ follower_id: user.id, followed_id: "33333333-3333-4333-8333-333333333333" }, { onConflict: "follower_id,followed_id", ignoreDuplicates: true });
  });

  it("writes the comment body and author from the authenticated session", async () => {
    const commentQuery = query({ data: { id: "comment-1", body: "Useful note", created_at: "2026-10-28T10:00:00.000Z" }, error: null });
    const from = vi.fn(() => commentQuery);
    authenticatedClient(from);
    const response = await POST(request({ action: "comment", projectId, body: "  Useful note  " }));
    expect(response.status).toBe(201);
    expect(commentQuery.insert).toHaveBeenCalledWith({ project_id: projectId, author_id: user.id, body: "Useful note" });
  });

  it("refuses to follow the current account", async () => {
    const profileQuery = query({ data: { id: user.id }, error: null });
    const from = vi.fn(() => profileQuery);
    authenticatedClient(from);
    const response = await POST(request({ action: "follow", creatorUsername: "member_name", following: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "You cannot follow your own account." });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("profiles");
  });
});

describe("GET /api/social follow status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only whether the authenticated user follows the resolved creator", async () => {
    const creatorQuery = query({ data: { id: "33333333-3333-4333-8333-333333333333" }, error: null });
    const followsQuery = query({ data: { follower_id: user.id }, error: null });
    const from = vi.fn((table: string) => table === "profiles" ? creatorQuery : followsQuery);
    authenticatedClient(from);
    const response = await GET(new Request(`${url}?creator=creator_name`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ following: true });
    expect(from).toHaveBeenNthCalledWith(1, "profiles");
    expect(from).toHaveBeenNthCalledWith(2, "creator_follows");
  });
});
