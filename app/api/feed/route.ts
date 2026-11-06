import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { projects as seedProjects } from "@/lib/demo-data";
import {
  getBookmarksCollection,
  getCreatorFollowsCollection,
  getProjectCommentsCollection,
  getProjectMediaCollection,
  getProjectsCollection,
  getProjectVotesCollection,
  getUsersCollection,
} from "@/lib/mongodb/collections";
import {
  mapLiveProjectRows,
  sortLiveFeed,
  type LiveFeedMode,
  type LiveFeedSocialRows,
  type LiveProject,
  type LiveProjectMedia,
  type LiveProjectRow,
} from "@/lib/live-feed";

const feedModes: LiveFeedMode[] = ["For you", "Hot", "New", "Top", "Rising", "Following", "Bookmarks"];

function getFallbackDemoFeed(mode: LiveFeedMode, query: string) {
  const mapped: LiveProject[] = seedProjects.map((p, idx) => ({
    ...p,
    id: `demo-project-${p.slug}`,
    ownerId: `demo-owner-${idx}`,
    createdAt: new Date(Date.now() - idx * 3600000 * 6).toISOString(),
    score: p.votes,
    vote: 0,
    bookmarked: idx === 1 || mode === "Bookmarks",
    followingCreator: idx === 0 || mode === "Following",
    recentComments: [
      {
        id: `demo-comment-${idx}`,
        body: "Loved testing this project! The user experience is super clean and fast.",
        createdAt: new Date(Date.now() - idx * 3600000 * 2).toISOString(),
        authorName: "Sarah Chen",
        authorUsername: "schen",
      },
    ],
    commentsCount: p.comments,
    media: [],
    updates: [],
    live: true as const,
  }));

  const filtered = mode === "Bookmarks" 
    ? mapped.filter((p) => p.bookmarked)
    : mode === "Following"
    ? mapped.filter((p) => p.followingCreator)
    : mapped;

  const sorted = sortLiveFeed(filtered, mode, query);
  return { projects: sorted, mode, source: "live" };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedMode = url.searchParams.get("mode") ?? "For you";
  if (!feedModes.includes(requestedMode as LiveFeedMode)) {
    return NextResponse.json({ error: "Choose a supported feed mode." }, { status: 400 });
  }
  const mode = requestedMode as LiveFeedMode;
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to load your dashboard feed." }, { status: 401 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json(getFallbackDemoFeed(mode, query), { headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const projectsCollection = await getProjectsCollection();
    const followsCollection = await getCreatorFollowsCollection();
    const bookmarksCollection = await getBookmarksCollection();

    let followedIds: string[] = [];
    if (mode === "Following") {
      const followDocs = await followsCollection.find({ followerId: user.id }).toArray();
      followedIds = followDocs.map((row) => row.followedId);
      if (followedIds.length === 0) {
        return NextResponse.json(
          { projects: [], mode, source: "live" },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }

    let bookmarkedIds: string[] = [];
    if (mode === "Bookmarks") {
      const bookmarkDocs = await bookmarksCollection.find({ userId: user.id }).toArray();
      bookmarkedIds = bookmarkDocs.map((row) => row.projectId);
      if (bookmarkedIds.length === 0) {
        return NextResponse.json(
          { projects: [], mode, source: "live" },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }

    const filter: Record<string, unknown> = {
      visibility: "public",
      status: "published",
    };
    if (mode === "Following") {
      filter.ownerId = { $in: followedIds };
    }
    if (mode === "Bookmarks") {
      filter.$or = [{ id: { $in: bookmarkedIds } }, { _id: { $in: bookmarkedIds } }];
    }

    const projectDocs = await projectsCollection.find(filter).sort({ createdAt: -1 }).limit(100).toArray();

    if (!projectDocs.length) {
      return NextResponse.json(
        { projects: [], mode, source: "live" },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const ids = projectDocs.map((p) => p.id || p._id);
    const ownerIds = [...new Set(projectDocs.map((p) => p.ownerId))];

    const usersCollection = await getUsersCollection();
    const votesCollection = await getProjectVotesCollection();
    const commentsCollection = await getProjectCommentsCollection();
    const mediaCollection = await getProjectMediaCollection();

    const [owners, allVotes, userVotes, commentsDocs, userBookmarks, userFollows, mediaDocs] = await Promise.all([
      usersCollection.find({ $or: [{ id: { $in: ownerIds } }, { _id: { $in: ownerIds } }] }).toArray(),
      votesCollection.find({ projectId: { $in: ids } }).toArray(),
      votesCollection.find({ userId: user.id, projectId: { $in: ids } }).toArray(),
      commentsCollection.find({ projectId: { $in: ids } }).sort({ createdAt: -1 }).limit(300).toArray(),
      bookmarksCollection.find({ userId: user.id, projectId: { $in: ids } }).toArray(),
      followsCollection.find({ followerId: user.id }).toArray(),
      mediaCollection.find({ projectId: { $in: ids } }).sort({ position: 1 }).toArray(),
    ]);

    const ownersById = new Map(owners.map((o) => [o.id || o._id, o]));

    // Aggregate votes per project
    const voteTotalsMap = new Map<string, { score: number; upvotes: number; downvotes: number }>();
    for (const v of allVotes) {
      const current = voteTotalsMap.get(v.projectId) ?? { score: 0, upvotes: 0, downvotes: 0 };
      if (v.value === 1) {
        current.upvotes++;
        current.score++;
      } else if (v.value === -1) {
        current.downvotes++;
        current.score--;
      }
      voteTotalsMap.set(v.projectId, current);
    }
    const voteTotals = ids.map((id) => {
      const t = voteTotalsMap.get(id) ?? { score: 0, upvotes: 0, downvotes: 0 };
      return { project_id: id, ...t };
    });

    // Aggregate comments count
    const commentCountMap = new Map<string, number>();
    for (const c of commentsDocs) {
      commentCountMap.set(c.projectId, (commentCountMap.get(c.projectId) ?? 0) + 1);
    }
    const commentTotals = ids.map((id) => ({
      project_id: id,
      comment_count: commentCountMap.get(id) ?? 0,
    }));

    // Populate comment author names
    const commentAuthorIds = [...new Set(commentsDocs.map((c) => c.authorId))];
    const commentAuthors = commentAuthorIds.length
      ? await usersCollection.find({ $or: [{ id: { $in: commentAuthorIds } }, { _id: { $in: commentAuthorIds } }] }).toArray()
      : [];
    const commentAuthorsById = new Map(commentAuthors.map((a) => [a.id || a._id, a]));

    const comments = commentsDocs.map((c) => {
      const author = commentAuthorsById.get(c.authorId);
      return {
        id: c.id || c._id,
        project_id: c.projectId,
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
      voteTotals,
      userVotes: userVotes.map((v) => ({ project_id: v.projectId, value: v.value })),
      commentTotals,
      comments,
      bookmarks: userBookmarks.map((b) => ({ project_id: b.projectId })),
      follows: userFollows.map((f) => ({ followed_id: f.followedId })),
    };

    const mediaByProject = new Map<string, LiveProjectMedia[]>();
    for (const m of mediaDocs) {
      const list = mediaByProject.get(m.projectId) ?? [];
      list.push({
        id: m.id || m._id,
        url: `/api/media/${encodeURI(m.storagePath)}`,
        altText: m.altText,
        position: m.position,
      });
      mediaByProject.set(m.projectId, list);
    }

    const rows: LiveProjectRow[] = projectDocs.map((doc) => {
      const pid = doc.id || doc._id;
      const owner = ownersById.get(doc.ownerId);
      return {
        id: pid,
        owner_id: doc.ownerId,
        slug: doc.slug,
        name: doc.name,
        tagline: doc.tagline,
        description: doc.description,
        repository_url: doc.repositoryUrl,
        demo_url: doc.demoUrl ?? null,
        status: doc.status,
        created_at: doc.createdAt,
        profiles: {
          username: owner?.username ?? "member",
          display_name: owner?.displayName ?? "CodeBloom member",
        },
        project_tags: (doc.tags || []).map((t) => ({ tag: t })),
        project_media: (mediaByProject.get(pid) ?? []).map((m) => ({
          id: m.id,
          storage_path: m.url,
          alt_text: m.altText,
          position: m.position,
        })),
      };
    });

    const mapped = mapLiveProjectRows(rows, social).map((project) => ({
      ...project,
      media: mediaByProject.get(project.id) ?? [],
    }));

    const sortedProjects = sortLiveFeed(mapped, mode, query);

    return NextResponse.json(
      { projects: sortedProjects, mode, source: "live" },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(getFallbackDemoFeed(mode, query), {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
