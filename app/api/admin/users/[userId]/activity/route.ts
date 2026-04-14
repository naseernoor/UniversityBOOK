import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/db-compat";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

type Params = {
  params: {
    userId: string;
  };
};

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      role: true
    }
  });

  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: params.userId
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true
    }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const notificationsPromise = prisma.notification
    .findMany({
      where: {
        userId: user.id
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 80
    })
    .catch((error) => {
      if (isMissingSchemaError(error)) {
        return [];
      }
      throw error;
    });

  const messagesPromise = prisma.message
    .findMany({
      where: {
        OR: [{ senderId: user.id }, { recipientId: user.id }]
      },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        content: true,
        readAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 120
    })
    .catch((error) => {
      if (isMissingSchemaError(error)) {
        return [];
      }
      throw error;
    });

  const [posts, comments, friendRequests, semesters, profileVerifications, adminActions, notifications, messages] =
    await Promise.all([
      prisma.post.findMany({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          content: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              likes: true,
              comments: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 40
      }),
      prisma.postComment.findMany({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          postId: true,
          parentId: true,
          content: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 80
      }),
      prisma.friendRequest.findMany({
        where: {
          OR: [{ senderId: user.id }, { recipientId: user.id }]
        },
        select: {
          id: true,
          senderId: true,
          recipientId: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 80
      }),
      prisma.semester.findMany({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          index: true,
          name: true,
          status: true,
          verificationStatus: true,
          verificationRequestedAt: true,
          verificationReviewedAt: true,
          updatedAt: true
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 80
      }),
      prisma.profileVerificationRequest.findMany({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          status: true,
          documentType: true,
          createdAt: true,
          reviewedAt: true,
          reviewNote: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 40
      }),
      prisma.adminActionLog.findMany({
        where: {
          targetUserId: user.id
        },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          detailsJson: true,
          createdAt: true,
          admin: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 80
      }),
      notificationsPromise,
      messagesPromise
    ]);

  return NextResponse.json({
    user,
    activity: {
      posts,
      comments,
      friendRequests,
      semesters,
      profileVerifications,
      adminActions,
      notifications,
      messages
    }
  });
}
