import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getProjectsCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { isOriginAllowed } from "@/lib/security";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Project publishing is not configured." }, { status: 503 });
  }

  try {
    const { slug } = await context.params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to publish this project." }, { status: 401 });
    }

    const projects = await getProjectsCollection();
    const project = await projects.findOne({ slug, ownerId: user.id });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (project.status === "published") {
      return NextResponse.json(
        { project: { id: project.id || project._id, slug: project.slug, status: project.status } },
        { status: 200, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (project.status !== "draft") {
      return NextResponse.json({ error: "Only a draft project can be published." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updated = await projects.findOneAndUpdate(
      { slug, ownerId: user.id, status: "draft" },
      { $set: { status: "published", updatedAt: now } },
      { returnDocument: "after" }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "This project changed before it could be published. Refresh and try again." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { project: { id: updated.id || updated._id, slug: updated.slug, status: updated.status } },
      { status: 200, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "The publishing service is unavailable." }, { status: 503 });
  }
}
