import { isMongoConfigured } from "@/lib/mongodb/client";
import { getConversationsCollection, getMessagesCollection } from "@/lib/mongodb/collections";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  recipientId: string;
  body: string;
  isOwn: boolean;
  createdAt: string;
}

export interface ConversationThread {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerUsername: string;
  partnerInitials: string;
  partnerTone: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

// In-memory conversation state
interface MemoryStore {
  threads: ConversationThread[];
  messages: Map<string, ChatMessage[]>; // conversationId -> messages
}

const userMemoryStores = new Map<string, MemoryStore>();

function getInitialDemoStore(): MemoryStore {
  const now = Date.now();
  const thread1Id = "conv-amira";
  const thread2Id = "conv-jordan";

  const threads: ConversationThread[] = [
    {
      id: thread1Id,
      partnerId: "amira-user-id",
      partnerName: "Amira Chen",
      partnerUsername: "amiracodes",
      partnerInitials: "AC",
      partnerTone: "plum",
      lastMessage: "Thank you! Feel free to open a discussion or PR anytime. Glad you liked it!",
      lastMessageTime: new Date(now - 1000 * 60 * 35).toISOString(),
      unreadCount: 0,
    },
    {
      id: thread2Id,
      partnerId: "jordan-user-id",
      partnerName: "Jordan Blake",
      partnerUsername: "jordanb",
      partnerInitials: "JB",
      partnerTone: "blue",
      lastMessage: "Did you check out the new design system tokens update?",
      lastMessageTime: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
      unreadCount: 1,
    },
  ];

  const messages = new Map<string, ChatMessage[]>();

  messages.set(thread1Id, [
    {
      id: "msg-1",
      conversationId: thread1Id,
      senderId: "amira-user-id",
      senderName: "Amira Chen",
      senderUsername: "amiracodes",
      recipientId: "current-user",
      body: "Hey! Loved your recent project preview, would love to collaborate on the API!",
      isOwn: false,
      createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
    },
    {
      id: "msg-2",
      conversationId: thread1Id,
      senderId: "current-user",
      senderName: "You",
      senderUsername: "demobuilder",
      recipientId: "amira-user-id",
      body: "Thanks Amira! I was just exploring your Signal Garden codebase. The grouping algorithm is brilliant.",
      isOwn: true,
      createdAt: new Date(now - 1000 * 60 * 60).toISOString(),
    },
    {
      id: "msg-3",
      conversationId: thread1Id,
      senderId: "amira-user-id",
      senderName: "Amira Chen",
      senderUsername: "amiracodes",
      recipientId: "current-user",
      body: "Thank you! Feel free to open a discussion or PR anytime. Glad you liked it!",
      isOwn: false,
      createdAt: new Date(now - 1000 * 60 * 35).toISOString(),
    },
  ]);

  messages.set(thread2Id, [
    {
      id: "msg-4",
      conversationId: thread2Id,
      senderId: "jordan-user-id",
      senderName: "Jordan Blake",
      senderUsername: "jordanb",
      recipientId: "current-user",
      body: "Did you check out the new design system tokens update?",
      isOwn: false,
      createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
    },
  ]);

  return { threads, messages };
}

function getStore(userId: string): MemoryStore {
  if (!userMemoryStores.has(userId)) {
    userMemoryStores.set(userId, getInitialDemoStore());
  }
  return userMemoryStores.get(userId)!;
}

export async function getUserConversations(userId: string): Promise<ConversationThread[]> {
  if (isMongoConfigured()) {
    try {
      const convCollection = await getConversationsCollection();
      const docs = await convCollection.find({ participants: userId }).sort({ lastMessageAt: -1 }).toArray();
      if (docs.length > 0) {
        return docs.map((doc) => {
          const partner = doc.participantDetails.find((p) => p.id !== userId) || doc.participantDetails[0];
          const initials = (partner?.displayName || partner?.username || "CB").slice(0, 2).toUpperCase();
          return {
            id: doc.id,
            partnerId: partner?.id || "partner",
            partnerName: partner?.displayName || "Developer",
            partnerUsername: partner?.username || "developer",
            partnerInitials: initials,
            partnerTone: "violet",
            lastMessage: doc.lastMessageSnippet,
            lastMessageTime: doc.lastMessageAt,
            unreadCount: 0,
          };
        });
      }
    } catch {
      // Fall through to memory
    }
  }

  const store = getStore(userId);
  return store.threads;
}

export async function getConversationMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
  if (isMongoConfigured()) {
    try {
      const msgCollection = await getMessagesCollection();
      const docs = await msgCollection.find({ conversationId }).sort({ createdAt: 1 }).limit(100).toArray();
      if (docs.length > 0) {
        return docs.map((doc) => ({
          id: doc.id,
          conversationId: doc.conversationId,
          senderId: doc.senderId,
          senderName: doc.senderName,
          senderUsername: doc.senderUsername,
          recipientId: doc.recipientId,
          body: doc.body,
          isOwn: doc.senderId === userId,
          createdAt: doc.createdAt,
        }));
      }
    } catch {
      // Fall through to memory
    }
  }

  const store = getStore(userId);
  const msgs = store.messages.get(conversationId) || [];
  return msgs.map((m) => ({ ...m, isOwn: m.senderId === userId || m.senderId === "current-user" }));
}

export async function sendChatMessage(
  userId: string,
  sender: { name: string; username: string },
  recipientTarget: string, // conversationId or recipientUsername
  text: string
): Promise<ChatMessage> {
  const store = getStore(userId);
  let thread = store.threads.find((t) => t.id === recipientTarget || t.partnerUsername.toLowerCase() === recipientTarget.toLowerCase());

  if (!thread) {
    const threadId = `conv-${Date.now()}`;
    const cleanUsername = recipientTarget.replace("@", "");
    const initials = cleanUsername.slice(0, 2).toUpperCase();
    thread = {
      id: threadId,
      partnerId: `user-${cleanUsername}`,
      partnerName: cleanUsername,
      partnerUsername: cleanUsername,
      partnerInitials: initials,
      partnerTone: "plum",
      lastMessage: text,
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    };
    store.threads.unshift(thread);
    store.messages.set(threadId, []);
  }

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversationId: thread.id,
    senderId: userId,
    senderName: sender.name,
    senderUsername: sender.username,
    recipientId: thread.partnerId,
    body: text,
    isOwn: true,
    createdAt: new Date().toISOString(),
  };

  const currentMsgs = store.messages.get(thread.id) || [];
  currentMsgs.push(newMsg);
  store.messages.set(thread.id, currentMsgs);

  thread.lastMessage = text;
  thread.lastMessageTime = newMsg.createdAt;

  if (isMongoConfigured()) {
    try {
      const msgCollection = await getMessagesCollection();
      const convCollection = await getConversationsCollection();
      await msgCollection.insertOne({
        _id: newMsg.id,
        id: newMsg.id,
        conversationId: thread.id,
        senderId: userId,
        senderName: sender.name,
        senderUsername: sender.username,
        recipientId: thread.partnerId,
        recipientUsername: thread.partnerUsername,
        body: text,
        read: false,
        createdAt: newMsg.createdAt,
      });

      await convCollection.updateOne(
        { id: thread.id },
        {
          $set: {
            lastMessageSnippet: text,
            lastMessageAt: newMsg.createdAt,
          },
          $setOnInsert: {
            _id: thread.id,
            id: thread.id,
            participants: [userId, thread.partnerId],
            participantDetails: [
              { id: userId, username: sender.username, displayName: sender.name },
              { id: thread.partnerId, username: thread.partnerUsername, displayName: thread.partnerName },
            ],
            createdAt: newMsg.createdAt,
          },
        },
        { upsert: true }
      );
    } catch {
      // Memory store already updated
    }
  }

  return newMsg;
}

