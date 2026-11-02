import "server-only";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";
import type { PublicProfile } from "@/lib/validation/profiles";

export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9][a-z0-9_-]{2,29}$/i.test(username) || !isMongoConfigured()) return null;

  try {
    const users = await getUsersCollection();
    const user = await users.findOne({ usernameNormalized: username.toLowerCase() });

    if (!user) return null;
    return {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio ?? "",
      createdAt: user.createdAt,
    };
  } catch {
    return null;
  }
}
