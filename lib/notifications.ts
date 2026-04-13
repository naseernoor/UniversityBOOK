import { NotificationType, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown> | null;
};

export const createNotification = async (input: CreateNotificationInput) => {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      dataJson: input.data ? JSON.stringify(input.data) : null
    }
  });
};

export const createNotificationsBulk = async (
  inputs: CreateNotificationInput[]
) => {
  if (inputs.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      dataJson: input.data ? JSON.stringify(input.data) : null
    }))
  });
};

export const notifyAdmins = async (params: {
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown> | null;
}) => {
  const admins = await prisma.user.findMany({
    where: {
      role: {
        in: [UserRole.ADMIN, UserRole.SUPER_ADMIN]
      }
    },
    select: {
      id: true
    }
  });

  if (admins.length === 0) {
    return;
  }

  await createNotificationsBulk(
    admins.map((admin) => ({
      userId: admin.id,
      actorId: params.actorId ?? null,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
      data: params.data ?? null
    }))
  );
};

