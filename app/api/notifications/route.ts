import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationReadSchema } from "@/lib/validators";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        readAt: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
            isBlueVerified: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 60
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        readAt: null
      }
    })
  ]);

  return NextResponse.json({
    notifications,
    unreadCount
  });
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = notificationReadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid notification read request",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const now = new Date();

  if (parsed.data.markAll) {
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        readAt: null
      },
      data: {
        readAt: now
      }
    });

    return NextResponse.json({
      message: "All notifications marked as read"
    });
  }

  if (!parsed.data.notificationId) {
    return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
  }

  const updated = await prisma.notification.updateMany({
    where: {
      id: parsed.data.notificationId,
      userId: session.user.id
    },
    data: {
      readAt: now
    }
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Notification marked as read" });
}

