import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedUser,
  isMongoConfigured,
  getBookmarksCollection,
  getCreatorFollowsCollection,
  getProjectCommentsCollection,
  getProjectsCollection,
  getProjectVotesCollection,
  getUsersCollection,
} = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  isMongoConfigured: vi.fn(),
  getBookmarksCollection: vi.fn(),
  getCreatorFollowsCollection: vi.fn(),
  getProjectCommentsCollection: vi.fn(),
  getProjectsCollection: vi.fn(),
  getProjectVotesCollection: vi.fn(),
  getUsersCollection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser }));
vi.mock("@/lib/mongodb/client", () => ({ isMongoConfigured }));
vi.mock("@/lib/mongodb/collections", () => ({
  getBookmarksCollection,
  getCreatorFollowsCollection,
  getProjectCommentsCollection,
  getProjectsCollection,
  getProjectVotesCollection,
  getUsersCollection,
}));

import { GET, POST } from "@/app/api/social/route";

const user = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "member@example.test",
  username: "member_name",
  displayName: "Member",
  user_metadata: { user_name: "member_name", full_name: "Member" },
};
const projectId = "11111111-1111-4111-8111-111111111111";
const url = "http://localhost/api/social";

function request(body: unknown, origin = "http://localhost") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("POST /api/social", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMongoConfigured.mockReturnValue(true);
    getAuthenticatedUser.mockResolvedValue(user);
  });

  it("rejects unauthenticated actions", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const response = await POST(request({ action: "vote", projectId, value: 1 }));
    expect(response.status).toBe(401);
  });

  it("rejects cross-origin and malformed actions before writing", async () => {
    const crossOrigin = await POST(request({ action: "vote", projectId, value: 1 }, "https://attacker.example"));
    expect(crossOrigin.status).toBe(403);
    const invalid = await POST(request({ action: "vote", projectId: "not-a-uuid", value: 1 }));
    expect(invalid.status).toBe(400);
    expect(getProjectVotesCollection).not.toHaveBeenCalled();
  });

  it("upserts a vote for the authenticated account only", async () => {
    const mockVotes = {
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    };
    getProjectVotesCollection.mockResolvedValue(mockVotes);

    const response = await POST(request({ action: "vote", projectId, value: -1 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ action: "vote", value: -1 });
    expect(mockVotes.updateOne).toHaveBeenCalledWith(
      { userId: user.id, projectId },
      expect.objectContaining({
        $set: expect.objectContaining({ userId: user.id, projectId, value: -1 }),
      }),
      { upsert: true }
    );
  });

  it("removes a prior vote by both authenticated user and project key", async () => {
    const mockVotes = {
      deleteOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    };
    getProjectVotesCollection.mockResolvedValue(mockVotes);

    const response = await POST(request({ action: "vote", projectId, value: null }));
    expect(response.status).toBe(200);
    expect(mockVotes.deleteOne).toHaveBeenCalledWith({ userId: user.id, projectId });
  });

  it("saves and removes bookmarks with the signed-in account id", async () => {
    const mockBookmarks = {
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
      deleteOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    };
    getBookmarksCollection.mockResolvedValue(mockBookmarks);

    const added = await POST(request({ action: "bookmark", projectId, saved: true }));
    expect(added.status).toBe(200);
    expect(mockBookmarks.updateOne).toHaveBeenCalledWith(
      { userId: user.id, projectId },
      expect.objectContaining({
        $set: expect.objectContaining({ userId: user.id, projectId }),
      }),
      { upsert: true }
    );

    const removed = await POST(request({ action: "bookmark", projectId, saved: false }));
    expect(removed.status).toBe(200);
    expect(mockBookmarks.deleteOne).toHaveBeenCalledWith({ userId: user.id, projectId });
  });

  it("creates a follow using the resolved profile id and ignore-duplicates semantics", async () => {
    const creatorId = "33333333-3333-4333-8333-333333333333";
    const mockUsers = {
      findOne: vi.fn().mockResolvedValue({ id: creatorId, username: "creator_name" }),
    };
    const mockFollows = {
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    };
    getUsersCollection.mockResolvedValue(mockUsers);
    getCreatorFollowsCollection.mockResolvedValue(mockFollows);

    const response = await POST(request({ action: "follow", creatorUsername: "creator_name", following: true }));
    expect(response.status).toBe(200);
    expect(mockFollows.updateOne).toHaveBeenCalledWith(
      { followerId: user.id, followedId: creatorId },
      expect.objectContaining({
        $set: expect.objectContaining({ followerId: user.id, followedId: creatorId }),
      }),
      { upsert: true }
    );
  });

  it("writes the comment body and author from the authenticated session", async () => {
    const mockProjects = {
      findOne: vi.fn().mockResolvedValue({ id: projectId, visibility: "public", status: "published" }),
    };
    const mockComments = {
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    };
    getProjectsCollection.mockResolvedValue(mockProjects);
    getProjectCommentsCollection.mockResolvedValue(mockComments);

    const response = await POST(request({ action: "comment", projectId, body: "  Useful note  " }));
    expect(response.status).toBe(201);
    expect(mockComments.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        authorId: user.id,
        body: "Useful note",
      })
    );
  });

  it("refuses to follow the current account", async () => {
    const mockUsers = {
      findOne: vi.fn().mockResolvedValue({ id: user.id, username: "member_name" }),
    };
    getUsersCollection.mockResolvedValue(mockUsers);

    const response = await POST(request({ action: "follow", creatorUsername: "member_name", following: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "You cannot follow your own account." });
  });
});

describe("GET /api/social follow status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMongoConfigured.mockReturnValue(true);
    getAuthenticatedUser.mockResolvedValue(user);
  });

  it("returns only whether the authenticated user follows the resolved creator", async () => {
    const creatorId = "33333333-3333-4333-8333-333333333333";
    const mockUsers = {
      findOne: vi.fn().mockResolvedValue({ id: creatorId, username: "creator_name" }),
    };
    const mockFollows = {
      findOne: vi.fn().mockResolvedValue({ followerId: user.id, followedId: creatorId }),
    };
    getUsersCollection.mockResolvedValue(mockUsers);
    getCreatorFollowsCollection.mockResolvedValue(mockFollows);

    const response = await GET(new Request(`${url}?creator=creator_name`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ following: true });
    expect(mockUsers.findOne).toHaveBeenCalledWith({ usernameNormalized: "creator_name" });
    expect(mockFollows.findOne).toHaveBeenCalledWith({ followerId: user.id, followedId: creatorId });
  });
});
