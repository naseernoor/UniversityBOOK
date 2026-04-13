import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      role: true
    }
  });

  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 25), 1), 100);

  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            {
              username: {
                contains: query,
                mode: "insensitive"
              }
            },
            {
              email: {
                contains: query,
                mode: "insensitive"
              }
            },
            {
              name: {
                contains: query,
                mode: "insensitive"
              }
            }
          ]
        }
      : undefined,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      image: true,
      isBlueVerified: true,
      emailVerified: true,
      createdAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          university: true
        }
      },
      _count: {
        select: {
          posts: true,
          comments: true,
          semesters: true,
          sentFriendRequests: true,
          receivedFriendRequests: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return NextResponse.json({ users });
}

