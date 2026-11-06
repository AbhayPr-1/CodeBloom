import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isOriginAllowed, checkRateLimit } from "@/lib/security";
import { getUserPreferences, updateUserPreferences, type UserPreferences } from "@/lib/settings";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view preferences." }, { status: 401 });
  }

  try {
    const preferences = await getUserPreferences(user.id);
    return NextResponse.json({ preferences });
  } catch {
    return NextResponse.json({ error: "Unable to load preferences." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to save preferences." }, { status: 401 });
  }

  const rateCheck = checkRateLimit(`prefs-post:${user.id}`, 30, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<UserPreferences>;
    const update: Partial<UserPreferences> = {};
    if (typeof body.emailOnVotes === "boolean") update.emailOnVotes = body.emailOnVotes;
    if (typeof body.emailOnComments === "boolean") update.emailOnComments = body.emailOnComments;
    if (typeof body.emailOnAnnouncements === "boolean") update.emailOnAnnouncements = body.emailOnAnnouncements;
    if (body.theme === "dark" || body.theme === "light" || body.theme === "system") update.theme = body.theme;

    const preferences = await updateUserPreferences(user.id, update);
    return NextResponse.json({ preferences, message: "Preferences saved successfully." });
  } catch {
    return NextResponse.json({ error: "Unable to update preferences." }, { status: 500 });
  }
}

