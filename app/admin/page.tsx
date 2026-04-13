import { redirect } from "next/navigation";

import AdminClient from "@/components/admin-client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export default async function AdminPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const actor = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true
    }
  });

  if (!actor || !isAdminRole(actor.role)) {
    redirect("/dashboard");
  }

  return <AdminClient actor={actor} />;
}

