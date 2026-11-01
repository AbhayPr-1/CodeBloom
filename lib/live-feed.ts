import type { Project } from "@/lib/demo-data";

export type LiveFeedMode = "For you" | "Hot" | "New" | "Top" | "Rising" | "Following" | "Bookmarks";
export type LiveComment = { id: string; body: string; createdAt: string; authorName: string; authorUsername: string };
export type LiveProjectMedia = { id: string; url: string; altText: string; position: number };
export type LiveProjectUpdate = { id: string; title: string; body: string; createdAt: string; authorName: string; authorUsername: string };
export type LiveProject = Project & {
  id: string;
  ownerId: string;
  createdAt: string;
  score: number;
  vote: -1 | 0 | 1;
  bookmarked: boolean;
  followingCreator: boolean;
  recentComments: LiveComment[];
  commentsCount: number;
  media?: LiveProjectMedia[];
  updates?: LiveProjectUpdate[];
  live: true;
};

export type LiveProjectRow = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  repository_url: string;
  demo_url: string | null;
  status: string;
  created_at: string;
  profiles: { username: string; display_name: string } | { username: string; display_name: string }[] | null;
  project_tags: { tag: string }[] | null;
  project_media?: Array<{ id: string; storage_path: string; alt_text: string; position: number }> | null;
};

export type LiveFeedSocialRows = {
  voteTotals: Array<{ project_id: string; score: number; upvotes: number; downvotes: number }>;
  userVotes: Array<{ project_id: string; value: number }>;
  commentTotals: Array<{ project_id: string; comment_count: number }>;
  comments: Array<{ id: string; project_id: string; body: string; created_at: string; author_id: string; profiles: { username: string; display_name: string } | { username: string; display_name: string }[] | null }>;
  bookmarks: Array<{ project_id: string }>;
  follows: Array<{ followed_id: string }>;
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function mapLiveProjectRows(rows: LiveProjectRow[], social: LiveFeedSocialRows): LiveProject[] {
  const totalsByProject = new Map(social.voteTotals.map((row) => [row.project_id, row]));
  const ownVotes = new Map(social.userVotes.map((row) => [row.project_id, row.value]));
  const commentTotals = new Map(social.commentTotals.map((row) => [row.project_id, row.comment_count]));
  const commentsByProject = new Map<string, LiveComment[]>();
  for (const comment of social.comments) {
    const author = relation(comment.profiles);
    const existing = commentsByProject.get(comment.project_id) ?? [];
    if (existing.length < 3) commentsByProject.set(comment.project_id, [...existing, {
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at,
      authorName: author?.display_name ?? "CodeBloom member",
      authorUsername: author?.username ?? "member",
    }]);
  }
  const bookmarks = new Set(social.bookmarks.map((row) => row.project_id));
  const follows = new Set(social.follows.map((row) => row.followed_id));

  return rows.map((row) => {
    const owner = relation(row.profiles);
    const author = owner?.display_name ?? "CodeBloom member";
    const totals = totalsByProject.get(row.id);
    const score = Number(totals?.score ?? 0);
    const created = new Date(row.created_at);
    const ageHours = Math.max(0, (Date.now() - created.getTime()) / 3_600_000);
    const time = Number.isFinite(ageHours) ? ageHours < 1 ? "just now" : ageHours < 24 ? `${Math.floor(ageHours)}h ago` : `${Math.floor(ageHours / 24)}d ago` : "recently";
    return {
      id: row.id,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      author,
      handle: owner?.username ?? "member",
      initials: author.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CB",
      avatarTone: "violet",
      tags: (row.project_tags ?? []).map((tag) => tag.tag),
      status: row.status === "published" ? "Published" : row.status,
      statusTone: "green",
      repo: row.repository_url.replace(/^https:\/\//, ""),
      ...(row.demo_url ? { demo: row.demo_url } : {}),
      votes: score,
      score,
      vote: ownVotes.get(row.id) === 1 || ownVotes.get(row.id) === -1 ? ownVotes.get(row.id)! as -1 | 1 : 0,
      comments: Number(commentTotals.get(row.id) ?? 0),
      commentsCount: Number(commentTotals.get(row.id) ?? 0),
      recentComments: commentsByProject.get(row.id) ?? [],
      time,
      art: "garden",
      bookmarked: bookmarks.has(row.id),
      followingCreator: follows.has(row.owner_id),
      live: true as const,
    };
  });
}

export function sortLiveFeed(projects: LiveProject[], mode: LiveFeedMode, query = ""): LiveProject[] {
  const normalized = query.trim().toLowerCase();
  const filtered = projects.filter((project) => (!normalized || [project.name, project.tagline, project.description, project.author, project.handle, project.repo, ...project.tags].join(" ").toLowerCase().includes(normalized)) && (mode !== "Following" || project.followingCreator));
  const ageHours = (project: LiveProject) => Math.max(0, (Date.now() - Date.parse(project.createdAt)) / 3_600_000);
  switch (mode) {
    case "New": return filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    case "Top": return filtered.sort((a, b) => b.score - a.score);
    case "Hot": return filtered.sort((a, b) => ((b.score + b.commentsCount * 2) / Math.pow(ageHours(b) + 2, 1.25)) - ((a.score + a.commentsCount * 2) / Math.pow(ageHours(a) + 2, 1.25)));
    case "Rising": return filtered.sort((a, b) => ((b.score + b.commentsCount * 4) / Math.pow(ageHours(b) + 1, 1.5)) - ((a.score + a.commentsCount * 4) / Math.pow(ageHours(a) + 1, 1.5)));
    case "Following":
    case "Bookmarks":
    case "For you": return filtered;
  }
}
