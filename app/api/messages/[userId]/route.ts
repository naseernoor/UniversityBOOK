import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/db-compat";
import { areUsersFriends } from "@/lib/friends";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { messageSendSchema } from "@/lib/validators";

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

  if (params.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot open self conversation" }, { status: 400 });
  }

  const isFriend = await areUsersFriends(session.user.id, params.userId);
  if (!isFriend) {
    return NextResponse.json({ error: "Messaging is available only for friends" }, { status: 403 });
  }

  let friend;
  let messages;

  try {
    [friend, messages] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: params.userId
        },
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
      }),
      prisma.message.findMany({
        where: {
          OR: [
            {
              senderId: session.user.id,
              recipientId: params.userId
            },
            {
              senderId: params.userId,
              recipientId: session.user.id
            }
          ]
        },
        orderBy: {
          createdAt: "asc"
        },
        take: 500
      })
    ]);
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }

    return NextResponse.json({
      friend: null,
      messages: [],
      unavailable: true
    });
  }

  if (!friend) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await prisma.message.updateMany({
      where: {
        senderId: params.userId,
        recipientId: session.user.id,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }
  }

  return NextResponse.json({
    friend,
    messages
  });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (params.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot send message to yourself" }, { status: 400 });
  }

  const isFriend = await areUsersFriends(session.user.id, params.userId);
  if (!isFriend) {
    return NextResponse.json({ error: "Messaging is available only for friends" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = messageSendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid message",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  let message;

  try {
    message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        recipientId: params.userId,
        content: parsed.data.content
      }
    });
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }

    return NextResponse.json(
      { error: "Messaging is temporarily unavailable until the database upgrade is completed" },
      { status: 503 }
    );
  }

  const sender = await prisma.user.findUnique({
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

  const senderName = sender?.profile
    ? `${sender.profile.firstName} ${sender.profile.lastName}`
    : sender?.username ?? sender?.email ?? "A friend";

  await createNotification({
    userId: params.userId,
    actorId: session.user.id,
    type: "MESSAGE_RECEIVED",
    title: "New message",
    body: `${senderName} sent you a message`,
    link: "/friends",
    data: {
      senderId: session.user.id
    }
  });

  return NextResponse.json({
    message
  });
}
