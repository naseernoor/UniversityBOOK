import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { resolveMentionedUsers } from "@/lib/mentions";
import { canViewPost, getPostByIdForViewer } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validators";

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

  try {
    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid comment",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const parentCommentId = parsed.data.parentCommentId ?? null;

    if (parentCommentId) {
      const parentComment = await prisma.postComment.findFirst({
        where: {
          id: parentCommentId,
          postId: params.postId
        },
        select: {
          id: true
        }
      });

      if (!parentComment) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const mentionedUsers = await resolveMentionedUsers({
      authorId: session.user.id,
      content: parsed.data.content
    });

    await prisma.postComment.create({
      data: {
        postId: params.postId,
        userId: session.user.id,
        parentId: parentCommentId,
        content: parsed.data.content,
        mentions: {
          create: mentionedUsers.map((user) => ({
            mentionedUserId: user.id
          }))
        }
      }
    });

    const post = await getPostByIdForViewer(params.postId, session.user.id);
    return NextResponse.json({ post });
  } catch (error) {
    console.error("Comment creation failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

