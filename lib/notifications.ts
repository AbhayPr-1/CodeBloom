import { isMongoConfigured } from "@/lib/mongodb/client";
import { getNotificationsCollection } from "@/lib/mongodb/collections";

export interface NotificationItem {
  id: string;
  type: "vote" | "comment" | "follow" | "update" | "welcome";
  actorName: string;
  actorUsername: string;
  message: string;
  projectSlug?: string;
  projectName?: string;
  read: boolean;
  createdAt: string;
}

// In-memory fallback notifications for development / demo mode
const memoryNotifications = new Map<string, NotificationItem[]>();

function getInitialDemoNotifications(): NotificationItem[] {
  const now = Date.now();
  return [
    {
      id: "notif-1",
      type: "vote",
      actorName: "Amira Chen",
      actorUsername: "amiracodes",
      message: "appreciated your project Signal Garden.",
      projectSlug: "signal-garden",
      projectName: "Signal Garden",
      read: false,
      createdAt: new Date(now - 1000 * 60 * 12).toISOString(), // 12 mins ago
    },
    {
      id: "notif-2",
      type: "comment",
      actorName: "Jordan Blake",
      actorUsername: "jordanb",
      message: "commented: \"The state synchronization pattern here is exceptionally clean!\"",
      projectSlug: "ledger-leaf",
      projectName: "Ledger Leaf",
      read: false,
      createdAt: new Date(now - 1000 * 60 * 75).toISOString(), // 1 hour ago
    },
    {
      id: "notif-3",
      type: "follow",
      actorName: "Elena Rostova",
      actorUsername: "erostova",
      message: "started following your open-source builds.",
      read: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 22).toISOString(), // 22 hours ago
    },
    {
      id: "notif-4",
      type: "welcome",
      actorName: "CodeBloom Garden",
      actorUsername: "codebloom",
      message: "Welcome to CodeBloom! Explore thoughtful projects, share lessons, and plant your ideas.",
      read: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    },
  ];
}

export async function getUserNotifications(userId: string): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  if (isMongoConfigured()) {
    try {
      const collection = await getNotificationsCollection();
      const docs = await collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      if (docs.length > 0) {
        const notifications: NotificationItem[] = docs.map((doc) => ({
          id: doc.id,
          type: doc.type,
          actorName: doc.actorName,
          actorUsername: doc.actorUsername,
          message: doc.message,
          projectSlug: doc.projectSlug,
          projectName: doc.projectName,
          read: doc.read,
          createdAt: doc.createdAt,
        }));
        const unreadCount = notifications.filter((n) => !n.read).length;
        return { notifications, unreadCount };
      }
    } catch {
      // Fall through to memory fallback
    }
  }

  if (!memoryNotifications.has(userId)) {
    memoryNotifications.set(userId, getInitialDemoNotifications());
  }

  const items = memoryNotifications.get(userId) || [];
  const unreadCount = items.filter((n) => !n.read).length;
  return { notifications: [...items], unreadCount };
}

export async function markNotificationsAsRead(
  userId: string,
  options: { notificationId?: string; all?: boolean }
): Promise<{ success: boolean; unreadCount: number }> {
  if (isMongoConfigured()) {
    try {
      const collection = await getNotificationsCollection();
      if (options.all) {
        await collection.updateMany({ userId, read: false }, { $set: { read: true } });
      } else if (options.notificationId) {
        await collection.updateOne({ userId, id: options.notificationId }, { $set: { read: true } });
      }
      const remainingUnread = await collection.countDocuments({ userId, read: false });
      return { success: true, unreadCount: remainingUnread };
    } catch {
      // Fall through to memory
    }
  }

  if (!memoryNotifications.has(userId)) {
    memoryNotifications.set(userId, getInitialDemoNotifications());
  }

  const list = memoryNotifications.get(userId) || [];
  if (options.all) {
    for (const item of list) {
      item.read = true;
    }
  } else if (options.notificationId) {
    const target = list.find((n) => n.id === options.notificationId);
    if (target) target.read = true;
  }

  const unreadCount = list.filter((n) => !n.read).length;
  return { success: true, unreadCount };
}

export async function addNotification(
  userId: string,
  notification: Omit<NotificationItem, "id" | "createdAt" | "read">
): Promise<NotificationItem> {
  const item: NotificationItem = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (isMongoConfigured()) {
    try {
      const collection = await getNotificationsCollection();
      await collection.insertOne({
        _id: item.id,
        id: item.id,
        userId,
        actorId: "actor",
        actorName: item.actorName,
        actorUsername: item.actorUsername,
        type: item.type,
        projectId: item.projectSlug,
        projectSlug: item.projectSlug,
        projectName: item.projectName,
        message: item.message,
        read: false,
        createdAt: item.createdAt,
      });
      return item;
    } catch {
      // Fall through to memory
    }
  }

  if (!memoryNotifications.has(userId)) {
    memoryNotifications.set(userId, getInitialDemoNotifications());
  }
  const list = memoryNotifications.get(userId) || [];
  list.unshift(item);
  return item;
}

