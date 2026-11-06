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

export const DEMO_USER: AuthenticatedUser = {
  id: "demo-user-id",
  email: "demo@codebloom.dev",
  username: "demobuilder",
  displayName: "Demo Builder",
  user_metadata: {
    user_name: "demobuilder",
    full_name: "Demo Builder",
  },
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const session = await getSessionFromCookies();
    if (!session || !session.sub) return null;

    if (session.sub === DEMO_USER.id || session.email === DEMO_USER.email || session.username === DEMO_USER.username) {
      return DEMO_USER;
    }

    if (!isMongoConfigured()) {
      return {
        id: session.sub,
        email: session.email,
        username: session.username,
        displayName: session.username,
        user_metadata: {
          user_name: session.username,
          full_name: session.username,
        },
      };
    }

    try {
      const users = await getUsersCollection();
      const user = await users.findOne({
        $or: [{ id: session.sub }, { _id: session.sub }],
      });

      if (user) {
        return {
          id: user.id || user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName || user.username,
          user_metadata: {
            user_name: user.username,
            full_name: user.displayName || user.username,
          },
        };
      }
    } catch {
      // If MongoDB query times out or fails, respect the signed session token
    }

    return {
      id: session.sub,
      email: session.email,
      username: session.username,
      displayName: session.username,
      user_metadata: {
        user_name: session.username,
        full_name: session.username,
      },
    };
  } catch {
    return null;
  }
}
