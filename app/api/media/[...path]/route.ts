import { getProjectMediaCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!isMongoConfigured()) {
    return new Response("Media service unavailable", { status: 503 });
  }

  try {
    const { path } = await context.params;
    const storagePath = path.join("/");

    const mediaCollection = await getProjectMediaCollection();
    const media = await mediaCollection.findOne({ storagePath });

    if (!media || !media.data) {
      return new Response("Media not found", { status: 404 });
    }

    const base64Content = media.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Content, "base64");
    const contentType = media.contentType || "image/png";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("Media service unavailable", { status: 503 });
  }
}
