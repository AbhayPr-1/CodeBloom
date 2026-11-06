import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isOriginAllowed, checkRateLimit } from "@/lib/security";
import { getUserConversations, getConversationMessages, sendChatMessage } from "@/lib/messages";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  const effectiveUserId = user?.id || "demo-user-id";

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  try {
    if (conversationId) {
      const messages = await getConversationMessages(effectiveUserId, conversationId);
      return NextResponse.json({ messages });
    }

    const conversations = await getUserConversations(effectiveUserId);
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ error: "Unable to load messages." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  const effectiveUser = user || {
    id: "demo-user-id",
    displayName: "Demo Builder",
    username: "demobuilder",
  };

  const rateCheck = checkRateLimit(`msg-post:${effectiveUser.id}`, 30, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many messages sent. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { recipient?: string; text?: string };
    if (!body.recipient || typeof body.recipient !== "string") {
      return NextResponse.json({ error: "Choose a recipient to message." }, { status: 400 });
    }

    const cleanText = (body.text || "").trim();
    if (!cleanText || cleanText.length > 2000) {
      return NextResponse.json({ error: "Message text must be between 1 and 2,000 characters." }, { status: 400 });
    }

    const message = await sendChatMessage(
      effectiveUser.id,
      { name: effectiveUser.displayName || effectiveUser.username, username: effectiveUser.username },
      body.recipient,
      cleanText
    );

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: "Unable to send message." }, { status: 500 });
  }
}

