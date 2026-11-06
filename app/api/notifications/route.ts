import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isOriginAllowed, checkRateLimit } from "@/lib/security";
import { getUserNotifications, markNotificationsAsRead } from "@/lib/notifications";

export async function GET() {
  const user = await getAuthenticatedUser();
  const effectiveUserId = user?.id || "demo-user-id";

  try {
    const data = await getUserNotifications(effectiveUserId);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve notifications." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  const effectiveUserId = user?.id || "demo-user-id";

  const rateCheck = checkRateLimit(`notif-patch:${effectiveUserId}`, 60, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { notificationId?: string; all?: boolean };
    const result = await markNotificationsAsRead(effectiveUserId, {
      notificationId: typeof body.notificationId === "string" ? body.notificationId : undefined,
      all: Boolean(body.all),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unable to update notification status." }, { status: 500 });
  }
}

