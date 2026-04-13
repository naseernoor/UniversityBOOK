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
  const statusParam = (searchParams.get("status") ?? "PENDING").toUpperCase();

  const status =
    statusParam === "APPROVED" || statusParam === "REJECTED" ? statusParam : "PENDING";

  const requests = await prisma.profileVerificationRequest.findMany({
    where: {
      status
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          image: true,
          isBlueVerified: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              university: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 200
  });

  return NextResponse.json({ requests });
}

