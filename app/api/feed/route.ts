import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { mapLiveProjectRows, sortLiveFeed, type LiveFeedMode, type LiveFeedSocialRows, type LiveProjectMedia, type LiveProjectRow } from "@/lib/live-feed";

const feedModes: LiveFeedMode[] = ["For you", "Hot", "New", "Top", "Rising", "Following", "Bookmarks"];
const projectSelection = "id, owner_id, slug, name, tagline, description, repository_url, demo_url, status, created_at, profiles!projects_owner_id_fkey(username, display_name), project_tags(tag), project_media(id, storage_path, alt_text, position)";

export async function GET(request: Request) {
  if (!getSupabaseConfig()) return NextResponse.json({ error: "The live project feed is not configured." }, { status: 503 });
  const url = new URL(request.url);
  const requestedMode = url.searchParams.get("mode") ?? "For you";
  if (!feedModes.includes(requestedMode as LiveFeedMode)) return NextResponse.json({ error: "Choose a supported feed mode." }, { status: 400 });
  const mode = requestedMode as LiveFeedMode;
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to load your dashboard feed." }, { status: 401 });

    let followedIds: string[] = [];
    if (mode === "Following") {
      const { data, error } = await supabase.from("creator_follows").select("followed_id").eq("follower_id", user.id);
      if (error) return NextResponse.json({ error: "Unable to load followed creators. Apply the live social migration." }, { status: 503 });
      followedIds = (data ?? []).map((row) => row.followed_id);
      if (followedIds.length === 0) return NextResponse.json({ projects: [], mode, source: "live" }, { headers: { "Cache-Control": "private, no-store" } });
    }
    let bookmarkedIds: string[] = [];
    if (mode === "Bookmarks") {
      const { data, error } = await supabase.from("bookmarks").select("project_id").eq("user_id", user.id);
      if (error) return NextResponse.json({ error: "Unable to load saved projects." }, { status: 503 });
      bookmarkedIds = (data ?? []).map((row) => row.project_id);
      if (bookmarkedIds.length === 0) return NextResponse.json({ projects: [], mode, source: "live" }, { headers: { "Cache-Control": "private, no-store" } });
    }

    let projectQuery = supabase.from("projects").select(projectSelection).eq("visibility", "public").eq("status", "published").order("created_at", { ascending: false }).limit(100);
    if (mode === "Following") projectQuery = projectQuery.in("owner_id", followedIds);
    if (mode === "Bookmarks") projectQuery = projectQuery.in("id", bookmarkedIds);
    const { data: projectRows, error: projectError } = await projectQuery;
    if (projectError) return NextResponse.json({ error: "Unable to load live projects." }, { status: 503 });
    const rows = (projectRows ?? []) as unknown as LiveProjectRow[];
    if (!rows.length) return NextResponse.json({ projects: [], mode, source: "live" }, { headers: { "Cache-Control": "private, no-store" } });
    const ids = rows.map((row) => row.id);
    const [voteTotalsResult, userVotesResult, commentTotalsResult, commentsResult, bookmarksResult, followsResult] = await Promise.all([
      supabase.from("project_vote_totals").select("project_id, score, upvotes, downvotes").in("project_id", ids),
      supabase.from("project_votes").select("project_id, value").eq("user_id", user.id).in("project_id", ids),
      supabase.from("project_comment_totals").select("project_id, comment_count").in("project_id", ids),
      supabase.from("project_comments").select("id, project_id, body, created_at, author_id, profiles!project_comments_author_id_fkey(username, display_name)").in("project_id", ids).order("created_at", { ascending: false }).limit(300),
      supabase.from("bookmarks").select("project_id").eq("user_id", user.id).in("project_id", ids),
      supabase.from("creator_follows").select("followed_id").eq("follower_id", user.id),
    ]);
    const aggregateError = voteTotalsResult.error ?? userVotesResult.error ?? commentTotalsResult.error ?? commentsResult.error ?? bookmarksResult.error ?? followsResult.error;
    if (aggregateError) return NextResponse.json({ error: "Live social data is unavailable. Apply the live social migration before using this feed." }, { status: 503 });
    const social = {
      voteTotals: voteTotalsResult.data ?? [],
      userVotes: userVotesResult.data ?? [],
      commentTotals: commentTotalsResult.data ?? [],
      comments: commentsResult.data ?? [],
      bookmarks: bookmarksResult.data ?? [],
      follows: followsResult.data ?? [],
    } as LiveFeedSocialRows;
    const mediaRows = rows.flatMap((row) => (row.project_media ?? []).map((media) => ({ ...media, project_id: row.id })));
    const signedByPath = new Map<string, string>();
    if (mediaRows.length) {
      const { data: signedRows, error: signingError } = await supabase.storage.from("project-media").createSignedUrls(mediaRows.map((item) => item.storage_path), 3600);
      if (!signingError) for (const item of signedRows ?? []) {
        const url = item.signedUrl ?? item.signedURL;
        if (item.path && url) signedByPath.set(item.path, url);
      }
    }
    const mediaByProject = new Map<string, LiveProjectMedia[]>();
    for (const item of mediaRows) {
      const url = signedByPath.get(item.storage_path);
      if (!url) continue;
      const projectMedia = mediaByProject.get(item.project_id) ?? [];
      projectMedia.push({ id: item.id, url, altText: item.alt_text, position: item.position });
      mediaByProject.set(item.project_id, projectMedia);
    }
    const projects = sortLiveFeed(mapLiveProjectRows(rows, social).map((project) => ({ ...project, media: mediaByProject.get(project.id) ?? [] })), mode, query);
    return NextResponse.json({ projects, mode, source: "live" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The live feed service is unavailable." }, { status: 503 });
  }
}
