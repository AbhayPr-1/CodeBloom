import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { projectUpdateInputSchema } from "@/lib/validation/project-media";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Project updates are not configured." }, { status: 503 });
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Send a valid update." }, { status: 400 }); }
  const parsed = projectUpdateInputSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Use a title of 3–120 characters and a body of up to 4,000 characters." }, { status: 400 });

  try {
    const { slug } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to post a project update." }, { status: 401 });
    const { data: project, error: projectError } = await supabase.from("projects").select("id, owner_id").eq("slug", slug).eq("owner_id", user.id).maybeSingle();
    if (projectError) return NextResponse.json({ error: "Unable to verify project ownership." }, { status: 503 });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const { data: update, error: insertError } = await supabase.from("project_updates")
      .insert({ project_id: project.id, author_id: user.id, ...parsed.data })
      .select("id, title, body, created_at")
      .single();
    if (insertError || !update) return NextResponse.json({ error: "The update could not be saved." }, { status: 409 });
    return NextResponse.json({ update: { ...update, createdAt: update.created_at, authorName: "You", authorUsername: "you" } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The project update service is unavailable." }, { status: 503 });
  }
}
