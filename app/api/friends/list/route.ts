import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getAcceptedFriends } from "@/lib/friends";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const friends = await getAcceptedFriends(session.user.id);

  return NextResponse.json({ friends });
}
