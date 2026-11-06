import type { Db, IndexSpecification, OptionalUnlessRequiredId, Document } from "mongodb";
import { getMongoDb, isMongoConfigured } from "./client";
import { projects } from "@/lib/demo-data";

export interface DatabaseIndexReport {
  collection: string;
  index: string;
  status: "created" | "existing" | "error";
  error?: string;
}

export async function ensureDatabaseIndexes(database?: Db): Promise<DatabaseIndexReport[]> {
  if (!isMongoConfigured() && !database) {
    return [];
  }

  const db = database || (await getMongoDb());
  const report: DatabaseIndexReport[] = [];

  const indexDefinitions = [
    // Users
    {
      collection: "users",
      spec: { emailNormalized: 1 },
      options: { unique: true, name: "idx_users_email_unique" },
    },
    {
      collection: "users",
      spec: { usernameNormalized: 1 },
      options: { unique: true, name: "idx_users_username_unique" },
    },
    // Projects
    {
      collection: "projects",
      spec: { slug: 1 },
      options: { unique: true, name: "idx_projects_slug_unique" },
    },
    {
      collection: "projects",
      spec: { ownerId: 1, createdAt: -1 },
      options: { name: "idx_projects_owner_created" },
    },
    {
      collection: "projects",
      spec: { status: 1, visibility: 1 },
      options: { name: "idx_projects_status_visibility" },
    },
    // Media
    {
      collection: "project_media",
      spec: { projectId: 1, position: 1 },
      options: { unique: true, name: "idx_media_project_position_unique" },
    },
    {
      collection: "project_media",
      spec: { storagePath: 1 },
      options: { unique: true, name: "idx_media_storage_path_unique" },
    },
    // Updates
    {
      collection: "project_updates",
      spec: { projectId: 1, createdAt: -1 },
      options: { name: "idx_updates_project_created" },
    },
    // Social: Votes, Comments, Bookmarks, Follows
    {
      collection: "project_votes",
      spec: { userId: 1, projectId: 1 },
      options: { unique: true, name: "idx_votes_user_project_unique" },
    },
    {
      collection: "project_votes",
      spec: { projectId: 1 },
      options: { name: "idx_votes_project" },
    },
    {
      collection: "project_comments",
      spec: { projectId: 1, createdAt: -1 },
      options: { name: "idx_comments_project_created" },
    },
    {
      collection: "bookmarks",
      spec: { userId: 1, projectId: 1 },
      options: { unique: true, name: "idx_bookmarks_user_project_unique" },
    },
    {
      collection: "creator_follows",
      spec: { followerId: 1, followedId: 1 },
      options: { unique: true, name: "idx_follows_pair_unique" },
    },
    // Notifications
    {
      collection: "notifications",
      spec: { userId: 1, createdAt: -1 },
      options: { name: "idx_notifications_user_created" },
    },
    {
      collection: "notifications",
      spec: { userId: 1, read: 1 },
      options: { name: "idx_notifications_user_read" },
    },
    // Communities & Messages
    {
      collection: "community_members",
      spec: { userId: 1, communitySlug: 1 },
      options: { unique: true, name: "idx_community_members_pair_unique" },
    },
    {
      collection: "conversations",
      spec: { participants: 1, lastMessageAt: -1 },
      options: { name: "idx_conversations_participants_date" },
    },
    {
      collection: "messages",
      spec: { conversationId: 1, createdAt: 1 },
      options: { name: "idx_messages_conversation_date" },
    },
  ];

  for (const def of indexDefinitions) {
    try {
      const col = db.collection(def.collection);
      // createIndex is idempotent in MongoDB
      await col.createIndex(def.spec as unknown as IndexSpecification, def.options);
      report.push({
        collection: def.collection,
        index: def.options.name,
        status: "created",
      });
    } catch (cause) {
      report.push({
        collection: def.collection,
        index: def.options.name,
        status: "error",
        error: cause instanceof Error ? cause.message : "Index creation failed",
      });
    }
  }

  return report;
}

export async function seedProductionDefaults(database?: Db): Promise<{ seeded: boolean; projectsCount: number }> {
  if (!isMongoConfigured() && !database) {
    return { seeded: false, projectsCount: 0 };
  }

  const db = database || (await getMongoDb());
  const projectsCol = db.collection("projects");
  const count = await projectsCol.countDocuments();

  if (count > 0) {
    return { seeded: false, projectsCount: count };
  }

  const now = new Date().toISOString();
  const seedDocs = projects.map((p, index) => ({
    _id: `proj-seed-${index + 1}`,
    id: `proj-seed-${index + 1}`,
    ownerId: "system-seed-user",
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    repositoryUrl: p.repo.startsWith("http") ? p.repo : `https://${p.repo}`,
    demoUrl: p.demo ? (p.demo.startsWith("http") ? p.demo : `https://${p.demo}`) : null,
    tags: p.tags,
    visibility: "public" as const,
    status: "published" as const,
    createdAt: now,
    updatedAt: now,
  }));

  await projectsCol.insertMany(seedDocs as unknown as OptionalUnlessRequiredId<Document>[]);
  return { seeded: true, projectsCount: seedDocs.length };
}
