import { isMongoConfigured } from "@/lib/mongodb/client";
import { getCommunityMembersCollection } from "@/lib/mongodb/collections";
import { projects } from "@/lib/demo-data";

export interface CommunityDefinition {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  iconName: "Flame" | "Code" | "Cpu" | "Palette" | "Bot" | "Terminal" | "Globe" | "Sparkles";
  tags: string[];
  baseMembers: number;
}

export interface CommunityItem extends CommunityDefinition {
  memberCount: number;
  projectCount: number;
  joined: boolean;
}

export const COMMUNITIES: CommunityDefinition[] = [
  {
    slug: "open-source",
    name: "Open Source Guild",
    tagline: "Collaborative software built in the open.",
    description: "Projects shared in the open, with room for developers to learn, contribute, and build upon what came before.",
    iconName: "Globe",
    tags: ["open source", "typescript", "react", "next.js"],
    baseMembers: 1420,
  },
  {
    slug: "indie-makers",
    name: "Indie Shippers",
    tagline: "Solo builders crafting focused products.",
    description: "Small teams and solo developers turning thoughtful ideas into sustainable, elegant software.",
    iconName: "Sparkles",
    tags: ["developer tools", "community", "productivity"],
    baseMembers: 980,
  },
  {
    slug: "design-systems",
    name: "Design Systems & UI Craft",
    tagline: "Tokens, micro-interactions, and aesthetics.",
    description: "The components, tokens, and tactile details that make modern interfaces feel considered and delightful.",
    iconName: "Palette",
    tags: ["design systems", "css", "animation", "ui"],
    baseMembers: 1150,
  },
  {
    slug: "rust-systems",
    name: "Rust & Systems Craft",
    tagline: "High-performance systems, compilers, and WASM.",
    description: "Memory safety, blazing-fast CLIs, concurrency, and low-level engineering for the modern web.",
    iconName: "Cpu",
    tags: ["rust", "cli", "systems", "webassembly"],
    baseMembers: 840,
  },
  {
    slug: "ai-agents",
    name: "AI & Intelligent Agents",
    tagline: "Autonomous workflows and generative pipelines.",
    description: "Builders developing local LLM integrations, autonomous developer agents, and multimodal tools.",
    iconName: "Bot",
    tags: ["ai", "agents", "machine learning", "python"],
    baseMembers: 1640,
  },
  {
    slug: "devtools",
    name: "Developer Ergonomics",
    tagline: "Terminals, editors, and developer joy.",
    description: "Everything that makes shipping software faster, calmer, and more intuitive for engineering teams.",
    iconName: "Terminal",
    tags: ["developer tools", "cli", "devtools", "typescript"],
    baseMembers: 1290,
  },
];

// In-memory membership cache for development or when Mongo is not configured
const memoryMemberships = new Map<string, Set<string>>(); // userId -> Set of slugs

// Default demo memberships
function getDemoJoinedSlugs(): Set<string> {
  return new Set(["open-source", "design-systems"]);
}

export async function getUserJoinedCommunities(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();

  if (isMongoConfigured()) {
    try {
      const collection = await getCommunityMembersCollection();
      const docs = await collection.find({ userId }).toArray();
      return new Set(docs.map((d) => d.communitySlug));
    } catch {
      // Fall through to memory
    }
  }

  if (!memoryMemberships.has(userId)) {
    memoryMemberships.set(userId, getDemoJoinedSlugs());
  }
  return memoryMemberships.get(userId) || new Set();
}

export async function listCommunities(userId?: string): Promise<CommunityItem[]> {
  const joinedSlugs = await getUserJoinedCommunities(userId);

  return COMMUNITIES.map((c) => {
    const isJoined = joinedSlugs.has(c.slug);
    const relatedProjects = projects.filter((p) =>
      p.tags.some((tag) => c.tags.includes(tag.toLowerCase()))
    );

    return {
      ...c,
      memberCount: c.baseMembers + (isJoined ? 1 : 0),
      projectCount: Math.max(relatedProjects.length, 3),
      joined: isJoined,
    };
  });
}

export async function getCommunityBySlug(slug: string, userId?: string): Promise<CommunityItem | null> {
  const normalizedSlug = slug.toLowerCase();
  const definition = COMMUNITIES.find((c) => c.slug === normalizedSlug) ||
    COMMUNITIES.find((c) => c.slug.replace("-", "") === normalizedSlug.replace("-", ""));

  if (!definition) return null;

  const joinedSlugs = await getUserJoinedCommunities(userId);
  const isJoined = joinedSlugs.has(definition.slug);
  const relatedProjects = projects.filter((p) =>
    p.tags.some((tag) => definition.tags.includes(tag.toLowerCase()))
  );

  return {
    ...definition,
    memberCount: definition.baseMembers + (isJoined ? 1 : 0),
    projectCount: Math.max(relatedProjects.length, 3),
    joined: isJoined,
  };
}

export async function toggleCommunityMembership(
  userId: string,
  slug: string,
  join: boolean
): Promise<{ success: boolean; joined: boolean; memberCount: number }> {
  const community = await getCommunityBySlug(slug, userId);
  if (!community) {
    throw new Error("Community not found");
  }

  if (isMongoConfigured()) {
    try {
      const collection = await getCommunityMembersCollection();
      if (join) {
        await collection.updateOne(
          { userId, communitySlug: community.slug },
          {
            $set: {
              userId,
              communitySlug: community.slug,
              joinedAt: new Date().toISOString(),
            },
            $setOnInsert: { _id: `${userId}_${community.slug}` },
          },
          { upsert: true }
        );
      } else {
        await collection.deleteOne({ userId, communitySlug: community.slug });
      }
      return {
        success: true,
        joined: join,
        memberCount: community.baseMembers + (join ? 1 : 0),
      };
    } catch {
      // Fall through to memory
    }
  }

  if (!memoryMemberships.has(userId)) {
    memoryMemberships.set(userId, getDemoJoinedSlugs());
  }

  const set = memoryMemberships.get(userId)!;
  if (join) {
    set.add(community.slug);
  } else {
    set.delete(community.slug);
  }

  return {
    success: true,
    joined: join,
    memberCount: community.baseMembers + (join ? 1 : 0),
  };
}

