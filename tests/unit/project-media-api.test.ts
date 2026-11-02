import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient, getSupabaseConfig } = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn(), getSupabaseConfig: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig }));
import { POST } from "@/app/api/projects/[slug]/media/route";

const user = { id: "22222222-2222-4222-8222-222222222222" };
const project = { id: "11111111-1111-4111-8111-111111111111", owner_id: user.id, status: "draft" };
const storagePath = `${project.id}/${user.id}/33333333-3333-4333-8333-333333333333.png`;
const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });

function setup(options: { info?: { size: number; contentType: string }; authenticated?: boolean; file?: Blob } = {}) {
  const projectQuery: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) projectQuery[method] = vi.fn(() => projectQuery);
  projectQuery.maybeSingle = vi.fn().mockResolvedValue({ data: project, error: null });
  const mediaQuery = { insert: vi.fn().mockResolvedValue({ error: null }) };
  const from = vi.fn((table: string) => table === "projects" ? projectQuery : mediaQuery);
  const storage = { info: vi.fn().mockResolvedValue({ data: options.info ?? { size: 8, contentType: "image/png" }, error: null }), download: vi.fn().mockResolvedValue({ data: options.file ?? png, error: null }) };
  createSupabaseServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.authenticated === false ? null : user }, error: null }) },
    from,
    storage: { from: vi.fn(() => storage) },
  });
  return { from, mediaQuery, storage };
}

const context = { params: Promise.resolve({ slug: "test-project-12345678" }) };
const payload = { media: [{ storagePath, altText: "The project dashboard with its release timeline", position: 0 }] };

describe("POST /api/projects/[slug]/media", () => {
  beforeEach(() => { vi.clearAllMocks(); getSupabaseConfig.mockReturnValue({ url: "configured" }); });

  it("requires an authenticated project owner", async () => {
    setup({ authenticated: false });
    const response = await POST(new Request("http://localhost/api/projects/test-project/media", { method: "POST", body: JSON.stringify(payload) }), context);
    expect(response.status).toBe(401);
  });

  it("rejects an object path outside the caller's project namespace", async () => {
    const { storage } = setup();
    const response = await POST(new Request("http://localhost/api/projects/test-project/media", { method: "POST", body: JSON.stringify({ media: [{ ...payload.media[0]!, storagePath: storagePath.replace(user.id, "44444444-4444-4444-8444-444444444444") }] }) }), context);
    expect(response.status).toBe(403);
    expect(storage.info).not.toHaveBeenCalled();
  });

  it("verifies the bytes and registers the screenshot under the owner project", async () => {
    const { mediaQuery, storage } = setup();
    const response = await POST(new Request("http://localhost/api/projects/test-project/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), context);
    expect(response.status).toBe(201);
    expect(storage.info).toHaveBeenCalledWith(storagePath);
    expect(storage.download).toHaveBeenCalledWith(storagePath);
    expect(mediaQuery.insert).toHaveBeenCalledWith([{ project_id: project.id, storage_path: storagePath, alt_text: payload.media[0]!.altText, position: 0 }]);
  });

  it("rejects a misleading Storage MIME label when the object bytes are not a supported image", async () => {
    setup({ info: { size: 12, contentType: "image/png" }, file: new Blob(["not an image"], { type: "image/png" }) });
    const response = await POST(new Request("http://localhost/api/projects/test-project/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), context);
    expect(response.status).toBe(400);
  });
});
