import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        not: session.user.id
      },
      OR: [
        {
          username: {
            contains: query
          }
        },
        {
          email: {
            contains: query
          }
        },
        {
          name: {
            contains: query
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      profile: {
        select: {
          university: true
        }
      }
    },
    take: 20
  });

  if (users.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const relationships = await prisma.friendRequest.findMany({
    where: {
      OR: [
        {
          senderId: session.user.id,
          recipientId: {
            in: users.map((user) => user.id)
          }
        },
        {
          senderId: {
            in: users.map((user) => user.id)
          },
          recipientId: session.user.id
        }
      ]
    },
    select: {
      senderId: true,
      recipientId: true,
      status: true
    }
  });

  const usersWithStatus = users.map((user) => {
    const relationship = relationships.find(
      (item) =>
        (item.senderId === session.user.id && item.recipientId === user.id) ||
        (item.senderId === user.id && item.recipientId === session.user.id)
    );

    let relationshipStatus: "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "FRIENDS" = "NONE";

    if (relationship) {
      if (relationship.status === "ACCEPTED") {
        relationshipStatus = "FRIENDS";
      } else if (relationship.status === "PENDING") {
        relationshipStatus =
          relationship.senderId === session.user.id ? "PENDING_SENT" : "PENDING_RECEIVED";
      }
    }

    return {
      ...user,
      relationshipStatus
    };
  });

  return NextResponse.json({ users: usersWithStatus });
}
