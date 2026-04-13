import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getAcceptedFriends } from "@/lib/friends";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const friends = await getAcceptedFriends(session.user.id);

  if (friends.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const friendIds = friends.map((friend) => friend.id);

  const [latestMessages, unreadCounts] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: session.user.id,
            recipientId: {
              in: friendIds
            }
          },
          {
            senderId: {
              in: friendIds
            },
            recipientId: session.user.id
          }
        ]
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 400
    }),
    prisma.message.groupBy({
      by: ["senderId"],
      where: {
        recipientId: session.user.id,
        senderId: {
          in: friendIds
        },
        readAt: null
      },
      _count: {
        _all: true
      }
    })
  ]);

  const latestByFriend = new Map<string, (typeof latestMessages)[number]>();
  for (const message of latestMessages) {
    const friendId =
      message.senderId === session.user.id ? message.recipientId : message.senderId;
    if (!latestByFriend.has(friendId)) {
      latestByFriend.set(friendId, message);
    }
  }

  const unreadByFriend = new Map<string, number>();
  for (const row of unreadCounts) {
    unreadByFriend.set(row.senderId, row._count._all);
  }

  const conversations = friends
    .map((friend) => ({
      friend,
      latestMessage: latestByFriend.get(friend.id) ?? null,
      unreadCount: unreadByFriend.get(friend.id) ?? 0
    }))
    .sort((a, b) => {
      const aTime = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : 0;
      const bTime = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  return NextResponse.json({ conversations });
}

