import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getProjectsCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { projectInputSchema } from "@/lib/validation/projects";

export async function GET() {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Project service is unavailable." }, { status: 503 });
  }

  try {
    const projects = await getProjectsCollection();
    const rows = await projects
      .aggregate([
        { $match: { visibility: "public", status: "published" } },
        { $sort: { createdAt: -1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: "users",
            let: { ownerId: "$ownerId" },
            pipeline: [
              { $match: { $expr: { $or: [{ $eq: ["$id", "$$ownerId"] }, { $eq: ["$_id", "$$ownerId"] }] } } },
              { $project: { username: 1, displayName: 1 } },
            ],
            as: "owner",
          },
        },
        {
          $project: {
            _id: 0,
            id: 1,
            slug: 1,
            name: 1,
            tagline: 1,
            description: 1,
            repository_url: "$repositoryUrl",
            demo_url: "$demoUrl",
            status: 1,
            created_at: "$createdAt",
            profiles: {
              username: { $ifNull: [{ $arrayElemAt: ["$owner.username", 0] }, "member"] },
              display_name: { $ifNull: [{ $arrayElemAt: ["$owner.displayName", 0] }, "CodeBloom member"] },
            },
            project_tags: {
              $map: {
                input: { $ifNull: ["$tags", []] },
                as: "t",
                in: { tag: "$$t" },
              },
            },
          },
        },
      ])
      .toArray();

    return NextResponse.json(
      { projects: rows },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ error: "Project service is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON project payload." }, { status: 400 });
  }

  const parsed = projectInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please correct the project fields and use safe HTTPS links." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Project service is unavailable." }, { status: 503 });
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to publish a project." }, { status: 401 });
    }

    const input = parsed.data;
    const slugBase = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    const slug = `${slugBase}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();

    const projects = await getProjectsCollection();
    const newProject = {
      _id: projectId,
      id: projectId,
      ownerId: user.id,
      slug,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      repositoryUrl: input.repositoryUrl,
      demoUrl: input.demoUrl || null,
      tags: input.tags,
      visibility: "public" as const,
      status: "draft" as const,
      createdAt: now,
      updatedAt: now,
    };

    await projects.insertOne(newProject);

    return NextResponse.json({ project: { id: projectId, slug } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Project service is unavailable." }, { status: 503 });
  }
}
