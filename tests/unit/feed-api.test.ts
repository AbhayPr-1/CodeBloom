import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedUser,
  isMongoConfigured,
  getBookmarksCollection,
  getCreatorFollowsCollection,
  getProjectCommentsCollection,
  getProjectMediaCollection,
  getProjectsCollection,
  getProjectVotesCollection,
  getUsersCollection,
} = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  isMongoConfigured: vi.fn(),
  getBookmarksCollection: vi.fn(),
  getCreatorFollowsCollection: vi.fn(),
  getProjectCommentsCollection: vi.fn(),
  getProjectMediaCollection: vi.fn(),
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
  getProjectMediaCollection,
  getProjectsCollection,
  getProjectVotesCollection,
  getUsersCollection,
}));

import { GET } from "@/app/api/feed/route";

const viewer = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "viewer@example.test",
  username: "viewer",
  displayName: "Viewer",
  user_metadata: { user_name: "viewer", full_name: "Viewer" },
};

const projectDoc = {
  _id: "11111111-1111-4111-8111-111111111111",
  id: "11111111-1111-4111-8111-111111111111",
  ownerId: "22222222-2222-4222-8222-222222222222",
  slug: "live-garden-12345678",
  name: "Live Garden",
  tagline: "A thoughtful live project for developers.",
  description: "This project description is long enough for the live feed endpoint.",
  repositoryUrl: "https://github.com/example/live-garden",
  demoUrl: null,
  status: "published" as const,
  visibility: "public" as const,
  tags: ["typescript"],
  createdAt: "2026-10-28T12:00:00.000Z",
  updatedAt: "2026-10-28T12:00:00.000Z",
};

const ownerDoc = {
  id: projectDoc.ownerId,
  username: "garden_dev",
  displayName: "Garden Developer",
};

function mockCursor<T>(items: T[]) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(items),
  };
}

describe("GET /api/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMongoConfigured.mockReturnValue(true);
    getAuthenticatedUser.mockResolvedValue(viewer);
  });

  it("requires a signed-in account", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/feed"));
    expect(response.status).toBe(401);
  });

  it("returns live public projects with aggregate counts and the viewer's state", async () => {
    const projectsMock = { find: vi.fn(() => mockCursor([projectDoc])) };
    const usersMock = { find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([ownerDoc]) })) };
    const votesMock = {
      find: vi.fn((query: { userId?: string }) => ({
        toArray: vi.fn().mockResolvedValue(
          query.userId
            ? [{ projectId: projectDoc.id, value: 1 }]
            : [
                ...Array(8).fill({ projectId: projectDoc.id, value: 1 }),
                { projectId: projectDoc.id, value: -1 },
              ]
        ),
      })),
    };
    const commentsMock = {
      find: vi.fn(() => mockCursor(Array(4).fill({ projectId: projectDoc.id, authorId: ownerDoc.id, body: "Great!", createdAt: "2026-10-28T12:00:00.000Z" }))),
    };
    const bookmarksMock = {
      find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([{ projectId: projectDoc.id }]) })),
    };
    const followsMock = {
      find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([{ followedId: projectDoc.ownerId }]) })),
    };
    const mediaMock = {
      find: vi.fn(() => mockCursor([])),
    };

    getProjectsCollection.mockResolvedValue(projectsMock);
    getUsersCollection.mockResolvedValue(usersMock);
    getProjectVotesCollection.mockResolvedValue(votesMock);
    getProjectCommentsCollection.mockResolvedValue(commentsMock);
    getBookmarksCollection.mockResolvedValue(bookmarksMock);
    getCreatorFollowsCollection.mockResolvedValue(followsMock);
    getProjectMediaCollection.mockResolvedValue(mediaMock);

    const response = await GET(new Request("http://localhost/api/feed?mode=Top"));
    const body = (await response.json()) as { mode: string; source: string; projects: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({ mode: "Top", source: "live" });
    expect(body.projects[0]).toMatchObject({
      slug: projectDoc.slug,
      score: 7,
      vote: 1,
      commentsCount: 4,
      bookmarked: true,
      followingCreator: true,
      live: true,
    });
  });

  it("supports the saved-projects workspace mode with owner-scoped bookmark queries", async () => {
    const bookmarksMock = {
      find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([{ projectId: projectDoc.id }]) })),
    };
    const projectsMock = { find: vi.fn(() => mockCursor([projectDoc])) };
    const usersMock = { find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([ownerDoc]) })) };
    const votesMock = { find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })) };
    const commentsMock = { find: vi.fn(() => mockCursor([])) };
    const followsMock = { find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })) };
    const mediaMock = { find: vi.fn(() => mockCursor([])), };

    getBookmarksCollection.mockResolvedValue(bookmarksMock);
    getProjectsCollection.mockResolvedValue(projectsMock);
    getUsersCollection.mockResolvedValue(usersMock);
    getProjectVotesCollection.mockResolvedValue(votesMock);
    getProjectCommentsCollection.mockResolvedValue(commentsMock);
    getCreatorFollowsCollection.mockResolvedValue(followsMock);
    getProjectMediaCollection.mockResolvedValue(mediaMock);

    const response = await GET(new Request("http://localhost/api/feed?mode=Bookmarks"));
    const body = (await response.json()) as { mode: string; projects: Array<{ slug: string }> };

    expect(response.status).toBe(200);
    expect(body.mode).toBe("Bookmarks");
    expect(body.projects[0]?.slug).toBe(projectDoc.slug);
    expect(bookmarksMock.find).toHaveBeenCalledWith({ userId: viewer.id });
  });
});
