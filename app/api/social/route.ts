import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { isMongoConfigured } from "@/lib/mongodb/client";
import {
  getBookmarksCollection,
  getCreatorFollowsCollection,
  getProjectCommentsCollection,
  getProjectsCollection,
  getProjectVotesCollection,
  getUsersCollection,
} from "@/lib/mongodb/collections";
import { socialActionSchema } from "@/lib/validation/social";

export async function GET(request: Request) {
  const creatorUsername = new URL(request.url).searchParams.get("creator");
  if (!creatorUsername || !/^[a-z0-9][a-z0-9_-]{2,29}$/i.test(creatorUsername)) {
    return NextResponse.json({ error: "Choose a valid creator username." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "The social service is unavailable." }, { status: 503 });
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to view follow status." }, { status: 401 });
    }

    const users = await getUsersCollection();
    const creator = await users.findOne({ usernameNormalized: creatorUsername.toLowerCase() });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }

    const follows = await getCreatorFollowsCollection();
    const creatorId = creator.id || creator._id;
    const followDoc = await follows.findOne({
      followerId: user.id,
      followedId: creatorId,
    });

    return NextResponse.json(
      { following: Boolean(followDoc) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "The social service is unavailable." }, { status: 503 });
  }
}

function originIsAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originIsAllowed(request)) {
    return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  }

  let input: ReturnType<typeof socialActionSchema.parse>;
  try {
    input = socialActionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Check the social action and try again." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "The social service is unavailable." }, { status: 503 });
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to use project social actions." }, { status: 401 });
    }

    const now = new Date().toISOString();

    if (input.action === "vote") {
      const votesCollection = await getProjectVotesCollection();
      if (input.value === null) {
        await votesCollection.deleteOne({ userId: user.id, projectId: input.projectId });
      } else {
        await votesCollection.updateOne(
          { userId: user.id, projectId: input.projectId },
          {
            $set: {
              userId: user.id,
              projectId: input.projectId,
              value: input.value,
              updatedAt: now,
            },
            $setOnInsert: {
              _id: `${user.id}_${input.projectId}`,
              createdAt: now,
            },
          },
          { upsert: true }
        );
      }
      return NextResponse.json({ action: "vote", value: input.value });
    }

    if (input.action === "bookmark") {
      const bookmarksCollection = await getBookmarksCollection();
      if (input.saved) {
        await bookmarksCollection.updateOne(
          { userId: user.id, projectId: input.projectId },
          {
            $set: {
              userId: user.id,
              projectId: input.projectId,
              createdAt: now,
            },
            $setOnInsert: {
              _id: `${user.id}_${input.projectId}`,
            },
          },
          { upsert: true }
        );
      } else {
        await bookmarksCollection.deleteOne({ userId: user.id, projectId: input.projectId });
      }
      return NextResponse.json({ action: "bookmark", saved: input.saved });
    }

    if (input.action === "follow") {
      const usersCollection = await getUsersCollection();
      const creator = await usersCollection.findOne({ usernameNormalized: input.creatorUsername.toLowerCase() });

      if (!creator) {
        return NextResponse.json({ error: "Creator not found." }, { status: 404 });
      }

      const creatorId = creator.id || creator._id;
      if (creatorId === user.id) {
        return NextResponse.json({ error: "You cannot follow your own account." }, { status: 400 });
      }

      const followsCollection = await getCreatorFollowsCollection();
      if (input.following) {
        await followsCollection.updateOne(
          { followerId: user.id, followedId: creatorId },
          {
            $set: {
              followerId: user.id,
              followedId: creatorId,
              createdAt: now,
            },
            $setOnInsert: {
              _id: `${user.id}_${creatorId}`,
            },
          },
          { upsert: true }
        );
      } else {
        await followsCollection.deleteOne({ followerId: user.id, followedId: creatorId });
      }
      return NextResponse.json({ action: "follow", following: input.following });
    }

    // Comment action
    const projectsCollection = await getProjectsCollection();
    const project = await projectsCollection.findOne({
      $or: [{ id: input.projectId }, { _id: input.projectId }],
      visibility: "public",
      status: "published",
    });

    if (!project) {
      return NextResponse.json(
        { error: "Unable to add your comment. Check that the project is public." },
        { status: 400 }
      );
    }

    const commentsCollection = await getProjectCommentsCollection();
    const commentId = crypto.randomUUID();
    const newComment = {
      _id: commentId,
      id: commentId,
      projectId: input.projectId,
      authorId: user.id,
      body: input.body,
      createdAt: now,
    };

    await commentsCollection.insertOne(newComment);

    return NextResponse.json(
      {
        action: "comment",
        comment: {
          id: commentId,
          body: input.body,
          created_at: now,
          profiles: {
            username: user.username,
            display_name: user.displayName,
          },
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "The social service is unavailable." }, { status: 503 });
  }
}
