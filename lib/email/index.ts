import crypto from "crypto";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getEmailSecret(): string {
  return process.env.AUTH_SECRET || "codebloom-email-secret-key-32chars";
}

/**
 * Generate a cryptographically signed, time-limited (15 mins) password reset token.
 */
export function createPasswordResetToken(email: string, userId: string): string {
  const secret = getEmailSecret();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  const payload = JSON.stringify({ email: email.toLowerCase(), sub: userId, exp: expiresAt });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify HMAC signature and expiration on a password recovery token.
 */
export function verifyPasswordResetToken(token: string): { valid: boolean; email?: string; userId?: string; error?: string } {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return { valid: false, error: "Invalid token format." };

    const [encodedPayload, signature] = parts;
    const secret = getEmailSecret();
    const expectedSignature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, error: "Invalid token signature." };
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      email: string;
      sub: string;
      exp: number;
    };

    if (Date.now() > payload.exp) {
      return { valid: false, error: "This password recovery link has expired. Please request a new one." };
    }

    return { valid: true, email: payload.email, userId: payload.sub };
  } catch {
    return { valid: false, error: "Malformed or invalid recovery token." };
  }
}

/**
 * Send an email via Resend API if configured, or log to console in local development.
 */
export async function sendEmail({ to, subject, html, text }: EmailPayload): Promise<EmailSendResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM || "CodeBloom <notifications@codebloom.dev>";

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, " ").trim(),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Email delivery failed: ${errorBody}` };
      }

      const data = (await response.json()) as { id: string };
      return { success: true, messageId: data.id };
    } catch (cause) {
      return { success: false, error: cause instanceof Error ? cause.message : "Network error delivering email" };
    }
  }

  // Development logger
  if (process.env.NODE_ENV !== "test") {
    console.log(`\n📧 [DEV EMAIL] To: ${to} | Subject: "${subject}"`);
  }

  return { success: true, messageId: `mock-email-${Date.now()}` };
}

/**
 * Branded HTML email template for password recovery.
 */
export function buildPasswordResetEmailHtml({ name, resetUrl }: { name: string; resetUrl: string }): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reset your CodeBloom password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0e12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0c0e12; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #16181f; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 36px 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-size: 18px; font-weight: 800; letter-spacing: -0.03em; color: #ffffff;">🌱 CodeBloom</span>
            </td>
          </tr>
          <tr>
            <td>
              <h1 style="margin: 0 0 14px; font-size: 22px; font-weight: 750; color: #ffffff; letter-spacing: -0.02em;">Password Recovery</h1>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #a1a1aa;">Hello ${name},</p>
              <p style="margin: 0 0 28px; font-size: 14px; line-height: 1.6; color: #a1a1aa;">We received a request to reset your CodeBloom password. Click the button below to choose a new password. This recovery link is valid for <strong>15 minutes</strong>.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center" style="border-radius: 9999px; background: linear-gradient(135deg, #7c3aed, #6366f1);">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 13px; font-weight: 650; color: #ffffff; text-decoration: none; border-radius: 9999px;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 12px; font-size: 12px; line-height: 1.5; color: #71717a;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin: 0 0 24px; font-size: 11px; line-height: 1.4; color: #8b5cf6; word-break: break-all;">${resetUrl}</p>
              <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;" />
              <p style="margin: 0; font-size: 11px; color: #71717a; line-height: 1.5;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

