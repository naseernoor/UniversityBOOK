import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [incoming, outgoing] = await Promise.all([
    prisma.friendRequest.findMany({
      where: {
        recipientId: session.user.id,
        status: "PENDING"
      },
      select: {
        id: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.friendRequest.findMany({
      where: {
        senderId: session.user.id,
        status: "PENDING"
      },
      select: {
        id: true,
        createdAt: true,
        recipient: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  return NextResponse.json({ incoming, outgoing });
}
