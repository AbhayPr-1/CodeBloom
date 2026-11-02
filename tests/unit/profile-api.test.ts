import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

import { PATCH } from "@/app/api/profile/route";

const authenticatedUser = { id: "user-123", email: "developer@example.test" };

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

type ProfileResult = {
  data: {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  error: { code?: string } | null;
};

function installAuthenticatedProfileClient(result: ProfileResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const getUser = vi.fn().mockResolvedValue({ data: { user: authenticatedUser }, error: null });

  createSupabaseServerClient.mockResolvedValue({ auth: { getUser }, from });
  return { from, update, eq, select, maybeSingle };
}

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves normalized profile fields only for the authenticated user", async () => {
    const row = {
      id: authenticatedUser.id,
      username: "new_handle",
      display_name: "Developer Name",
      bio: "Building tools.",
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-28T12:00:00.000Z",
    };
    const client = installAuthenticatedProfileClient({ data: row, error: null });

    const response = await PATCH(requestForProfileUpdate({
      username: "  New_Handle  ",
      displayName: "  Developer Name  ",
      bio: " Building tools. ",
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        bio: row.bio,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(client.update).toHaveBeenCalledWith({
      username: "new_handle",
      display_name: "Developer Name",
      bio: "Building tools.",
    });
    expect(client.eq).toHaveBeenCalledWith("id", authenticatedUser.id);
  });

  it("returns a clear 409 response when the database rejects a duplicate username", async () => {
    installAuthenticatedProfileClient({ data: null, error: { code: "23505" } });

    const response = await PATCH(requestForProfileUpdate({
      username: "taken_handle",
      displayName: "Developer Name",
      bio: "",
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "That username is already in use." });
  });
});
