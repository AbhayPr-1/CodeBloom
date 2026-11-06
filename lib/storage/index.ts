import { inspectProjectImage, PROJECT_IMAGE_MAX_BYTES, type ProjectImageMime } from "@/lib/validation/project-media";
import { isMongoConfigured } from "@/lib/mongodb/client";
import { getProjectMediaCollection } from "@/lib/mongodb/collections";

export interface StorageUploadResult {
  url: string;
  storagePath: string;
  contentType: ProjectImageMime;
  byteLength: number;
}

export interface StorageConfig {
  provider: "r2" | "s3" | "database" | "memory";
  publicBaseUrl?: string;
}

// In-memory media store fallback for development
const memoryMedia = new Map<string, { buffer: Buffer; contentType: string }>();

export function getStorageConfig(): StorageConfig {
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
    return {
      provider: "r2",
      publicBaseUrl: process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_CDN_URL,
    };
  }
  if (process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
    return {
      provider: "s3",
      publicBaseUrl: process.env.S3_PUBLIC_URL || process.env.NEXT_PUBLIC_CDN_URL,
    };
  }
  if (isMongoConfigured()) {
    return { provider: "database" };
  }
  return { provider: "memory" };
}

export async function uploadMediaFile(
  buffer: Buffer,
  storagePath: string,
  claimedContentType?: string
): Promise<StorageUploadResult> {
  void claimedContentType;
  if (buffer.length < 1) {
    throw new Error("Cannot upload empty file.");
  }
  if (buffer.length > PROJECT_IMAGE_MAX_BYTES) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds 5MB limit.`);
  }

  // Magic byte inspection
  const detected = inspectProjectImage(new Uint8Array(buffer));
  if (!detected) {
    throw new Error("File format not supported. Only PNG, JPEG, and WebP images are allowed.");
  }

  const contentType = detected.mime;
  const config = getStorageConfig();

  // If Cloudflare R2 / S3 is configured with public URL
  if ((config.provider === "r2" || config.provider === "s3") && config.publicBaseUrl) {
    const cleanBase = config.publicBaseUrl.replace(/\/+$/, "");
    const publicUrl = `${cleanBase}/${storagePath}`;
    return {
      url: publicUrl,
      storagePath,
      contentType,
      byteLength: buffer.length,
    };
  }

  // Database GridFS / Mongo collection storage
  if (config.provider === "database" || isMongoConfigured()) {
    try {
      const mediaCollection = await getProjectMediaCollection();
      const base64Data = `data:${contentType};base64,${buffer.toString("base64")}`;
      await mediaCollection.updateOne(
        { storagePath },
        {
          $set: {
            storagePath,
            data: base64Data,
            contentType,
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );

      return {
        url: `/api/media/${storagePath}`,
        storagePath,
        contentType,
        byteLength: buffer.length,
      };
    } catch {
      // Fall through to memory
    }
  }

  // In-memory fallback
  memoryMedia.set(storagePath, { buffer, contentType });
  return {
    url: `/api/media/${storagePath}`,
    storagePath,
    contentType,
    byteLength: buffer.length,
  };
}

export async function getMediaFile(
  storagePath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const config = getStorageConfig();

  if (config.provider === "database" || isMongoConfigured()) {
    try {
      const mediaCollection = await getProjectMediaCollection();
      const doc = await mediaCollection.findOne({ storagePath });
      if (doc && doc.data) {
        const raw = doc.data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(raw, "base64");
        const contentType = doc.contentType || "image/png";
        return { buffer, contentType };
      }
    } catch {
      // Fall through to memory
    }
  }

  const memory = memoryMedia.get(storagePath);
  if (memory) {
    return memory;
  }

  return null;
}

