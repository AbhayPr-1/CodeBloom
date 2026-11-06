import { NextResponse } from "next/server";
import { getMongoDb, isMongoConfigured } from "@/lib/mongodb/client";
import { ensureDatabaseIndexes } from "@/lib/mongodb/schema-init";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runMigration = url.searchParams.get("migrate") === "true";

  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: {
        configured: isMongoConfigured(),
        connected: false,
        latencyMs: -1,
        indexesCreated: 0,
      },
      storage: {
        provider: process.env.R2_ACCOUNT_ID ? "Cloudflare R2" : process.env.AWS_S3_BUCKET ? "AWS S3" : "Database GridFS / Local Fallback",
        configured: Boolean(process.env.R2_ACCOUNT_ID || process.env.AWS_S3_BUCKET || isMongoConfigured()),
      },
      email: {
        provider: process.env.RESEND_API_KEY ? "Resend" : process.env.SENDGRID_API_KEY ? "SendGrid" : "Development Logger",
        configured: Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY),
      },
      security: {
        authSecretConfigured: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET !== "codebloom-fallback-secret-2026-key-32chars"),
        siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      },
    },
  };

  if (isMongoConfigured()) {
    const startTime = Date.now();
    try {
      const db = await getMongoDb();
      await db.command({ ping: 1 });
      status.services.database.connected = true;
      status.services.database.latencyMs = Date.now() - startTime;

      if (runMigration) {
        const report = await ensureDatabaseIndexes(db);
        status.services.database.indexesCreated = report.filter((r) => r.status === "created").length;
      }
    } catch {
      status.services.database.connected = false;
      if (process.env.NODE_ENV === "production") {
        status.status = "degraded";
      }
    }
  }

  const httpStatus = status.status === "ok" ? 200 : 503;

  return NextResponse.json(status, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

