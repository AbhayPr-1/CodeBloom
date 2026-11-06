import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthenticatedUser } from "@/lib/auth";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { checkRateLimit, getClientIp, isOriginAllowed } from "@/lib/security";
import { verifyPasswordResetToken } from "@/lib/email";

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`reset:${clientIp}`, 5, 300_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many password update requests. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      }
    );
  }

  try {
    let body: { password?: unknown; token?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const password = typeof body.password === "string" ? body.password : "";
    if (!password || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password must be between 8 and 128 characters long." }, { status: 400 });
    }

    let targetUserId: string | null = null;
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (token) {
      const verification = verifyPasswordResetToken(token);
      if (!verification.valid || !verification.userId) {
        return NextResponse.json({ error: verification.error || "Invalid or expired reset token." }, { status: 400 });
      }
      targetUserId = verification.userId;
    } else {
      const authUser = await getAuthenticatedUser();
      if (!authUser) {
        return NextResponse.json({ error: "Sign in or provide a valid reset token to update password." }, { status: 401 });
      }
      targetUserId = authUser.id;
    }

    if (!isMongoConfigured() || targetUserId === "demo-user-id") {
      // Demo / development fallback
      return NextResponse.json({ success: true, message: "Your password has been updated." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const users = await getUsersCollection();
    await users.updateOne(
      { $or: [{ id: targetUserId }, { _id: targetUserId }] },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true, message: "Your password has been updated." });
  } catch {
    return NextResponse.json({ error: "Unable to update password." }, { status: 500 });
  }
}

