import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { canViewPost } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { postReactionSchema } from "@/lib/validators";

type Params = {
  params: {
    postId: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canViewPost(session.user.id, params.postId);
  if (!access.found) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (!access.canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = postReactionSchema.safeParse(body);
  const reaction = parsed.success ? parsed.data.reaction : "LIKE";

  const existing = await prisma.postLike.findUnique({
    where: {
      postId_userId: {
        postId: params.postId,
        userId: session.user.id
      }
    },
    select: {
      id: true,
      reactionType: true
    }
  });

  let myReaction: string | null = null;

  if (reaction === "NONE") {
    if (existing) {
      await prisma.postLike.delete({
        where: {
          postId_userId: {
            postId: params.postId,
            userId: session.user.id
          }
        }
      });
    }
    myReaction = null;
  } else if (!existing) {
    await prisma.postLike.create({
      data: {
        postId: params.postId,
        userId: session.user.id,
        reactionType: reaction
      }
    });
    myReaction = reaction;
  } else if (existing.reactionType === reaction) {
    await prisma.postLike.delete({
      where: {
        postId_userId: {
          postId: params.postId,
          userId: session.user.id
        }
      }
    });
    myReaction = null;
  } else {
    await prisma.postLike.update({
      where: {
        postId_userId: {
          postId: params.postId,
          userId: session.user.id
        }
      },
      data: {
        reactionType: reaction
      }
    });
    myReaction = reaction;
  }

  const likes = await prisma.postLike.findMany({
    where: {
      postId: params.postId
    },
    select: {
      reactionType: true
    }
  });

  const reactions = likes.reduce<Record<string, number>>((acc, item) => {
    acc[item.reactionType] = (acc[item.reactionType] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    liked: myReaction !== null,
    likesCount: likes.length,
    myReaction,
    reactions
  });
}
