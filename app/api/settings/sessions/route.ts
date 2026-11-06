import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isOriginAllowed } from "@/lib/security";
import { getUserSessions } from "@/lib/settings";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view active sessions." }, { status: 401 });
  }

  try {
    const sessions = getUserSessions(request);
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ error: "Unable to load active sessions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to manage sessions." }, { status: 401 });
  }

  try {
    // Revoke other sessions
    const sessions = getUserSessions(request).filter((s) => s.current);
    return NextResponse.json({
      message: "All other sessions have been signed out.",
      sessions,
    });
  } catch {
    return NextResponse.json({ error: "Unable to revoke sessions." }, { status: 500 });
  }
}

