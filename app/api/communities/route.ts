import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isOriginAllowed, checkRateLimit } from "@/lib/security";
import { listCommunities, getCommunityBySlug, toggleCommunityMembership } from "@/lib/communities";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const user = await getAuthenticatedUser();

  try {
    if (slug) {
      const community = await getCommunityBySlug(slug, user?.id);
      if (!community) {
        return NextResponse.json({ error: "Community not found." }, { status: 404 });
      }
      return NextResponse.json({ community });
    }

    const communities = await listCommunities(user?.id);
    return NextResponse.json({ communities });
  } catch {
    return NextResponse.json({ error: "Unable to load communities." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to join communities." }, { status: 401 });
  }

  const rateCheck = checkRateLimit(`comm-post:${user.id}`, 30, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { slug?: string; action?: "join" | "leave" };
    if (!body.slug || typeof body.slug !== "string") {
      return NextResponse.json({ error: "A valid community slug is required." }, { status: 400 });
    }

    const action = body.action === "leave" ? "leave" : "join";
    const result = await toggleCommunityMembership(user.id, body.slug, action === "join");
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Unable to update community membership." },
      { status: 400 }
    );
  }
}

