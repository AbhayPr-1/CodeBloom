import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";

// Imports
import { ensureDatabaseIndexes, seedProductionDefaults } from "@/lib/mongodb/schema-init";
import { uploadMediaFile, getMediaFile, getStorageConfig } from "@/lib/storage";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
  sendEmail,
  buildPasswordResetEmailHtml,
} from "@/lib/email";
import { GET as getHealthRoute } from "@/app/api/health/route";

// Minimal valid PNG buffer (8-byte PNG signature + IHDR chunk)
const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

describe("Phase 2: Production Infrastructure & Persistence Cutover", () => {
  describe("Database Indexes & Seeding", () => {
    it("runs ensureDatabaseIndexes on a mock database", async () => {
      const mockCollection = {
        createIndex: vi.fn().mockResolvedValue("idx_created"),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      } as unknown as Db;

      const report = await ensureDatabaseIndexes(mockDb);
      expect(report.length).toBeGreaterThanOrEqual(15);
      expect(report.every((r) => r.status === "created")).toBe(true);
      expect(mockCollection.createIndex).toHaveBeenCalled();
    });

    it("seeds production defaults when projects collection is empty", async () => {
      const mockCollection = {
        countDocuments: vi.fn().mockResolvedValue(0),
        insertMany: vi.fn().mockResolvedValue({ insertedCount: 6 }),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      } as unknown as Db;

      const result = await seedProductionDefaults(mockDb);
      expect(result.seeded).toBe(true);
      expect(result.projectsCount).toBeGreaterThan(0);
      expect(mockCollection.insertMany).toHaveBeenCalled();
    });

    it("skips seeding if projects already exist", async () => {
      const mockCollection = {
        countDocuments: vi.fn().mockResolvedValue(42),
        insertMany: vi.fn(),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      } as unknown as Db;

      const result = await seedProductionDefaults(mockDb);
      expect(result.seeded).toBe(false);
      expect(result.projectsCount).toBe(42);
      expect(mockCollection.insertMany).not.toHaveBeenCalled();
    });
  });

  describe("Object Storage Adapter", () => {
    it("reports active storage configuration", () => {
      const config = getStorageConfig();
      expect(config).toHaveProperty("provider");
      expect(["r2", "s3", "database", "memory"]).toContain(config.provider);
    });

    it("rejects non-image or corrupt binary buffers", async () => {
      const fakeBuffer = Buffer.from("this is a plain text file pretending to be an image");
      await expect(uploadMediaFile(fakeBuffer, "test/path/img.png")).rejects.toThrow(
        /Only PNG, JPEG, and WebP images are allowed/
      );
    });

    it("successfully uploads and retrieves valid PNG image", async () => {
      const storagePath = `projects/demo/banner-${Date.now()}.png`;
      const result = await uploadMediaFile(validPngBuffer, storagePath, "image/png");

      expect(result.storagePath).toBe(storagePath);
      expect(result.contentType).toBe("image/png");
      expect(result.byteLength).toBe(validPngBuffer.length);
      expect(result.url).toContain(storagePath);

      // Verify retrieval
      const retrieved = await getMediaFile(storagePath);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.contentType).toBe("image/png");
      expect(retrieved?.buffer.length).toBe(validPngBuffer.length);
    });
  });

  describe("Transactional Email & Password Recovery Tokens", () => {
    it("generates and verifies HMAC-signed password reset token", () => {
      const email = "developer@codebloom.dev";
      const userId = "usr_123456";
      const token = createPasswordResetToken(email, userId);

      expect(token).toContain(".");
      const verification = verifyPasswordResetToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.email).toBe(email);
      expect(verification.userId).toBe(userId);
    });

    it("rejects tampered password reset token", () => {
      const token = createPasswordResetToken("test@example.com", "u1");
      const tampered = token.slice(0, -4) + "XXXX";

      const verification = verifyPasswordResetToken(tampered);
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });

    it("builds branded HTML email containing reset link", () => {
      const resetUrl = "https://codebloom.dev/reset-password?token=sample-token";
      const html = buildPasswordResetEmailHtml({ name: "Amira", resetUrl });

      expect(html).toContain("CodeBloom");
      expect(html).toContain("Amira");
      expect(html).toContain(resetUrl);
      expect(html).toContain("15 minutes");
    });

    it("delivers or logs transactional email without throwing", async () => {
      const res = await sendEmail({
        to: "builder@codebloom.dev",
        subject: "Welcome to the Garden",
        html: "<p>Welcome to CodeBloom!</p>",
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });
  });

  describe("Health & Diagnostics API", () => {
    it("returns system health report with 200 OK", async () => {
      const req = new Request("http://localhost:3000/api/health");
      const res = await getHealthRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.services).toHaveProperty("database");
      expect(json.services).toHaveProperty("storage");
      expect(json.services).toHaveProperty("email");
      expect(json.services).toHaveProperty("security");
    });
  });
});

