import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { mapLiveProjectRows, type LiveFeedSocialRows, type LiveProjectRow } from "@/lib/live-feed";

type Relation<T> = T | T[] | null;
type MediaRow = { id: string; storage_path: string; alt_text: string; position: number };
type UpdateRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  profiles: Relation<{ username: string; display_name: string }>;
};
type ProjectDetailRow = LiveProjectRow & { project_media: MediaRow[] | null; project_updates: UpdateRow[] | null };

const projectSelection = [
  "id, owner_id, slug, name, tagline, description, repository_url, demo_url, status, created_at",
  "profiles!projects_owner_id_fkey(username, display_name)",
  "project_tags(tag)",
  "project_media(id, storage_path, alt_text, position)",
  "project_updates(id, title, body, created_at, profiles!project_updates_author_id_fkey(username, display_name))",
].join(", ");

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const emptySocial: LiveFeedSocialRows = {
  voteTotals: [], userVotes: [], commentTotals: [], comments: [], bookmarks: [], follows: [],
};

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!getSupabaseConfig()) return NextResponse.json({ error: "The live project service is not configured." }, { status: 503 });
  const { slug } = await context.params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    // RLS returns public published projects to visitors and also lets each owner see their own drafts/private projects.
    const { data: row, error: projectError } = await supabase.from("projects").select(projectSelection).eq("slug", slug).maybeSingle();
    if (projectError) return NextResponse.json({ error: "Unable to load this project. Apply the reviewed Phase 4 migration." }, { status: 503 });
    if (!row) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const projectRow = row as unknown as ProjectDetailRow;
    const socialResults = await Promise.all([
      supabase.from("project_vote_totals").select("project_id, score, upvotes, downvotes").eq("project_id", projectRow.id),
      user ? supabase.from("project_votes").select("project_id, value").eq("user_id", user.id).eq("project_id", projectRow.id) : Promise.resolve({ data: [], error: null }),
      supabase.from("project_comment_totals").select("project_id, comment_count").eq("project_id", projectRow.id),
      supabase.from("project_comments").select("id, project_id, body, created_at, author_id, profiles!project_comments_author_id_fkey(username, display_name)").eq("project_id", projectRow.id).order("created_at", { ascending: false }).limit(3),
      user ? supabase.from("bookmarks").select("project_id").eq("user_id", user.id).eq("project_id", projectRow.id) : Promise.resolve({ data: [], error: null }),
      user ? supabase.from("creator_follows").select("followed_id").eq("follower_id", user.id) : Promise.resolve({ data: [], error: null }),
    ]);
    const social: LiveFeedSocialRows = socialResults.some((result) => result.error)
      ? emptySocial
      : {
          voteTotals: socialResults[0].data ?? [],
          userVotes: socialResults[1].data ?? [],
          commentTotals: socialResults[2].data ?? [],
          comments: socialResults[3].data ?? [],
          bookmarks: socialResults[4].data ?? [],
          follows: socialResults[5].data ?? [],
        } as LiveFeedSocialRows;
    const [liveProject] = mapLiveProjectRows([projectRow], social);

    const mediaRows = [...(projectRow.project_media ?? [])].sort((a, b) => a.position - b.position);
    let media: NonNullable<typeof liveProject.media> = [];
    if (mediaRows.length) {
      const { data: signedRows } = await supabase.storage.from("project-media").createSignedUrls(mediaRows.map((item) => item.storage_path), 3600);
      const signedByPath = new Map((signedRows ?? []).flatMap((item) => item.path && (item.signedUrl ?? item.signedURL) ? [[item.path, item.signedUrl ?? item.signedURL!] as const] : []));
      media = mediaRows.flatMap((item) => {
        const url = signedByPath.get(item.storage_path);
        return url ? [{ id: item.id, url, altText: item.alt_text, position: item.position }] : [];
      });
    }

    const updates = [...(projectRow.project_updates ?? [])]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((item) => {
        const author = relation(item.profiles);
        return { id: item.id, title: item.title, body: item.body, createdAt: item.created_at, authorName: author?.display_name ?? "Project owner", authorUsername: author?.username ?? "member" };
      });
    return NextResponse.json({ project: { ...liveProject, media, updates } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The live project service is unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Project cleanup is not configured." }, { status: 503 });
  try {
    const { slug } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to remove this draft." }, { status: 401 });
    const { data: project, error: lookupError } = await supabase.from("projects")
      .select("id, status, project_media(storage_path)")
      .eq("slug", slug).eq("owner_id", user.id).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Unable to verify draft ownership." }, { status: 503 });
    if (!project) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    if (project.status !== "draft") return NextResponse.json({ error: "Only an unpublished draft can be removed by this cleanup endpoint." }, { status: 409 });

    let requestedPaths: unknown = [];
    try { requestedPaths = (await request.json() as { storagePaths?: unknown }).storagePaths ?? []; } catch { /* Cleanup may be called with an empty body. */ }
    if (!Array.isArray(requestedPaths) || requestedPaths.some((path) => typeof path !== "string" || !path.startsWith(`${project.id}/${user.id}/`))) {
      return NextResponse.json({ error: "Cleanup paths must belong to this draft and account." }, { status: 400 });
    }
    const paths = [...new Set([...(project.project_media ?? []).map((media) => media.storage_path), ...requestedPaths as string[]])];
    if (paths.length > 5 || paths.some((path) => !new RegExp(`^${project.id}/${user.id}/[0-9a-f-]{36}\\.(png|jpg|webp)$`, "i").test(path))) {
      return NextResponse.json({ error: "The draft contains an unexpected media path." }, { status: 400 });
    }
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("project-media").remove(paths);
      if (storageError) return NextResponse.json({ error: "The draft's uploaded images could not be cleaned up." }, { status: 503 });
    }
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", project.id).eq("owner_id", user.id).eq("status", "draft");
    if (deleteError) return NextResponse.json({ error: "The private draft could not be removed." }, { status: 503 });
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The project cleanup service is unavailable." }, { status: 503 });
  }
}
