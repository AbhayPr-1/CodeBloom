import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { inspectProjectImage, PROJECT_IMAGE_MAX_BYTES, projectMediaInputSchema } from "@/lib/validation/project-media";

const bucket = "project-media";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Project media is not configured." }, { status: 503 });

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Send valid project media metadata." }, { status: 400 }); }
  const parsed = projectMediaInputSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check each image, alt text, and display position." }, { status: 400 });

  try {
    const { slug } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to add project media." }, { status: 401 });

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, owner_id, status")
      .eq("slug", slug)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (projectError) return NextResponse.json({ error: "Unable to verify project ownership." }, { status: 503 });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const media = parsed.data.media;
    const prefix = `${project.id}/${user.id}/`;
    if (media.some((item) => !item.storagePath.startsWith(prefix))) {
      return NextResponse.json({ error: "An uploaded image does not belong to this project and account." }, { status: 403 });
    }

    for (const item of media) {
      const { data: info, error: infoError } = await supabase.storage.from(bucket).info(item.storagePath);
      if (infoError || !info || typeof info.size !== "number" || info.size < 1 || info.size > PROJECT_IMAGE_MAX_BYTES) {
        return NextResponse.json({ error: "An uploaded image is missing or exceeds the 5 MB limit." }, { status: 400 });
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(info.contentType ?? "")) {
        return NextResponse.json({ error: "Only PNG, JPEG, and WebP screenshots are allowed." }, { status: 400 });
      }
      const { data: file, error: downloadError } = await supabase.storage.from(bucket).download(item.storagePath);
      if (downloadError || !file) return NextResponse.json({ error: "Unable to verify an uploaded image." }, { status: 400 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = inspectProjectImage(bytes);
      if (!detected || detected.mime !== info.contentType || !item.storagePath.endsWith(`.${detected.extension}`)) {
        return NextResponse.json({ error: "An uploaded file's contents do not match its image type." }, { status: 400 });
      }
    }

    if (media.length) {
      const rows = media.map(({ storagePath, altText, position }) => ({
        project_id: project.id,
        storage_path: storagePath,
        alt_text: altText,
        position,
      }));
      const { error: insertError } = await supabase.from("project_media").insert(rows);
      if (insertError) return NextResponse.json({ error: "Unable to attach screenshots to this project." }, { status: 409 });
    }

    return NextResponse.json({ media: media.length }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The project media service is unavailable." }, { status: 503 });
  }
}
