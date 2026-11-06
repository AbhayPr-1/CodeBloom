import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { profileUpdateSchema } from "@/lib/validation/profiles";
import { checkRateLimit, isOriginAllowed } from "@/lib/security";

function profileResponse(row: {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view your profile." }, { status: 401 });
  }

  if (!isMongoConfigured() || user.id === "demo-user-id") {
    return NextResponse.json(
      {
        profile: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: "Full-stack developer building open source tools and creative web experiences.",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  try {
    const users = await getUsersCollection();
    const doc = await users.findOne({
      $or: [{ id: user.id }, { _id: user.id }],
    });

    if (!doc) {
      return NextResponse.json({ error: "Your profile is not available." }, { status: 404 });
    }

    return NextResponse.json(
      { profile: profileResponse(doc) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        profile: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: "Full-stack developer building open source tools and creative web experiences.",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
}

export async function PATCH(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  let input: ReturnType<typeof profileUpdateSchema.parse>;
  try {
    input = profileUpdateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Please check the profile fields and try again." }, { status: 400 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  }

  const rateCheck = checkRateLimit(`profile:${user.id}`, 20, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many profile updates. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      }
    );
  }

  if (!isMongoConfigured() || user.id === "demo-user-id") {
    const now = new Date().toISOString();
    return NextResponse.json(
      {
        profile: {
          id: user.id,
          username: input.username || user.username,
          displayName: input.displayName || user.displayName,
          bio: input.bio || "",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: now,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  try {

    const users = await getUsersCollection();
    const newUsernameNormalized = input.username.toLowerCase();

    // Check if taken by another user
    const conflicting = await users.findOne({
      usernameNormalized: newUsernameNormalized,
      $nor: [{ id: user.id }, { _id: user.id }],
    });

    if (conflicting) {
      return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updateFields = {
      username: input.username,
      usernameNormalized: newUsernameNormalized,
      displayName: input.displayName,
      bio: input.bio || "",
      updatedAt: now,
    };

    const result = await users.findOneAndUpdate(
      { $or: [{ id: user.id }, { _id: user.id }] },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Your profile is not available." }, { status: 404 });
    }

    return NextResponse.json(
      { profile: profileResponse(result) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Profile service is unavailable." }, { status: 503 });
  }
}
