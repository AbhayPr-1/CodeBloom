import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Project publishing is not configured." }, { status: 503 });

  try {
    const { slug } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to publish this project." }, { status: 401 });

    const { data: project, error: lookupError } = await supabase
      .from("projects")
      .select("id, slug, owner_id, status")
      .eq("slug", slug)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Unable to verify project ownership." }, { status: 503 });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (project.status === "published") return NextResponse.json({ project }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    if (project.status !== "draft") return NextResponse.json({ error: "Only a draft project can be published." }, { status: 409 });

    const { data: published, error: publishError } = await supabase
      .from("projects")
      .update({ status: "published" })
      .eq("id", project.id)
      .eq("owner_id", user.id)
      .eq("status", "draft")
      .select("id, slug, status")
      .maybeSingle();
    if (publishError) return NextResponse.json({ error: "The project could not be published." }, { status: 409 });
    if (!published) return NextResponse.json({ error: "This project changed before it could be published. Refresh and try again." }, { status: 409 });

    return NextResponse.json({ project: published }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The publishing service is unavailable." }, { status: 503 });
  }
}
