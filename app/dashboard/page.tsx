import { redirect } from "next/navigation";

import DashboardClient from "@/components/dashboard-client";
import { getServerAuthSession } from "@/lib/auth";
import {
  isMissingLegacyUserOrProfileFieldError,
  legacyProfileSelect
} from "@/lib/db-compat";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  let user;

  try {
    user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        email: true,
        username: true,
        image: true,
        role: true,
        isBlueVerified: true,
        profile: true
      }
    });
  } catch (error) {
    if (!isMissingLegacyUserOrProfileFieldError(error)) {
      throw error;
    }

    user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        email: true,
        image: true,
        profile: {
          select: legacyProfileSelect
        }
      }
    });
  }

  if (!user) {
    redirect("/login");
  }

  if (!user.profile) {
    redirect("/onboarding");
  }

  const normalizedUser = {
    ...user,
    username: typeof (user as { username?: unknown }).username === "string"
      ? (user as { username?: string | null }).username ?? null
      : null,
    role: typeof (user as { role?: unknown }).role === "string"
      ? ((user as { role?: "USER" | "ADMIN" | "SUPER_ADMIN" | null }).role ?? "USER")
      : "USER",
    isBlueVerified: Boolean((user as { isBlueVerified?: unknown }).isBlueVerified)
  };

  return (
    <DashboardClient
      initialUser={normalizedUser}
    />
  );
}
