import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { friendRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = friendRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { targetUserId } = parsed.data;

    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: "You cannot add yourself" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: targetUserId
      },
      select: {
        id: true
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          {
            senderId: session.user.id,
            recipientId: targetUserId
          },
          {
            senderId: targetUserId,
            recipientId: session.user.id
          }
        ]
      }
    });

    if (existing?.status === "ACCEPTED") {
      return NextResponse.json({ error: "You are already friends" }, { status: 409 });
    }

    if (existing?.status === "PENDING") {
      return NextResponse.json({ error: "A request is already pending" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.friendRequest.delete({
          where: {
            id: existing.id
          }
        });
      }

      await tx.friendRequest.create({
        data: {
          senderId: session.user.id,
          recipientId: targetUserId,
          status: "PENDING"
        }
      });
    });

    return NextResponse.json({ message: "Friend request sent" });
  } catch (error) {
    console.error("Failed to send friend request", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
