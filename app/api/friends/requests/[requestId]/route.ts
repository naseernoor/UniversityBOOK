import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { friendRequestActionSchema } from "@/lib/validators";

type Params = {
  params: {
    requestId: string;
  };
};

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = friendRequestActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const friendRequest = await prisma.friendRequest.findFirst({
      where: {
        id: params.requestId,
        recipientId: session.user.id,
        status: "PENDING"
      },
      select: {
        id: true
      }
    });

    if (!friendRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const status = parsed.data.action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    await prisma.friendRequest.update({
      where: {
        id: params.requestId
      },
      data: {
        status
      }
    });

    return NextResponse.json({ message: `Request ${status.toLowerCase()}` });
  } catch (error) {
    console.error("Failed to update friend request", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await prisma.friendRequest.deleteMany({
    where: {
      id: params.requestId,
      status: "PENDING",
      OR: [
        {
          senderId: session.user.id
        },
        {
          recipientId: session.user.id
        }
      ]
    }
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Pending request not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Friend request removed" });
}
