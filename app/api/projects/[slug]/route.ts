import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isMongoConfigured } from "@/lib/mongodb/client";
import {
  getBookmarksCollection,
  getCreatorFollowsCollection,
  getProjectCommentsCollection,
  getProjectMediaCollection,
  getProjectsCollection,
  getProjectUpdatesCollection,
  getProjectVotesCollection,
  getUsersCollection,
} from "@/lib/mongodb/collections";
import { mapLiveProjectRows, type LiveFeedSocialRows, type LiveProjectRow } from "@/lib/live-feed";
import { isOriginAllowed } from "@/lib/security";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "The live project service is not configured." }, { status: 503 });
  }

  const { slug } = await context.params;

  try {
    const user = await getAuthenticatedUser();
    const projects = await getProjectsCollection();

    const projectDoc = await projects.findOne({ slug });
    if (!projectDoc) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const isOwner = user && (user.id === projectDoc.ownerId || user.id === projectDoc._id);
    if (projectDoc.status !== "published" && !isOwner) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const users = await getUsersCollection();
    const ownerDoc = await users.findOne({
      $or: [{ id: projectDoc.ownerId }, { _id: projectDoc.ownerId }],
    });

    const projectId = projectDoc.id || projectDoc._id;

    // Social data aggregation
    const votesCollection = await getProjectVotesCollection();
    const commentsCollection = await getProjectCommentsCollection();
    const bookmarksCollection = await getBookmarksCollection();
    const followsCollection = await getCreatorFollowsCollection();
    const mediaCollection = await getProjectMediaCollection();
    const updatesCollection = await getProjectUpdatesCollection();

    const [allVotes, userVoteDoc, commentCount, recentCommentsDocs, isBookmarked, isFollowing] = await Promise.all([
      votesCollection.find({ projectId }).toArray(),
      user ? votesCollection.findOne({ userId: user.id, projectId }) : null,
      commentsCollection.countDocuments({ projectId }),
      commentsCollection.find({ projectId }).sort({ createdAt: -1 }).limit(3).toArray(),
      user ? bookmarksCollection.findOne({ userId: user.id, projectId }) : null,
      user ? followsCollection.findOne({ followerId: user.id, followedId: projectDoc.ownerId }) : null,
    ]);

    let upvotes = 0;
    let downvotes = 0;
    for (const v of allVotes) {
      if (v.value === 1) upvotes++;
      else if (v.value === -1) downvotes++;
    }
    const score = upvotes - downvotes;

    // Populate comment authors
    const authorIds = [...new Set(recentCommentsDocs.map((c) => c.authorId))];
    const authorDocs = authorIds.length
      ? await users.find({ $or: [{ id: { $in: authorIds } }, { _id: { $in: authorIds } }] }).toArray()
      : [];
    const authorsById = new Map(authorDocs.map((a) => [a.id || a._id, a]));

    const comments = recentCommentsDocs.map((c) => {
      const author = authorsById.get(c.authorId);
      return {
        id: c.id || c._id,
        project_id: projectId,
        body: c.body,
        created_at: c.createdAt,
        author_id: c.authorId,
        profiles: {
          username: author?.username ?? "member",
          display_name: author?.displayName ?? "CodeBloom member",
        },
      };
    });

    const social: LiveFeedSocialRows = {
      voteTotals: [{ project_id: projectId, score, upvotes, downvotes }],
      userVotes: userVoteDoc ? [{ project_id: projectId, value: userVoteDoc.value }] : [],
      commentTotals: [{ project_id: projectId, comment_count: commentCount }],
      comments,
      bookmarks: isBookmarked ? [{ project_id: projectId }] : [],
      follows: isFollowing ? [{ followed_id: projectDoc.ownerId }] : [],
    };

    const mediaDocs = await mediaCollection.find({ projectId }).sort({ position: 1 }).toArray();

    const projectRow: LiveProjectRow = {
      id: projectId,
      owner_id: projectDoc.ownerId,
      slug: projectDoc.slug,
      name: projectDoc.name,
      tagline: projectDoc.tagline,
      description: projectDoc.description,
      repository_url: projectDoc.repositoryUrl,
      demo_url: projectDoc.demoUrl ?? null,
      status: projectDoc.status,
      created_at: projectDoc.createdAt,
      profiles: {
        username: ownerDoc?.username ?? "member",
        display_name: ownerDoc?.displayName ?? "CodeBloom member",
      },
      project_tags: (projectDoc.tags || []).map((t) => ({ tag: t })),
      project_media: mediaDocs.map((m) => ({
        id: m.id || m._id,
        storage_path: m.storagePath,
        alt_text: m.altText,
        position: m.position,
      })),
    };

    const [liveProject] = mapLiveProjectRows([projectRow], social);

    const media = mediaDocs.map((item) => ({
      id: item.id || item._id,
      url: `/api/media/${encodeURI(item.storagePath)}`,
      altText: item.altText,
      position: item.position,
    }));

    const updateDocs = await updatesCollection.find({ projectId }).sort({ createdAt: -1 }).toArray();
    const updateAuthorIds = [...new Set(updateDocs.map((u) => u.authorId))];
    const updateAuthors = updateAuthorIds.length
      ? await users.find({ $or: [{ id: { $in: updateAuthorIds } }, { _id: { $in: updateAuthorIds } }] }).toArray()
      : [];
    const updateAuthorsById = new Map(updateAuthors.map((u) => [u.id || u._id, u]));

    const updates = updateDocs.map((item) => {
      const author = updateAuthorsById.get(item.authorId);
      return {
        id: item.id || item._id,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt,
        authorName: author?.displayName ?? "Project owner",
        authorUsername: author?.username ?? "member",
      };
    });

    return NextResponse.json(
      { project: { ...liveProject, media, updates } },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "The live project service is unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Project cleanup is not configured." }, { status: 503 });
  }

  try {
    const { slug } = await context.params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to remove this draft." }, { status: 401 });
    }

    const projects = await getProjectsCollection();
    const project = await projects.findOne({ slug, ownerId: user.id });

    if (!project) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    if (project.status !== "draft") {
      return NextResponse.json(
        { error: "Only an unpublished draft can be removed by this cleanup endpoint." },
        { status: 409 }
      );
    }

    let requestedPaths: unknown = [];
    try {
      requestedPaths = ((await request.json()) as { storagePaths?: unknown }).storagePaths ?? [];
    } catch {
      // Cleanup may be called with an empty body
    }

    const projectId = project.id || project._id;
    if (
      Array.isArray(requestedPaths) &&
      requestedPaths.some((path) => typeof path !== "string" || !path.startsWith(`${projectId}/${user.id}/`))
    ) {
      return NextResponse.json({ error: "Cleanup paths must belong to this draft and account." }, { status: 400 });
    }

    // Delete media records
    const mediaCollection = await getProjectMediaCollection();
    await mediaCollection.deleteMany({ projectId });

    // Delete draft project
    await projects.deleteOne({ id: projectId, ownerId: user.id, status: "draft" });

    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The project cleanup service is unavailable." }, { status: 503 });
  }
}
