import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUser, getUsersCollection, isMongoConfigured } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getUsersCollection: vi.fn(),
  isMongoConfigured: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser }));
vi.mock("@/lib/mongodb/collections", () => ({ getUsersCollection }));
vi.mock("@/lib/mongodb/client", () => ({ isMongoConfigured }));

import { PATCH } from "@/app/api/profile/route";

const authenticatedUser = {
  id: "user-123",
  email: "developer@example.test",
  username: "old_handle",
  displayName: "Old Name",
  user_metadata: { user_name: "old_handle", full_name: "Old Name" },
};

function requestForProfileUpdate(body: unknown) {
  return new Request("http://localhost/api/profile", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMongoConfigured.mockReturnValue(true);
    getAuthenticatedUser.mockResolvedValue(authenticatedUser);
  });

  it("saves normalized profile fields only for the authenticated user", async () => {
    const updatedDoc = {
      id: authenticatedUser.id,
      username: "new_handle",
      displayName: "Developer Name",
      bio: "Building tools.",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-28T12:00:00.000Z",
    };

    const mockCollection = {
      findOne: vi.fn().mockResolvedValue(null), // no conflicting username
      findOneAndUpdate: vi.fn().mockResolvedValue(updatedDoc),
    };
    getUsersCollection.mockResolvedValue(mockCollection);

    const response = await PATCH(
      requestForProfileUpdate({
        username: "  New_Handle  ",
        displayName: "  Developer Name  ",
        bio: " Building tools. ",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: {
        id: updatedDoc.id,
        username: updatedDoc.username,
        displayName: updatedDoc.displayName,
        bio: updatedDoc.bio,
        createdAt: updatedDoc.createdAt,
        updatedAt: updatedDoc.updatedAt,
      },
    });
    expect(mockCollection.findOne).toHaveBeenCalledWith({
      usernameNormalized: "new_handle",
      $nor: [{ id: authenticatedUser.id }, { _id: authenticatedUser.id }],
    });
    expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
      { $or: [{ id: authenticatedUser.id }, { _id: authenticatedUser.id }] },
      expect.objectContaining({
        $set: expect.objectContaining({
          username: "new_handle",
          displayName: "Developer Name",
          bio: "Building tools.",
        }),
      }),
      { returnDocument: "after" }
    );
  });

  it("returns a clear 409 response when the database rejects a duplicate username", async () => {
    const mockCollection = {
      findOne: vi.fn().mockResolvedValue({ id: "other-user", username: "taken_handle" }),
    };
    getUsersCollection.mockResolvedValue(mockCollection);

    const response = await PATCH(
      requestForProfileUpdate({
        username: "taken_handle",
        displayName: "Developer Name",
        bio: "",
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "That username is already in use." });
  });
});
