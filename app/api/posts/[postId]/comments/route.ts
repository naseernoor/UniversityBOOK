import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { resolveMentionedUsers } from "@/lib/mentions";
import { createNotification, createNotificationsBulk } from "@/lib/notifications";
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

    let parentCommentUserId: string | null = null;

    if (parentCommentId) {
      const parentComment = await prisma.postComment.findFirst({
        where: {
          id: parentCommentId,
          postId: params.postId
        },
        select: {
          id: true,
          userId: true
        }
      });

      if (!parentComment) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }

      parentCommentUserId = parentComment.userId;
    }

    const mentionedUsers = await resolveMentionedUsers({
      authorId: session.user.id,
      content: parsed.data.content
    });

    const [createdComment, author, postOwner] = await Promise.all([
      prisma.postComment.create({
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
        },
        select: {
          id: true
        }
      }),
      prisma.user.findUnique({
        where: {
          id: session.user.id
        },
        select: {
          username: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.post.findUnique({
        where: {
          id: params.postId
        },
        select: {
          userId: true
        }
      })
    ]);

    const authorName = author?.profile
      ? `${author.profile.firstName} ${author.profile.lastName}`
      : author?.username ?? author?.email ?? "A friend";

    const notified = new Set<string>();

    if (postOwner?.userId && postOwner.userId !== session.user.id) {
      await createNotification({
        userId: postOwner.userId,
        actorId: session.user.id,
        type: parentCommentId ? "REPLY_TO_COMMENT" : "COMMENT_ON_POST",
        title: parentCommentId ? "New reply on your post" : "New comment on your post",
        body: `${authorName} ${parentCommentId ? "replied on" : "commented on"} your post`,
        link: "/dashboard",
        data: {
          postId: params.postId,
          commentId: createdComment.id
        }
      });
      notified.add(postOwner.userId);
    }

    if (
      parentCommentUserId &&
      parentCommentUserId !== session.user.id &&
      !notified.has(parentCommentUserId)
    ) {
      await createNotification({
        userId: parentCommentUserId,
        actorId: session.user.id,
        type: "REPLY_TO_COMMENT",
        title: "New reply to your comment",
        body: `${authorName} replied to your comment`,
        link: "/dashboard",
        data: {
          postId: params.postId,
          commentId: createdComment.id
        }
      });
      notified.add(parentCommentUserId);
    }

    await createNotificationsBulk(
      mentionedUsers
        .map((user) => user.id)
        .filter((userId) => userId !== session.user.id && !notified.has(userId))
        .map((userId) => ({
          userId,
          actorId: session.user.id,
          type: "COMMENT_MENTION" as const,
          title: "You were mentioned in a comment",
          body: `${authorName} mentioned you in a comment`,
          link: "/dashboard",
          data: {
            postId: params.postId,
            commentId: createdComment.id
          }
        }))
    );

    const post = await getPostByIdForViewer(params.postId, session.user.id);
    return NextResponse.json({ post });
  } catch (error) {
    console.error("Comment creation failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
