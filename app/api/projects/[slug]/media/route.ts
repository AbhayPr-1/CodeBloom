import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { getProjectMediaCollection, getProjectsCollection } from "@/lib/mongodb/collections";
import {
  inspectProjectImage,
  PROJECT_IMAGE_MAX_BYTES,
  projectMediaInputSchema,
} from "@/lib/validation/project-media";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Project media is not configured." }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Send valid project media metadata." }, { status: 400 });
  }

  const parsed = projectMediaInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check each image, alt text, and display position." }, { status: 400 });
  }

  try {
    const { slug } = await context.params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to add project media." }, { status: 401 });
    }

    const projects = await getProjectsCollection();
    const project = await projects.findOne({ slug, ownerId: user.id });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const projectId = project.id || project._id;
    const media = parsed.data.media;
    const prefix = `${projectId}/${user.id}/`;

    if (media.some((item) => !item.storagePath.startsWith(prefix))) {
      return NextResponse.json(
        { error: "An uploaded image does not belong to this project and account." },
        { status: 403 }
      );
    }

    for (const item of media) {
      if (item.data) {
        const base64Data = item.data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length < 1 || buffer.length > PROJECT_IMAGE_MAX_BYTES) {
          return NextResponse.json({ error: "An uploaded image is missing or exceeds the 5 MB limit." }, { status: 400 });
        }
        const detected = inspectProjectImage(new Uint8Array(buffer));
        if (!detected || !item.storagePath.endsWith(`.${detected.extension}`)) {
          return NextResponse.json({ error: "An uploaded file's contents do not match its image type." }, { status: 400 });
        }
      }
    }

    if (media.length) {
      const mediaCollection = await getProjectMediaCollection();
      const now = new Date().toISOString();

      for (const item of media) {
        const mediaId = crypto.randomUUID();
        await mediaCollection.updateOne(
          { projectId, position: item.position },
          {
            $set: {
              _id: mediaId,
              id: mediaId,
              projectId,
              storagePath: item.storagePath,
              altText: item.altText,
              position: item.position,
              ...(item.data ? { data: item.data } : {}),
              ...(item.contentType ? { contentType: item.contentType } : {}),
              createdAt: now,
            },
          },
          { upsert: true }
        );
      }
    }

    return NextResponse.json(
      { media: media.length },
      { status: 201, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "The project media service is unavailable." }, { status: 503 });
  }
}
