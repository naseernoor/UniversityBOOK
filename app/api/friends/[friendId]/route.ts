import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = {
  params: {
    friendId: string;
  };
};

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const relation = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        {
          senderId: session.user.id,
          recipientId: params.friendId
        },
        {
          senderId: params.friendId,
          recipientId: session.user.id
        }
      ]
    },
    select: {
      id: true
    }
  });

  if (!relation) {
    return NextResponse.json({ error: "Friend relationship not found" }, { status: 404 });
  }

  await prisma.friendRequest.delete({
    where: {
      id: relation.id
    }
  });

  return NextResponse.json({ message: "Friend removed successfully" });
}
