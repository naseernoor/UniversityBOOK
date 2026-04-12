import { redirect } from "next/navigation";

import DashboardClient from "@/components/dashboard-client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      id: true,
      email: true,
      username: true,
      image: true,
      profile: true
    }
  });

  if (!user) {
    redirect("/login");
  }

  if (!user.profile) {
    redirect("/onboarding");
  }

  return <DashboardClient initialUser={user} />;
}
