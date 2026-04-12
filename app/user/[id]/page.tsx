import { redirect } from "next/navigation";

import FriendProfileClient from "@/components/friend-profile-client";
import { getServerAuthSession } from "@/lib/auth";

type UserPageProps = {
  params: {
    id: string;
  };
};

export default async function UserProfilePage({ params }: UserPageProps) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return <FriendProfileClient userId={params.id} />;
}
