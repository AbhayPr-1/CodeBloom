import { z } from "zod";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const storagePathPattern = new RegExp(`^${uuid}/${uuid}/${uuid}\\.(png|jpg|webp)$`, "i");

export const projectMediaInputSchema = z.object({
  media: z.array(z.object({
    storagePath: z.string().max(160).regex(storagePathPattern),
    altText: z.string().trim().min(1).max(180),
    position: z.number().int().min(0).max(4),
    data: z.string().optional(),
    contentType: z.string().optional(),
  })).max(5),
}).refine(({ media }) => new Set(media.map((item) => item.storagePath)).size === media.length, {
  message: "Each uploaded image must have a unique storage path.",
}).refine(({ media }) => new Set(media.map((item) => item.position)).size === media.length, {
  message: "Image positions must be unique.",
});

export const projectUpdateInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(4000),
});

export type ProjectMediaInput = z.infer<typeof projectMediaInputSchema>["media"][number];
export type ProjectUpdateInput = z.infer<typeof projectUpdateInputSchema>;
export type ProjectImageMime = "image/png" | "image/jpeg" | "image/webp";

export const PROJECT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROJECT_IMAGE_MIME_TYPES: readonly ProjectImageMime[] = ["image/png", "image/jpeg", "image/webp"];

export function inspectProjectImage(bytes: Uint8Array): { mime: ProjectImageMime; extension: "png" | "jpg" | "webp" } | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}
