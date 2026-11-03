import { MongoClient, type Db } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const DEFAULT_DB_NAME = "codebloom";

export function isMongoConfigured(): boolean {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  return uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
}

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured in environment variables.");
  }
  return uri;
}

export async function getMongoClient(): Promise<MongoClient> {
  const uri = getMongoUri();

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  const client = new MongoClient(uri);
  return client.connect();
}

export async function getMongoDb(dbName = DEFAULT_DB_NAME): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}