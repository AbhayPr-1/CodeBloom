import { NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { checkRateLimit, getClientIp, isOriginAllowed } from "@/lib/security";
import { buildPasswordResetEmailHtml, createPasswordResetToken, sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`forgot:${clientIp}`, 5, 900_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many password recovery requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      }
    );
  }

  try {
    let body: { email?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email || !email.includes("@") || email.length > 254) {
      return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (isMongoConfigured()) {
      try {
        const users = await getUsersCollection();
        const user = await users.findOne({ emailNormalized: email.toLowerCase() });

        if (user) {
          const token = createPasswordResetToken(user.email, user.id || user._id);
          const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
          await sendEmail({
            to: user.email,
            subject: "Reset your CodeBloom password",
            html: buildPasswordResetEmailHtml({ name: user.displayName || user.username, resetUrl }),
          });
        }
      } catch {
        // Fallback for development / demo account when Mongo is unreachable
        if (email.toLowerCase().includes("demo")) {
          const token = createPasswordResetToken(email, "demo-user-id");
          const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
          await sendEmail({
            to: email,
            subject: "Reset your CodeBloom password",
            html: buildPasswordResetEmailHtml({ name: "Demo Builder", resetUrl }),
          });
        }
      }
    } else if (email.toLowerCase().includes("demo")) {
      // Demo / development fallback
      const token = createPasswordResetToken(email, "demo-user-id");
      const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: email,
        subject: "Reset your CodeBloom password",
        html: buildPasswordResetEmailHtml({ name: "Demo Builder", resetUrl }),
      });
    }

    // Always return uniform generic response to eliminate account enumeration
    return NextResponse.json({
      message: "If an account exists for that email, a password recovery link is on its way.",
    });
  } catch {
    return NextResponse.json({ error: "Password recovery is currently unavailable." }, { status: 500 });
  }
}

