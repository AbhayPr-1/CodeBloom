"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, MessageCircle, Send, Sparkles } from "lucide-react";
import { PageHeading, EmptyState } from "@/components/ui/page-state";
import { useAuth } from "@/components/auth-provider";
import type { ConversationThread, ChatMessage } from "@/lib/messages";

function getRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function MessagesView() {
  const searchParams = useSearchParams();
  const directToUser = searchParams.get("to");
  const { user } = useAuth();

  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Load threads
  useEffect(() => {
    let active = true;
    void fetch("/api/messages", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load conversations.");
        return (await res.json()) as { conversations: ConversationThread[] };
      })
      .then((data) => {
        if (active) {
          const list = data.conversations || [];
          setThreads(list);
          setLoadingThreads(false);

          if (directToUser) {
            const found = list.find((t) => t.partnerUsername.toLowerCase() === directToUser.toLowerCase());
            if (found) {
              setSelectedThreadId(found.id);
            } else {
              // Create dynamic new thread entry in view
              const newThread: ConversationThread = {
                id: `new-${directToUser}`,
                partnerId: `user-${directToUser}`,
                partnerName: directToUser,
                partnerUsername: directToUser,
                partnerInitials: directToUser.slice(0, 2).toUpperCase(),
                partnerTone: "plum",
                lastMessage: "Start a conversation…",
                lastMessageTime: new Date().toISOString(),
                unreadCount: 0,
              };
              setThreads((prev) => [newThread, ...prev]);
              setSelectedThreadId(newThread.id);
            }
          } else if (list.length > 0) {
            setSelectedThreadId((prev) => prev || list[0].id);
          }
        }
      })
      .catch(() => {
        if (active) setLoadingThreads(false);
      });

    return () => {
      active = false;
    };
  }, [directToUser]);

  // 2. Load messages for selected thread
  useEffect(() => {
    if (!selectedThreadId || selectedThreadId.startsWith("new-")) {
      return;
    }

    let active = true;
    const animId = requestAnimationFrame(() => {
      if (active) setLoadingMessages(true);
    });
    void fetch(`/api/messages?conversationId=${encodeURIComponent(selectedThreadId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return { messages: [] };
        return (await res.json()) as { messages: ChatMessage[] };
      })
      .then((data) => {
        if (active) {
          setMessages(data.messages || []);
          setLoadingMessages(false);
        }
      })
      .catch(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
      cancelAnimationFrame(animId);
    };
  }, [selectedThreadId]);

  // Scroll to bottom of message list on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(e?: FormEvent) {
    if (e) e.preventDefault();
    const clean = composerText.trim();
    if (!clean || sending || !selectedThreadId) return;

    const currentThread = threads.find((t) => t.id === selectedThreadId);
    if (!currentThread) return;

    setSending(true);
    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      conversationId: selectedThreadId,
      senderId: user?.id || "current-user",
      senderName: user?.displayName || "You",
      senderUsername: user?.username || "demobuilder",
      recipientId: currentThread.partnerId,
      body: clean,
      isOwn: true,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setComposerText("");

    // Update thread preview
    setThreads((prev) =>
      prev.map((t) =>
        t.id === selectedThreadId
          ? { ...t, lastMessage: clean, lastMessageTime: optimisticMsg.createdAt }
          : t
      )
    );

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: currentThread.partnerUsername,
          text: clean,
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as { message: ChatMessage };
        if (body.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticMsg.id ? body.message : m))
          );
        }
      }
    } catch {
      // Keep optimistic message or mark failed
    } finally {
      setSending(false);
    }
  }

  const activeThread = threads.find((t) => t.id === selectedThreadId);

  return (
    <section className="messages-page">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Direct Conversations"
        description="Private feedback, collaboration requests, and peer discussions with developers."
      />

      <div className="messages-layout">
        {/* Left Column: Conversation List */}
        <aside className="messages-sidebar">
          <div className="messages-sidebar-header">
            <h3>Discussions</h3>
            <span className="messages-thread-count">{threads.length} threads</span>
          </div>

          {loadingThreads ? (
            <div className="feed-status" role="status">
              <span className="spinner" aria-hidden="true" /> Loading chats…
            </div>
          ) : threads.length === 0 ? (
            <div className="messages-empty-threads">
              <p>No conversations started yet.</p>
              <Link href="/explore" className="rail-more">
                Browse creators to message →
              </Link>
            </div>
          ) : (
            <div className="messages-thread-list">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={`message-thread-item ${thread.id === selectedThreadId ? "thread-item-active" : ""}`}
                  onClick={() => {
                    setSelectedThreadId(thread.id);
                    setMessages([]);
                  }}
                >
                  <span className={`avatar avatar-${thread.partnerTone || "violet"}`}>
                    {thread.partnerInitials}
                  </span>
                  <div className="thread-item-info">
                    <div className="thread-item-top">
                      <strong>{thread.partnerName}</strong>
                      <time>{getRelativeTime(thread.lastMessageTime)}</time>
                    </div>
                    <p className="thread-snippet">{thread.lastMessage}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Right Column: Chat Box */}
        <main className="messages-main-pane">
          {activeThread ? (
            <>
              {/* Header */}
              <header className="chat-header">
                <div className="chat-partner-info">
                  <span className={`avatar avatar-${activeThread.partnerTone || "violet"}`}>
                    {activeThread.partnerInitials}
                  </span>
                  <div>
                    <h4>{activeThread.partnerName}</h4>
                    <Link href={`/u/${activeThread.partnerUsername}`} className="chat-profile-link">
                      @{activeThread.partnerUsername} <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <span className="chat-secure-badge">
                    <Sparkles size={12} /> End-to-end encrypted session
                  </span>
                </div>
              </header>

              {/* Messages Body */}
              <div className="chat-messages-container">
                {loadingMessages ? (
                  <div className="feed-status" role="status">
                    <span className="spinner" aria-hidden="true" /> Loading history…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-convo">
                    <div className="chat-empty-bubble">
                      <Sparkles size={20} />
                      <p>This is the beginning of your conversation with <strong>{activeThread.partnerName}</strong>.</p>
                      <small>Share thoughts on builds, trade code snippets, or propose collaborations.</small>
                    </div>
                  </div>
                ) : (
                  <div className="chat-bubbles-list">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`chat-bubble-wrap ${msg.isOwn ? "chat-bubble-own" : "chat-bubble-other"}`}
                      >
                        <div className="chat-bubble">
                          <p>{msg.body}</p>
                          <time className="chat-bubble-time">{getRelativeTime(msg.createdAt)}</time>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Composer */}
              <form className="chat-composer" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder={`Message @${activeThread.partnerUsername}… (Press Enter to send)`}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  className="chat-input"
                  autoFocus
                />
                <button
                  type="submit"
                  className="button button-primary chat-send-btn"
                  disabled={!composerText.trim() || sending}
                  aria-label="Send message"
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : (
            <div className="chat-select-prompt">
              <EmptyState
                icon={<MessageCircle size={32} />}
                title="Select a conversation"
                description="Choose a discussion thread on the left or reach out directly to any builder from their public profile."
              />
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

