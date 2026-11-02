import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { authCallbackRedirectUrl, safeAuthDestination } from "@/lib/auth-destination";

export async function GET(request: NextRequest) {
  const destination = safeAuthDestination(request.nextUrl.searchParams.get("next"));
  const signupConfirmation = request.nextUrl.searchParams.get("flow") === "signup";
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !getSupabaseConfig()) return NextResponse.redirect(new URL("/login?auth_error=callback", request.url));
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?auth_error=callback", request.url));
    return NextResponse.redirect(authCallbackRedirectUrl(request.url, destination, signupConfirmation));
  } catch {
    return NextResponse.redirect(new URL("/login?auth_error=callback", request.url));
  }
}
