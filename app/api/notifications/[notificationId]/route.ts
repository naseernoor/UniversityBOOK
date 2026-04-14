import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/db-compat";
import { prisma } from "@/lib/prisma";

type Params = {
  params: {
    notificationId: string;
  };
};

export async function PATCH(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let updated;

  try {
    updated = await prisma.notification.updateMany({
      where: {
        id: params.notificationId,
        userId: session.user.id
      },
      data: {
        readAt: new Date()
      }
    });
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }

    return NextResponse.json({ message: "Notifications are not available yet" });
  }

  if (updated.count === 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Notification marked as read" });
}
