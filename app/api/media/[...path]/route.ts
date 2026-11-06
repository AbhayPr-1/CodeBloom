import { getMediaFile } from "@/lib/storage";
import { PROJECT_IMAGE_MIME_TYPES, type ProjectImageMime } from "@/lib/validation/project-media";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const storagePath = path.join("/");

    const media = await getMediaFile(storagePath);
    if (!media || !media.buffer || media.buffer.length === 0) {
      return new Response("Media not found", { status: 404 });
    }

    // Strict MIME-type enforcement against stored XSS
    const rawType = (media.contentType || "image/png").toLowerCase();
    const contentType = PROJECT_IMAGE_MIME_TYPES.includes(rawType as ProjectImageMime)
      ? rawType
      : "image/png";

    return new Response(new Uint8Array(media.buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": media.buffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Media service unavailable", { status: 503 });
  }
}
