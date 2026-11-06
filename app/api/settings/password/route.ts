import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isOriginAllowed, checkRateLimit } from "@/lib/security";
import { changeUserPassword } from "@/lib/settings";

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to update your password." }, { status: 401 });
  }

  const rateCheck = checkRateLimit(`pwd-change:${user.id}`, 5, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many password attempts. Please wait a minute." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!body.currentPassword || typeof body.currentPassword !== "string") {
      return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
    }
    if (!body.newPassword || typeof body.newPassword !== "string" || body.newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters long." }, { status: 400 });
    }
    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: "The new passwords do not match." }, { status: 400 });
    }

    const result = await changeUserPassword(user.id, body.currentPassword, body.newPassword);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Unable to update password." }, { status: 400 });
    }

    return NextResponse.json({ message: "Password updated successfully." });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred while updating password." }, { status: 500 });
  }
}

