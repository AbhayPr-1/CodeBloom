import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectInputSchema } from "@/lib/validation/projects";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("projects").select("id, slug, name, tagline, description, repository_url, demo_url, status, created_at, profiles!projects_owner_id_fkey(username, display_name), project_tags(tag)").eq("visibility", "public").eq("status", "published").order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: "Unable to load public projects." }, { status: 503 });
    return NextResponse.json({ projects: data }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
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
  if (!parsed.success) return NextResponse.json({ error: "Please correct the project fields and use safe HTTPS links." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to publish a project." }, { status: 401 });

    const input = parsed.data;
    const slugBase = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    const slug = `${slugBase}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const { data, error } = await supabase.rpc("create_project_draft_with_tags", {
      p_name: input.name,
      p_slug: slug,
      p_tagline: input.tagline,
      p_description: input.description,
      p_repository_url: input.repositoryUrl,
      p_demo_url: input.demoUrl || null,
      p_tags: input.tags,
    });

    if (error) {
      if (error.code === "42501") return NextResponse.json({ error: "Your account is not allowed to publish this project." }, { status: 403 });
      return NextResponse.json({ error: "The project draft could not be saved. Apply the reviewed Phase 4 migration before publishing." }, { status: 400 });
    }
    const project = data?.[0];
    if (!project) return NextResponse.json({ error: "The project was not created. Please try again." }, { status: 500 });
    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Project service is unavailable." }, { status: 503 });
  }
}
