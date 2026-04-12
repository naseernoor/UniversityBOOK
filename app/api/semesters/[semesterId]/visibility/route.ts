import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getAcceptedFriendIds } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { semesterVisibilitySchema } from "@/lib/validators";

type Params = {
  params: {
    semesterId: string;
  };
};

export async function PUT(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const semester = await prisma.semester.findFirst({
    where: {
      id: params.semesterId,
      userId: session.user.id
    },
    select: {
      id: true
    }
  });

  if (!semester) {
    return NextResponse.json({ error: "Semester not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = semesterVisibilitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid visibility data",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const acceptedFriendIds = await getAcceptedFriendIds(session.user.id);
    const notFriendIds = parsed.data.visibleFriendIds.filter(
      (friendId) => !acceptedFriendIds.includes(friendId)
    );

    if (notFriendIds.length > 0) {
      return NextResponse.json(
        {
          error: "You can only share with accepted friends"
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.semesterVisibility.deleteMany({
        where: {
          semesterId: params.semesterId
        }
      });

      if (parsed.data.visibleFriendIds.length > 0) {
        await tx.semesterVisibility.createMany({
          data: parsed.data.visibleFriendIds.map((friendId) => ({
            semesterId: params.semesterId,
            viewerId: friendId
          }))
        });
      }
    });

    return NextResponse.json({
      semesterId: params.semesterId,
      visibleFriendIds: parsed.data.visibleFriendIds
    });
  } catch (error) {
    console.error("Visibility update failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
