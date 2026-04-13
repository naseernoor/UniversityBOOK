import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { resolveMentionedUsers } from "@/lib/mentions";
import { getPostByIdForViewer } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { updateCommentSchema } from "@/lib/validators";

type Params = {
  params: {
    postId: string;
    commentId: string;
  };
};

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const comment = await prisma.postComment.findFirst({
    where: {
      id: params.commentId,
      postId: params.postId
    },
    select: {
      id: true,
      userId: true
    }
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.userId !== session.user.id) {
    return NextResponse.json({ error: "Only comment owner can edit" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updateCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid comment update",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const mentionedUsers = await resolveMentionedUsers({
      authorId: session.user.id,
      content: parsed.data.content
    });

    await prisma.postComment.update({
      where: {
        id: comment.id
      },
      data: {
        content: parsed.data.content,
        mentions: {
          deleteMany: {},
          create: mentionedUsers.map((user) => ({
            mentionedUserId: user.id
          }))
        }
      }
    });

    const post = await getPostByIdForViewer(params.postId, session.user.id);
    return NextResponse.json({ post });
  } catch (error) {
    console.error("Comment update failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [actor, comment] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        role: true
      }
    }),
    prisma.postComment.findFirst({
      where: {
        id: params.commentId,
        postId: params.postId
      },
      select: {
        id: true,
        postId: true,
        userId: true
      }
    })
  ]);

  if (!actor) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isOwner = comment.userId === actor.id;
  if (!isOwner && !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.postComment.delete({
    where: {
      id: comment.id
    }
  });

  if (!isOwner) {
    await prisma.adminActionLog.create({
      data: {
        adminId: actor.id,
        targetUserId: comment.userId,
        action: "DELETE_COMMENT",
        entityType: "COMMENT",
        entityId: comment.id
      }
    });
  }

  const post = await getPostByIdForViewer(params.postId, session.user.id);
  return NextResponse.json({ post });
}

