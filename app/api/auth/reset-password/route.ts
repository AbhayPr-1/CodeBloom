import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthenticatedUser } from "@/lib/auth";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";

export async function POST(request: Request) {
  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to update your password." }, { status: 401 });
    }

    const { password } = await request.json() as { password?: string };
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const users = await getUsersCollection();
    await users.updateOne(
      { $or: [{ id: user.id }, { _id: user.id }] },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true, message: "Your password has been updated." });
  } catch {
    return NextResponse.json({ error: "Unable to update password." }, { status: 500 });
  }
}

