import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const isAdminRole = (role: UserRole | null | undefined) =>
  role === "ADMIN" || role === "SUPER_ADMIN";

export const isSuperAdminRole = (role: UserRole | null | undefined) =>
  role === "SUPER_ADMIN";

export const getUserRole = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      role: true
    }
  });

  return user?.role ?? null;
};

export const getSuperAdminEmails = () => {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
};

