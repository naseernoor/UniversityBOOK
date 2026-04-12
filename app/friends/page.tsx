import { redirect } from "next/navigation";

import FriendsClient from "@/components/friends-client";
import { getServerAuthSession } from "@/lib/auth";

export default async function FriendsPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <FriendsClient />;
}
