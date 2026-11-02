import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { PublicProfile } from "@/lib/validation/profiles";

export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9][a-z0-9_-]{2,29}$/i.test(username) || !getSupabaseConfig()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name, bio, created_at")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (error || !data) return null;
    return {
      username: data.username,
      displayName: data.display_name,
      bio: data.bio ?? "",
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}
