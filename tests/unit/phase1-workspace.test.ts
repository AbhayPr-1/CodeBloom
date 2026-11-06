import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock auth
const { getAuthenticatedUser } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthenticatedUser }));

// Import libraries
import { getUserNotifications, markNotificationsAsRead } from "@/lib/notifications";
import { listCommunities, getCommunityBySlug, toggleCommunityMembership } from "@/lib/communities";
import { getUserConversations, getConversationMessages, sendChatMessage } from "@/lib/messages";
import { getUserPreferences, updateUserPreferences, getUserSessions } from "@/lib/settings";

// Import API handlers
import { GET as getNotificationsRoute, PATCH as patchNotificationsRoute } from "@/app/api/notifications/route";
import { GET as getCommunitiesRoute, POST as postCommunitiesRoute } from "@/app/api/communities/route";
import { POST as postMessagesRoute } from "@/app/api/messages/route";
import { POST as changePasswordRoute } from "@/app/api/settings/password/route";
import { GET as getPreferencesRoute } from "@/app/api/settings/preferences/route";
import { GET as getSessionsRoute } from "@/app/api/settings/sessions/route";

const mockUser = {
  id: "test-user-id",
  email: "test@codebloom.dev",
  username: "testbuilder",
  displayName: "Test Builder",
  user_metadata: { user_name: "testbuilder", full_name: "Test Builder" },
};

describe("Phase 1: Workspace Modules & Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(mockUser);
  });

  describe("Notifications", () => {
    it("returns initial seed notifications for a user", async () => {
      const data = await getUserNotifications("user-notif-test");
      expect(data.notifications.length).toBeGreaterThan(0);
      expect(data.notifications[0]).toHaveProperty("type");
      expect(data.notifications[0]).toHaveProperty("message");
    });

    it("marks single notification as read", async () => {
      const data = await getUserNotifications("user-notif-test");
      const unread = data.notifications.find((n) => !n.read);
      if (unread) {
        const result = await markNotificationsAsRead("user-notif-test", { notificationId: unread.id });
        expect(result.success).toBe(true);
      }
    });

    it("marks all notifications as read", async () => {
      const result = await markNotificationsAsRead("user-notif-test", { all: true });
      expect(result.success).toBe(true);
      expect(result.unreadCount).toBe(0);
    });

    it("API route GET returns notifications payload", async () => {
      const res = await getNotificationsRoute();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.notifications)).toBe(true);
    });

    it("API route PATCH marks all as read", async () => {
      const req = new Request("http://localhost:3000/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ all: true }),
      });
      const res = await patchNotificationsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.unreadCount).toBe(0);
    });
  });

  describe("Communities", () => {
    it("lists all predefined community hubs", async () => {
      const list = await listCommunities("test-user-id");
      expect(list.length).toBeGreaterThanOrEqual(6);
      expect(list.some((c) => c.slug === "open-source")).toBe(true);
    });

    it("fetches single community by slug", async () => {
      const comm = await getCommunityBySlug("rust-systems", "test-user-id");
      expect(comm).not.toBeNull();
      expect(comm?.name).toContain("Rust");
    });

    it("toggles membership join and leave", async () => {
      const joinRes = await toggleCommunityMembership("test-user-id", "ai-agents", true);
      expect(joinRes.success).toBe(true);
      expect(joinRes.joined).toBe(true);

      const leaveRes = await toggleCommunityMembership("test-user-id", "ai-agents", false);
      expect(leaveRes.success).toBe(true);
      expect(leaveRes.joined).toBe(false);
    });

    it("API route GET returns all communities", async () => {
      const req = new Request("http://localhost:3000/api/communities");
      const res = await getCommunitiesRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.communities.length).toBeGreaterThanOrEqual(6);
    });

    it("API route POST joins community", async () => {
      const req = new Request("http://localhost:3000/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ slug: "devtools", action: "join" }),
      });
      const res = await postCommunitiesRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.joined).toBe(true);
    });
  });

  describe("Direct Messages", () => {
    it("returns conversations for user", async () => {
      const convs = await getUserConversations("test-user-id");
      expect(convs.length).toBeGreaterThan(0);
    });

    it("retrieves messages for conversation", async () => {
      const convs = await getUserConversations("test-user-id");
      const msgs = await getConversationMessages("test-user-id", convs[0].id);
      expect(msgs.length).toBeGreaterThan(0);
    });

    it("sends new message and appends to thread", async () => {
      const msg = await sendChatMessage(
        "test-user-id",
        { name: "Test Builder", username: "testbuilder" },
        "amiracodes",
        "Hello from automated unit test!"
      );
      expect(msg.body).toBe("Hello from automated unit test!");
      expect(msg.isOwn).toBe(true);
    });

    it("API route POST sends message", async () => {
      const req = new Request("http://localhost:3000/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ recipient: "jordanb", text: "Nice work on the tokens!" }),
      });
      const res = await postMessagesRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message.body).toBe("Nice work on the tokens!");
    });
  });

  describe("Account & Settings", () => {
    it("gets and updates user preferences", async () => {
      const initial = await getUserPreferences("test-user-id");
      expect(initial).toHaveProperty("emailOnVotes");

      const updated = await updateUserPreferences("test-user-id", { emailOnAnnouncements: true });
      expect(updated.emailOnAnnouncements).toBe(true);
    });

    it("returns active sessions with device info", () => {
      const sessions = getUserSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions[0].current).toBe(true);
    });

    it("rejects password change if new password is too short", async () => {
      const req = new Request("http://localhost:3000/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          currentPassword: "old-password",
          newPassword: "short",
          confirmPassword: "short",
        }),
      });
      const res = await changePasswordRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("at least 8 characters");
    });

    it("API route GET preferences returns user settings", async () => {
      const res = await getPreferencesRoute();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.preferences).toHaveProperty("emailOnVotes");
    });

    it("API route GET sessions returns list", async () => {
      const req = new Request("http://localhost:3000/api/settings/sessions");
      const res = await getSessionsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessions.length).toBeGreaterThan(0);
    });
  });
});

