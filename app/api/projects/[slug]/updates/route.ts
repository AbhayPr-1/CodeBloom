import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getProjectsCollection, getProjectUpdatesCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { projectUpdateInputSchema } from "@/lib/validation/project-media";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Project updates are not configured." }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid update." }, { status: 400 });
  }

  const parsed = projectUpdateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Use a title of 3–120 characters and a body of up to 4,000 characters." },
      { status: 400 }
    );
  }

  try {
    const { slug } = await context.params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to post a project update." }, { status: 401 });
    }

    const projects = await getProjectsCollection();
    const project = await projects.findOne({ slug, ownerId: user.id });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const projectId = project.id || project._id;
    const updateId = crypto.randomUUID();
    const now = new Date().toISOString();

    const updatesCollection = await getProjectUpdatesCollection();
    const newUpdate = {
      _id: updateId,
      id: updateId,
      projectId,
      authorId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      createdAt: now,
      updatedAt: now,
    };

    await updatesCollection.insertOne(newUpdate);

    return NextResponse.json(
      {
        update: {
          id: updateId,
          title: newUpdate.title,
          body: newUpdate.body,
          createdAt: now,
          authorName: user.displayName || "You",
          authorUsername: user.username || "you",
        },
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "The project update service is unavailable." }, { status: 503 });
  }
}
