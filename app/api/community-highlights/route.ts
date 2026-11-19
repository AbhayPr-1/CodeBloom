import { NextResponse } from "next/server";
import { isMongoConfigured } from "@/lib/mongodb/client";
import {
  getProjectCommentsCollection,
  getProjectsCollection,
  getProjectVotesCollection,
} from "@/lib/mongodb/collections";
import type {
  CommunityHighlightsResponse,
  CommunitySpotlightProject,
  CommunityTopicHighlight,
} from "@/lib/community-highlights";

export const dynamic = "force-dynamic";

const publicProjectFilter = { visibility: "public", status: "published" } as const;
const cacheHeaders = { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" };
const unavailableHeaders = { "Cache-Control": "no-store" };

function toTopicName(tag: string) {
  return tag ? `${tag[0]!.toLocaleUpperCase()}${tag.slice(1)}` : tag;
}

export async function GET() {
  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "Live community data is not configured." },
      { status: 503, headers: unavailableHeaders },
    );
  }

  try {
    const [projectsCollection, votesCollection, commentsCollection] = await Promise.all([
      getProjectsCollection(),
      getProjectVotesCollection(),
      getProjectCommentsCollection(),
    ]);

    const projectDocs = await projectsCollection
      .find(publicProjectFilter, {
        projection: { _id: 1, id: 1, slug: 1, name: 1, tags: 1, createdAt: 1 },
      })
      .sort({ createdAt: -1, slug: 1 })
      .limit(100)
      .toArray();
    const projectIds = projectDocs.map((project) => project.id || project._id);

    const [voteTotals, commentTotals, topicTotals] = await Promise.all([
      projectIds.length
        ? votesCollection.aggregate<{ _id: string; voteCount: number; score: number }>([
            { $match: { projectId: { $in: projectIds } } },
            { $group: { _id: "$projectId", voteCount: { $sum: 1 }, score: { $sum: "$value" } } },
          ]).toArray()
        : Promise.resolve([]),
      projectIds.length
        ? commentsCollection.aggregate<{ _id: string; commentCount: number }>([
            { $match: { projectId: { $in: projectIds } } },
            { $group: { _id: "$projectId", commentCount: { $sum: 1 } } },
          ]).toArray()
        : Promise.resolve([]),
      projectsCollection.aggregate<{ slug: string; projectCount: number }>([
        { $match: { ...publicProjectFilter, tags: { $type: "array", $ne: [] } } },
        {
          $project: {
            projectId: { $ifNull: ["$id", "$_id"] },
            createdAt: 1,
            tags: { $setUnion: [{ $ifNull: ["$tags", []] }, []] },
          },
        },
        { $unwind: "$tags" },
        { $set: { normalizedTag: { $toLower: { $trim: { input: { $toString: "$tags" } } } } } },
        { $match: { normalizedTag: { $ne: "" } } },
        {
          $group: {
            _id: "$normalizedTag",
            projectIds: { $addToSet: "$projectId" },
          },
        },
        { $project: { _id: 0, slug: "$_id", projectCount: { $size: "$projectIds" } } },
        { $sort: { projectCount: -1, slug: 1 } },
        { $limit: 5 },
      ]).toArray(),
    ]);

    const votesByProject = new Map(voteTotals.map((row) => [row._id, row]));
    const commentsByProject = new Map(commentTotals.map((row) => [row._id, row.commentCount]));
    const spotlightProjects: CommunitySpotlightProject[] = projectDocs
      .map((project) => {
        const id = project.id || project._id;
        const votes = votesByProject.get(id);
        return {
          slug: project.slug,
          name: project.name,
          tag: project.tags?.[0] ?? "",
          voteCount: votes?.voteCount ?? 0,
          commentCount: commentsByProject.get(id) ?? 0,
          score: votes?.score ?? 0,
          createdAt: project.createdAt,
        };
      })
      .sort((a, b) =>
        (b.voteCount + b.commentCount) - (a.voteCount + a.commentCount)
        || b.score - a.score
        || b.createdAt.localeCompare(a.createdAt)
        || a.slug.localeCompare(b.slug),
      )
      .slice(0, 4);

    const topics: CommunityTopicHighlight[] = topicTotals.map((topic) => ({
      slug: topic.slug,
      name: toTopicName(topic.slug),
      projectCount: topic.projectCount,
    }));
    const response: CommunityHighlightsResponse = { projects: spotlightProjects, topics };

    return NextResponse.json(response, { headers: cacheHeaders });
  } catch {
    return NextResponse.json(
      { error: "Live community data is temporarily unavailable." },
      { status: 503, headers: unavailableHeaders },
    );
  }
}
