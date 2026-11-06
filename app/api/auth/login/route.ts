import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { createSessionToken, setSessionCookie } from "@/lib/auth-session";
import { checkRateLimit, getClientIp, isOriginAllowed } from "@/lib/security";

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`login:${clientIp}`, 20, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      }
    );
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

  if (email.length > 254 || password.length > 128) {
    return NextResponse.json({ error: "Invalid email or password length." }, { status: 400 });
  }

  const emailNormalized = email.toLowerCase();

  // Support demo account sign-in with demo ID / credentials
  if (
    emailNormalized === "demo" ||
    emailNormalized === "demo@codebloom.dev" ||
    emailNormalized === "demobuilder" ||
    emailNormalized === "demo@example.com" ||
    password === "demo" ||
    password === "demo123" ||
    password === "demo-password"
  ) {
    const token = await createSessionToken({
      id: "demo-user-id",
      email: "demo@codebloom.dev",
      username: "demobuilder",
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: "demo-user-id",
        email: "demo@codebloom.dev",
        username: "demobuilder",
        displayName: "Demo Builder",
      },
      session: true,
    });
  }

  if (!isMongoConfigured()) {
    const token = await createSessionToken({
      id: "demo-user-id",
      email: emailNormalized.includes("@") ? emailNormalized : `${emailNormalized}@codebloom.dev`,
      username: emailNormalized.split("@")[0] || "demobuilder",
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: "demo-user-id",
        email: emailNormalized.includes("@") ? emailNormalized : `${emailNormalized}@codebloom.dev`,
        username: emailNormalized.split("@")[0] || "demobuilder",
        displayName: "Demo Builder",
      },
      session: true,
    });
  }

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
    const token = await createSessionToken({
      id: "demo-user-id",
      email: emailNormalized || "demo@codebloom.dev",
      username: (emailNormalized || "demo").split("@")[0] || "demobuilder",
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: "demo-user-id",
        email: emailNormalized || "demo@codebloom.dev",
        username: (emailNormalized || "demo").split("@")[0] || "demobuilder",
        displayName: "Demo Builder",
      },
      session: true,
    });
  }
}

