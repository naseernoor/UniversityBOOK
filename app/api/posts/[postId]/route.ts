import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { resolveMentionedUsers } from "@/lib/mentions";
import { createNotificationsBulk } from "@/lib/notifications";
import { getPostByIdForViewer } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { buildPerformanceSummary } from "@/lib/semester";
import { updatePostSchema } from "@/lib/validators";

type Params = {
  params: {
    postId: string;
  };
};

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingPost = await prisma.post.findUnique({
    where: {
      id: params.postId
    },
    select: {
      id: true,
      userId: true
    }
  });

  if (!existingPost) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existingPost.userId !== session.user.id) {
    return NextResponse.json({ error: "Only post owner can edit this post" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid post data",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const sharedSemesterIds = [...new Set(data.sharedSemesterIds)];
    const mentions = await resolveMentionedUsers({
      authorId: existingPost.userId,
      content: data.content
    });

    const userProfile = await prisma.profile.findUnique({
      where: {
        userId: existingPost.userId
      },
      select: {
        defaultPostVisibility: true,
        idealPercentage: true,
        totalSemesters: true,
        minimumPassingMarks: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const ownedSemesters = await prisma.semester.findMany({
      where: {
        userId: existingPost.userId,
        id: {
          in: sharedSemesterIds
        }
      },
      select: {
        id: true
      }
    });

    if (ownedSemesters.length !== sharedSemesterIds.length) {
      return NextResponse.json(
        {
          error: "You can only share your own semesters"
        },
        { status: 400 }
      );
    }

    let overallPercentageSnapshot: number | null = null;
    if (data.includeOverallPercentage) {
      const semesters = await prisma.semester.findMany({
        where: {
          userId: existingPost.userId
        },
        include: {
          subjects: true,
          visibility: {
            select: {
              viewerId: true
            }
          }
        }
      });

      const summary = buildPerformanceSummary({
        semesters,
        totalSemesters: userProfile.totalSemesters,
        idealPercentage: userProfile.idealPercentage ?? null,
        minimumPassingMarks: userProfile.minimumPassingMarks
      });

      overallPercentageSnapshot = summary.overallPercentage;
    }

    await prisma.post.update({
      where: {
        id: params.postId
      },
      data: {
        content: data.content,
        visibility: data.visibility ?? userProfile.defaultPostVisibility,
        includeOverallPercentage: data.includeOverallPercentage,
        overallPercentageSnapshot,
        sharedSemesters: {
          deleteMany: {},
          create: ownedSemesters.map((semester) => ({
            semesterId: semester.id
          }))
        },
        media: {
          deleteMany: {},
          create: data.media.map((item) => ({
            url: item.url,
            fileName: item.fileName ?? null,
            mimeType: item.mimeType ?? null,
            sizeBytes: item.sizeBytes ?? null
          }))
        },
        mentions: {
          deleteMany: {},
          create: mentions.map((mentionedUser) => ({
            mentionedUserId: mentionedUser.id
          }))
        }
      }
    });

    const author = await prisma.user.findUnique({
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
    });

    const authorName = author?.profile
      ? `${author.profile.firstName} ${author.profile.lastName}`
      : author?.username ?? author?.email ?? "A friend";

    await createNotificationsBulk(
      mentions
        .filter((mentionedUser) => mentionedUser.id !== session.user.id)
        .map((mentionedUser) => ({
          userId: mentionedUser.id,
          actorId: session.user.id,
          type: "POST_MENTION" as const,
          title: "You were mentioned in a post",
          body: `${authorName} mentioned you in a post`,
          link: "/dashboard",
          data: {
            postId: params.postId
          }
        }))
    );

    const post = await getPostByIdForViewer(params.postId, session.user.id);
    return NextResponse.json({ post });
  } catch (error) {
    console.error("Post update failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [actor, post] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        role: true
      }
    }),
    prisma.post.findUnique({
      where: {
        id: params.postId
      },
      select: {
        id: true,
        userId: true
      }
    })
  ]);

  if (!actor) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const isOwner = post.userId === actor.id;
  if (!isOwner && !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.post.delete({
    where: {
      id: params.postId
    }
  });

  if (!isOwner) {
    await prisma.adminActionLog.create({
      data: {
        adminId: actor.id,
        targetUserId: post.userId,
        action: "DELETE_POST",
        entityType: "POST",
        entityId: post.id
      }
    });
  }

  return NextResponse.json({ message: "Post deleted" });
}
