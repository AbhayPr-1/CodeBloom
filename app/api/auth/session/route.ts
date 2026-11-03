import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isMongoConfigured } from "@/lib/mongodb/client";

export async function GET() {
  const configured = isMongoConfigured();
  if (!configured) {
    return NextResponse.json({ user: null, configured: false }, { headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ user: null, configured: true }, { headers: { "Cache-Control": "private, no-store" } });
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
        },
        configured: true,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ user: null, configured: true }, { headers: { "Cache-Control": "private, no-store" } });
  }
}

