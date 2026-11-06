"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Flame, MessageSquare, Sparkles, UserPlus } from "lucide-react";
import { PageHeading, EmptyState } from "@/components/ui/page-state";
import type { NotificationItem } from "@/lib/notifications";

function getRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

function getNotificationIcon(type: NotificationItem["type"]) {
  switch (type) {
    case "vote":
      return <Flame size={15} className="notif-icon notif-icon-vote" />;
    case "comment":
      return <MessageSquare size={15} className="notif-icon notif-icon-comment" />;
    case "follow":
      return <UserPlus size={15} className="notif-icon notif-icon-follow" />;
    case "update":
      return <Sparkles size={15} className="notif-icon notif-icon-update" />;
    case "welcome":
    default:
      return <Sparkles size={15} className="notif-icon notif-icon-welcome" />;
  }
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/notifications", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load notifications.");
        return (await res.json()) as { notifications: NotificationItem[]; unreadCount: number };
      })
      .then((data) => {
        if (active) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load notifications.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleMarkAllAsRead() {
    if (actionBusy || unreadCount === 0) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      // ignore
    } finally {
      setActionBusy(false);
    }
  }

  async function handleMarkSingleRead(id: string) {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch {
      // rollback if needed
    }
  }

  const displayed = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <section className="notifications-page">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Activity & Notifications"
        description="Updates, discussions, and appreciations from the CodeBloom community."
        action={
          unreadCount > 0 ? (
            <button
              type="button"
              className="button button-outline"
              onClick={handleMarkAllAsRead}
              disabled={actionBusy}
            >
              <CheckCheck size={14} /> Mark all as read
            </button>
          ) : undefined
        }
      />

      <div className="feed-filter-bar notif-tabs">
        <button
          type="button"
          className={`filter-pill ${filter === "all" ? "filter-pill-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Activity
        </button>
        <button
          type="button"
          className={`filter-pill ${filter === "unread" ? "filter-pill-active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          Unread {unreadCount > 0 && <span className="notif-pill-badge">{unreadCount}</span>}
        </button>
      </div>

      {loading ? (
        <div className="feed-status" role="status">
          <span className="spinner" aria-hidden="true" /> Loading activity stream…
        </div>
      ) : error ? (
        <p className="error-banner" role="alert">{error}</p>
      ) : displayed.length === 0 ? (
        filter === "unread" ? (
          <EmptyState
            icon={<CheckCheck size={26} />}
            title="All caught up!"
            description="You don't have any unread notifications right now."
            action={
              <button type="button" className="button button-outline" onClick={() => setFilter("all")}>
                View all activity
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<Bell size={26} />}
            title="No activity yet"
            description="When people appreciate your builds, comment on your updates, or follow your work, you will see it here."
            action={
              <Link className="button button-primary" href="/explore">
                Explore garden projects
              </Link>
            }
          />
        )
      ) : (
        <div className="notif-list">
          {displayed.map((item) => (
            <article
              key={item.id}
              className={`notif-card ${!item.read ? "notif-unread" : ""}`}
              onClick={() => void handleMarkSingleRead(item.id)}
            >
              <div className="notif-card-main">
                <div className="notif-badge-col">
                  {getNotificationIcon(item.type)}
                </div>
                <div className="notif-content">
                  <div className="notif-meta">
                    <Link
                      href={`/u/${item.actorUsername}`}
                      className="notif-actor"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.actorName}
                    </Link>
                    <span className="notif-username">@{item.actorUsername}</span>
                    <span className="notif-dot-sep">·</span>
                    <time className="notif-time">{getRelativeTime(item.createdAt)}</time>
                  </div>
                  <p className="notif-message">
                    {item.message}
                    {item.projectSlug && (
                      <Link
                        href={`/projects/${item.projectSlug}`}
                        className="notif-project-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.projectName || item.projectSlug} →
                      </Link>
                    )}
                  </p>
                </div>
              </div>
              {!item.read && <span className="notif-unread-dot" title="Unread notification" />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

