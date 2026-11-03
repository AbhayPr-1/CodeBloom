import type { Collection, Db } from "mongodb";
import { getMongoDb } from "./client";

export interface UserDoc {
  _id: string;
  id: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  username: string;
  usernameNormalized: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDoc {
  _id: string;
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  repositoryUrl: string;
  demoUrl?: string | null;
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMediaDoc {
  _id: string;
  id: string;
  projectId: string;
  storagePath: string;
  altText: string;
  position: number;
  contentType?: string;
  data?: string;
  createdAt: string;
}

export interface ProjectUpdateDoc {
  _id: string;
  id: string;
  projectId: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVoteDoc {
  _id: string;
  userId: string;
  projectId: string;
  value: 1 | -1;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCommentDoc {
  _id: string;
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface BookmarkDoc {
  _id: string;
  userId: string;
  projectId: string;
  createdAt: string;
}

export interface CreatorFollowDoc {
  _id: string;
  followerId: string;
  followedId: string;
  createdAt: string;
}

export async function getUsersCollection(db?: Db): Promise<Collection<UserDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<UserDoc>("users");
}

export async function getProjectsCollection(db?: Db): Promise<Collection<ProjectDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<ProjectDoc>("projects");
}

export async function getProjectMediaCollection(db?: Db): Promise<Collection<ProjectMediaDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<ProjectMediaDoc>("project_media");
}

export async function getProjectUpdatesCollection(db?: Db): Promise<Collection<ProjectUpdateDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<ProjectUpdateDoc>("project_updates");
}

export async function getProjectVotesCollection(db?: Db): Promise<Collection<ProjectVoteDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<ProjectVoteDoc>("project_votes");
}

export async function getProjectCommentsCollection(db?: Db): Promise<Collection<ProjectCommentDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<ProjectCommentDoc>("project_comments");
}

export async function getBookmarksCollection(db?: Db): Promise<Collection<BookmarkDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<BookmarkDoc>("bookmarks");
}

export async function getCreatorFollowsCollection(db?: Db): Promise<Collection<CreatorFollowDoc>> {
  const database = db ?? (await getMongoDb());
  return database.collection<CreatorFollowDoc>("creator_follows");
}

