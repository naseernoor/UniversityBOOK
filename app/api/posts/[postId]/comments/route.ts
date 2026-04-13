import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { canViewPost } from "@/lib/posts";
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

    const comment = await prisma.postComment.create({
      data: {
        postId: params.postId,
        userId: session.user.id,
        content: parsed.data.content
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    const commentsCount = await prisma.postComment.count({
      where: {
        postId: params.postId
      }
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: comment.user
      },
      commentsCount
    });
  } catch (error) {
    console.error("Comment creation failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
