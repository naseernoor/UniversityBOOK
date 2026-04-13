import { PostReactionType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { canViewPost } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { commentReactionSchema } from "@/lib/validators";

type Params = {
  params: {
    postId: string;
    commentId: string;
  };
};

const reactionTypes = Object.values(PostReactionType);

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

  const comment = await prisma.postComment.findFirst({
    where: {
      id: params.commentId,
      postId: params.postId
    },
    select: {
      id: true
    }
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = commentReactionSchema.safeParse(body);
  const reaction = parsed.success ? parsed.data.reaction : "LIKE";

  const existing = await prisma.postCommentReaction.findUnique({
    where: {
      commentId_userId: {
        commentId: params.commentId,
        userId: session.user.id
      }
    },
    select: {
      id: true,
      reactionType: true
    }
  });

  let myReaction: PostReactionType | null = null;

  if (reaction === "NONE") {
    if (existing) {
      await prisma.postCommentReaction.delete({
        where: {
          commentId_userId: {
            commentId: params.commentId,
            userId: session.user.id
          }
        }
      });
    }
  } else if (!existing) {
    await prisma.postCommentReaction.create({
      data: {
        commentId: params.commentId,
        userId: session.user.id,
        reactionType: reaction
      }
    });
    myReaction = reaction;
  } else if (existing.reactionType === reaction) {
    await prisma.postCommentReaction.delete({
      where: {
        commentId_userId: {
          commentId: params.commentId,
          userId: session.user.id
        }
      }
    });
  } else {
    await prisma.postCommentReaction.update({
      where: {
        commentId_userId: {
          commentId: params.commentId,
          userId: session.user.id
        }
      },
      data: {
        reactionType: reaction
      }
    });
    myReaction = reaction;
  }

  const reactions = await prisma.postCommentReaction.findMany({
    where: {
      commentId: params.commentId
    },
    select: {
      reactionType: true
    }
  });

  const summary = reactionTypes.reduce((acc, type) => {
    acc[type] = reactions.filter((item) => item.reactionType === type).length;
    return acc;
  }, {} as Record<PostReactionType, number>);

  return NextResponse.json({
    reactions: summary,
    reactionsCount: reactions.length,
    myReaction
  });
}

