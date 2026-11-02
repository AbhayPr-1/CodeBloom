import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validation/profiles";

function profileResponse(row: { id: string; username: string; display_name: string; bio: string | null; created_at: string; updated_at: string }) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function originIsAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : { supabase, user: data.user };
}

export async function GET() {
  try {
    const session = await authenticatedClient();
    if (!session) return NextResponse.json({ error: "Sign in to view your profile." }, { status: 401 });

    const { data, error } = await session.supabase
      .from("profiles")
      .select("id, username, display_name, bio, created_at, updated_at")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: "Unable to load your profile." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "Your profile is not available. Check that the profiles migration is applied." }, { status: 404 });
    return NextResponse.json({ profile: profileResponse(data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Profile service is unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!originIsAllowed(request)) return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });

  let input: ReturnType<typeof profileUpdateSchema.parse>;
  try {
    input = profileUpdateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Please check the profile fields and try again." }, { status: 400 });
  }

  try {
    const session = await authenticatedClient();
    if (!session) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });

    const { data, error } = await session.supabase
      .from("profiles")
      .update({ username: input.username, display_name: input.displayName, bio: input.bio || null })
      .eq("id", session.user.id)
      .select("id, username, display_name, bio, created_at, updated_at")
      .maybeSingle();

    if (error?.code === "23505") return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    if (error) return NextResponse.json({ error: "Unable to save your profile. Check your values and database setup." }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Your profile is not available. Check that the profiles migration is applied." }, { status: 404 });
    return NextResponse.json({ profile: profileResponse(data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Profile service is unavailable." }, { status: 503 });
  }
}
