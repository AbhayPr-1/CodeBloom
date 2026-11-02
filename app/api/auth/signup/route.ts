import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { createSessionToken, setSessionCookie } from "@/lib/auth-session";

function originIsAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Authentication database is not configured." }, { status: 503 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  const emailNormalized = email.toLowerCase();

  try {
    const users = await getUsersCollection();
    const existing = await users.findOne({ emailNormalized });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    const localPart = email.split("@")[0] || "member";
    const cleanLocal = localPart.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 15) || "member";
    const usernameSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
    let username = `${cleanLocal}-${usernameSuffix}`;
    let usernameNormalized = username.toLowerCase();

    // Check if username collision (extremely rare with random suffix)
    const usernameTaken = await users.findOne({ usernameNormalized });
    if (usernameTaken) {
      username = `${cleanLocal}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
      usernameNormalized = username.toLowerCase();
    }

    const displayName = cleanLocal.charAt(0).toUpperCase() + cleanLocal.slice(1);
    const now = new Date().toISOString();

    const newUser = {
      _id: userId,
      id: userId,
      email,
      emailNormalized,
      passwordHash,
      username,
      usernameNormalized,
      displayName,
      bio: "",
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    await users.insertOne(newUser);

    const token = await createSessionToken({ id: userId, email, username });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        user: {
          id: userId,
          email,
          username,
          displayName,
        },
        session: true,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Unable to create account at this time." }, { status: 500 });
  }
}

