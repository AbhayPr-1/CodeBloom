import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";
import { isOriginAllowed } from "@/lib/security";

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}

