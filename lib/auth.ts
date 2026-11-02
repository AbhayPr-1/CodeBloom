import "server-only";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getUsersCollection } from "@/lib/mongodb/collections";
import { isMongoConfigured } from "@/lib/mongodb/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  user_metadata: {
    user_name: string;
    full_name: string;
  };
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!isMongoConfigured()) return null;

  try {
    const session = await getSessionFromCookies();
    if (!session || !session.sub) return null;

    const users = await getUsersCollection();
    const user = await users.findOne({
      $or: [{ id: session.sub }, { _id: session.sub }],
    });

    if (!user) return null;

    return {
      id: user.id || user._id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      user_metadata: {
        user_name: user.username,
        full_name: user.displayName,
      },
    };
  } catch {
    return null;
  }
}
