import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedUser,
  isMongoConfigured,
  getProjectsCollection,
  getProjectMediaCollection,
} = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  isMongoConfigured: vi.fn(),
  getProjectsCollection: vi.fn(),
  getProjectMediaCollection: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser }));
vi.mock("@/lib/mongodb/client", () => ({ isMongoConfigured }));
vi.mock("@/lib/mongodb/collections", () => ({
  getProjectsCollection,
  getProjectMediaCollection,
}));

import { POST } from "@/app/api/projects/[slug]/media/route";

const user = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "owner@example.test",
  username: "owner",
  displayName: "Owner",
  user_metadata: { user_name: "owner", full_name: "Owner" },
};
const project = { id: "11111111-1111-4111-8111-111111111111", ownerId: user.id, status: "draft" };
const storagePath = `${project.id}/${user.id}/33333333-3333-4333-8333-333333333333.png`;
const pngBase64 = Buffer.from(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).toString("base64");

const context = { params: Promise.resolve({ slug: "test-project-12345678" }) };
const payload = {
  media: [
    {
      storagePath,
      altText: "The project dashboard with its release timeline",
      position: 0,
      data: pngBase64,
    },
  ],
};

describe("POST /api/projects/[slug]/media", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMongoConfigured.mockReturnValue(true);
    getAuthenticatedUser.mockResolvedValue(user);
    getProjectsCollection.mockResolvedValue({
      findOne: vi.fn().mockResolvedValue(project),
    });
    getProjectMediaCollection.mockResolvedValue({
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    });
  });

  it("requires an authenticated project owner", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/projects/test-project/media", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      context
    );
    expect(response.status).toBe(401);
  });

  it("rejects an object path outside the caller's project namespace", async () => {
    const invalidPath = storagePath.replace(user.id, "44444444-4444-4444-8444-444444444444");
    const response = await POST(
      new Request("http://localhost/api/projects/test-project/media", {
        method: "POST",
        body: JSON.stringify({
          media: [{ ...payload.media[0]!, storagePath: invalidPath }],
        }),
      }),
      context
    );
    expect(response.status).toBe(403);
  });

  it("verifies the bytes and registers the screenshot under the owner project", async () => {
    const mediaCollection = {
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    };
    getProjectMediaCollection.mockResolvedValue(mediaCollection);

    const response = await POST(
      new Request("http://localhost/api/projects/test-project/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      context
    );
    expect(response.status).toBe(201);
    expect(mediaCollection.updateOne).toHaveBeenCalledWith(
      { projectId: project.id, position: 0 },
      expect.objectContaining({
        $set: expect.objectContaining({
          projectId: project.id,
          storagePath,
          altText: payload.media[0]!.altText,
          position: 0,
        }),
      }),
      { upsert: true }
    );
  });

  it("rejects a misleading Storage MIME label when the object bytes are not a supported image", async () => {
    const invalidPayload = {
      media: [
        {
          storagePath,
          altText: payload.media[0]!.altText,
          position: 0,
          data: Buffer.from("not an image").toString("base64"),
        },
      ],
    };
    const response = await POST(
      new Request("http://localhost/api/projects/test-project/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invalidPayload),
      }),
      context
    );
    expect(response.status).toBe(400);
  });
});
