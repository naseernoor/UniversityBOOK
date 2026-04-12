import { redirect } from "next/navigation";

import OnboardingForm from "@/components/onboarding-form";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      email: true,
      username: true,
      profile: {
        select: {
          id: true
        }
      }
    }
  });

  if (!user) {
    redirect("/login");
  }

  if (user.profile && user.username) {
    redirect("/dashboard");
  }

  return <OnboardingForm defaultEmail={user.email} />;
}
