import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProjectCommentsCollection, getProjectsCollection, getProjectVotesCollection, isMongoConfigured } = vi.hoisted(() => ({
  getProjectCommentsCollection: vi.fn(),
  getProjectsCollection: vi.fn(),
  getProjectVotesCollection: vi.fn(),
  isMongoConfigured: vi.fn(),
}));

vi.mock("@/lib/mongodb/client", () => ({ isMongoConfigured }));
vi.mock("@/lib/mongodb/collections", () => ({
  getProjectCommentsCollection,
  getProjectsCollection,
  getProjectVotesCollection,
}));

import { GET } from "@/app/api/community-highlights/route";

const projectA = {
  _id: "project-a",
  id: "project-a",
  slug: "garden-a",
  name: "Garden A",
  tags: ["typescript", "open source"],
  createdAt: "2026-11-15T12:00:00.000Z",
};
const projectB = {
  _id: "project-b",
  id: "project-b",
  slug: "garden-b",
  name: "Garden B",
  tags: ["react"],
  createdAt: "2026-11-14T12:00:00.000Z",
};

function cursor<T>(rows: T[]) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(rows),
  };
}

describe("GET /api/community-highlights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMongoConfigured.mockReturnValue(true);
  });

  it("returns engagement-ranked public project highlights and aggregated live topics", async () => {
    const projectsCollection = {
      find: vi.fn(() => cursor([projectA, projectB])),
      aggregate: vi.fn(() => cursor([
        { slug: "typescript", projectCount: 8 },
        { slug: "react", projectCount: 5 },
      ])),
    };
    const votesCollection = {
      aggregate: vi.fn(() => cursor([
        { _id: "project-a", voteCount: 2, score: 2 },
        { _id: "project-b", voteCount: 4, score: 4 },
      ])),
    };
    const commentsCollection = {
      aggregate: vi.fn(() => cursor([
        { _id: "project-a", commentCount: 1 },
        { _id: "project-b", commentCount: 3 },
      ])),
    };
    getProjectsCollection.mockResolvedValue(projectsCollection);
    getProjectVotesCollection.mockResolvedValue(votesCollection);
    getProjectCommentsCollection.mockResolvedValue(commentsCollection);

    const response = await GET();
    const body = await response.json() as {
      projects: Array<Record<string, unknown>>;
      topics: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    expect(projectsCollection.find).toHaveBeenCalledWith(
      { visibility: "public", status: "published" },
      expect.objectContaining({ projection: expect.objectContaining({ name: 1, tags: 1 }) }),
    );
    expect(body.projects).toEqual([
      expect.objectContaining({ slug: "garden-b", voteCount: 4, commentCount: 3 }),
      expect.objectContaining({ slug: "garden-a", voteCount: 2, commentCount: 1 }),
    ]);
    expect(body.topics).toEqual([
      { slug: "typescript", name: "Typescript", projectCount: 8 },
      { slug: "react", name: "React", projectCount: 5 },
    ]);
    expect(JSON.stringify(body)).not.toContain("ownerId");
  });

  it("does not return static demo data when MongoDB is unconfigured", async () => {
    isMongoConfigured.mockReturnValue(false);

    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Live community data is not configured." });
    expect(getProjectsCollection).not.toHaveBeenCalled();
  });

  it("returns a safe unavailable response when the live aggregation fails", async () => {
    getProjectsCollection.mockRejectedValue(new Error("connection failure"));

    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Live community data is temporarily unavailable." });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
