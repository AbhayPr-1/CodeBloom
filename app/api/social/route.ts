import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { socialActionSchema } from "@/lib/validation/social";

export async function GET(request: Request) {
  const creatorUsername = new URL(request.url).searchParams.get("creator");
  if (!creatorUsername || !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(creatorUsername)) return NextResponse.json({ error: "Choose a valid creator username." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view follow status." }, { status: 401 });
    const { data: creator, error: creatorError } = await supabase.from("profiles").select("id").eq("username", creatorUsername).maybeSingle();
    if (creatorError) return NextResponse.json({ error: "Unable to load this creator." }, { status: 503 });
    if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    const { data, error } = await supabase.from("creator_follows").select("follower_id").eq("follower_id", user.id).eq("followed_id", creator.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load follow status. Apply the live social migration." }, { status: 503 });
    return NextResponse.json({ following: Boolean(data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The social service is unavailable." }, { status: 503 });
  }
}

function originIsAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request) {
  if (!originIsAllowed(request)) return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  let input: ReturnType<typeof socialActionSchema.parse>;
  try { input = socialActionSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: "Check the social action and try again." }, { status: 400 }); }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to use project social actions." }, { status: 401 });

    if (input.action === "vote") {
      if (input.value === null) {
        const { error } = await supabase.from("project_votes").delete().eq("user_id", user.id).eq("project_id", input.projectId);
        if (error) return NextResponse.json({ error: "Unable to remove your vote." }, { status: 400 });
      } else {
        const { error } = await supabase.from("project_votes").upsert({ user_id: user.id, project_id: input.projectId, value: input.value }, { onConflict: "user_id,project_id" });
        if (error) return NextResponse.json({ error: "Unable to save your vote." }, { status: error.code === "42501" ? 403 : 400 });
      }
      return NextResponse.json({ action: "vote", value: input.value });
    }

    if (input.action === "bookmark") {
      const query = input.saved
        ? await supabase.from("bookmarks").upsert({ user_id: user.id, project_id: input.projectId }, { onConflict: "user_id,project_id", ignoreDuplicates: true })
        : await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("project_id", input.projectId);
      if (query.error) return NextResponse.json({ error: "Unable to update this bookmark." }, { status: query.error.code === "42501" ? 403 : 400 });
      return NextResponse.json({ action: "bookmark", saved: input.saved });
    }

    if (input.action === "follow") {
      const { data: creator, error: creatorError } = await supabase.from("profiles").select("id").eq("username", input.creatorUsername).maybeSingle();
      if (creatorError) return NextResponse.json({ error: "Unable to load this creator." }, { status: 503 });
      if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
      if (creator.id === user.id) return NextResponse.json({ error: "You cannot follow your own account." }, { status: 400 });
      const query = input.following
        ? await supabase.from("creator_follows").upsert({ follower_id: user.id, followed_id: creator.id }, { onConflict: "follower_id,followed_id", ignoreDuplicates: true })
        : await supabase.from("creator_follows").delete().eq("follower_id", user.id).eq("followed_id", creator.id);
      if (query.error) return NextResponse.json({ error: "Unable to update this follow." }, { status: query.error.code === "42501" ? 403 : 400 });
      return NextResponse.json({ action: "follow", following: input.following });
    }

    const { data, error } = await supabase.from("project_comments").insert({ project_id: input.projectId, author_id: user.id, body: input.body }).select("id, body, created_at, profiles!project_comments_author_id_fkey(username, display_name)").single();
    if (error) return NextResponse.json({ error: "Unable to add your comment. Check that the project is public and the live social migration is applied." }, { status: error.code === "42501" ? 403 : 400 });
    return NextResponse.json({ action: "comment", comment: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The social service is unavailable." }, { status: 503 });
  }
}
