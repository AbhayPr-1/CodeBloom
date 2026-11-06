import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isMongoConfigured } from "@/lib/mongodb/client";

export async function GET() {
  const configured = isMongoConfigured();

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ user: null, configured }, { headers: { "Cache-Control": "private, no-store" } });
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
        },
        configured,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ user: null, configured }, { headers: { "Cache-Control": "private, no-store" } });
  }
}

