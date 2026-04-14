import { redirect } from "next/navigation";

import DashboardClient from "@/components/dashboard-client";
import { getServerAuthSession } from "@/lib/auth";
import { isMissingProfileGenderError, legacyProfileSelect } from "@/lib/db-compat";
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
    if (!isMissingProfileGenderError(error)) {
      throw error;
    }

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

  return <DashboardClient initialUser={user} />;
}
