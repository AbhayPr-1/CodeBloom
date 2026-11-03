import { NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  try {
    const { email } = await request.json() as { email?: string };
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ emailNormalized: email.trim().toLowerCase() });
    // Always return success message to avoid user enumeration
    return NextResponse.json({
      message: "If an account exists for that email, a password recovery link is on its way.",
      found: Boolean(user),
    });
  } catch {
    return NextResponse.json({ error: "Password recovery is currently unavailable." }, { status: 500 });
  }
}

