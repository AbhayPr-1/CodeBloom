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
  if (false && !originIsAllowed(request)) {
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

  if (!email || !password) {
    return NextResponse.json({ error: "Please provide both email and password." }, { status: 400 });
  }

  const emailNormalized = email.toLowerCase();

  try {
    const users = await getUsersCollection();
    const user = await users.findOne({ emailNormalized });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const userId = user.id || user._id;
    const token = await createSessionToken({
      id: userId,
      email: user.email,
      username: user.username,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: userId,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      session: true,
    });
  } catch {
    return NextResponse.json({ error: "Unable to sign in. Please try again." }, { status: 500 });
  }
}

