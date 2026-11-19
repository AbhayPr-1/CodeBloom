import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

const protectedPaths = new Set([
  "/dashboard",
  "/publish",
  "/bookmarks",
  "/notifications",
  "/messages",
  "/settings",
  "/settings/profile",
]);

export async function proxy(request: NextRequest) {
  // Allow CodeBloom authenticated sessions through directly
  const codebloomSession = request.cookies.get("codebloom_session")?.value;
  if (codebloomSession) {
    return NextResponse.next({ request });
  }

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) return NextResponse.next({ request });
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refresh expired access tokens before Server Components read the session.
  let hasUser = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    hasUser = !error && Boolean(data.user);
  } catch {
    // Treat an unverifiable session as signed out on protected pages.
  }
  if (!hasUser && protectedPaths.has(request.nextUrl.pathname)) {
    const signInUrl = new URL("/login", request.url);
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(signInUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
