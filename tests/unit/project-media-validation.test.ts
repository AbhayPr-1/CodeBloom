import { describe, expect, it } from "vitest";
import { inspectProjectImage, projectMediaInputSchema, projectUpdateInputSchema } from "@/lib/validation/project-media";

const validMedia = {
  media: [{
    storagePath: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png",
    altText: "Dashboard showing the project's current milestone list",
    position: 0,
  }],
};

describe("Phase 4 project media and update validation", () => {
  it("accepts owner-scoped image paths and clear alt text", () => {
    expect(projectMediaInputSchema.safeParse(validMedia).success).toBe(true);
  });

  it("rejects unsafe paths, duplicate positions, and missing alt text", () => {
    expect(projectMediaInputSchema.safeParse({ media: [{ ...validMedia.media[0], storagePath: "other-account/file.png" }] }).success).toBe(false);
    expect(projectMediaInputSchema.safeParse({ media: [validMedia.media[0], { ...validMedia.media[0], storagePath: validMedia.media[0].storagePath.replace("33333333", "44444444") }] }).success).toBe(false);
    expect(projectMediaInputSchema.safeParse({ media: [{ ...validMedia.media[0], altText: " " }] }).success).toBe(false);
  });

  it("recognizes PNG, JPEG, and WebP file signatures instead of trusting MIME labels", () => {
    expect(inspectProjectImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toMatchObject({ mime: "image/png", extension: "png" });
    expect(inspectProjectImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toMatchObject({ mime: "image/jpeg", extension: "jpg" });
    expect(inspectProjectImage(new TextEncoder().encode("RIFFxxxxWEBP"))).toMatchObject({ mime: "image/webp", extension: "webp" });
    expect(inspectProjectImage(new TextEncoder().encode("not an image"))).toBeNull();
  });

  it("keeps project updates bounded and rejects blank content", () => {
    expect(projectUpdateInputSchema.safeParse({ title: "First release", body: "The public beta is ready." }).success).toBe(true);
    expect(projectUpdateInputSchema.safeParse({ title: "ok", body: "   " }).success).toBe(false);
  });
});
