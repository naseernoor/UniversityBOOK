import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { canViewPost } from "@/lib/posts";
import { prisma } from "@/lib/prisma";

type Params = {
  params: {
    postId: string;
  };
};

export async function POST(_request: Request, { params }: Params) {
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

  const existing = await prisma.postLike.findUnique({
    where: {
      postId_userId: {
        postId: params.postId,
        userId: session.user.id
      }
    },
    select: {
      id: true
    }
  });

  if (existing) {
    await prisma.postLike.delete({
      where: {
        postId_userId: {
          postId: params.postId,
          userId: session.user.id
        }
      }
    });
  } else {
    await prisma.postLike.create({
      data: {
        postId: params.postId,
        userId: session.user.id
      }
    });
  }

  const likesCount = await prisma.postLike.count({
    where: {
      postId: params.postId
    }
  });

  return NextResponse.json({
    liked: !existing,
    likesCount
  });
}
