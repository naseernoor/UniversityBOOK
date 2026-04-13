import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getRelationshipStatus } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { buildPerformanceSummary } from "@/lib/semester";

type Params = {
  params: {
    userId: string;
  };
};

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: params.userId
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
      isBlueVerified: true,
      profile: true
    }
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.id === session.user.id) {
    const semesters = await prisma.semester.findMany({
      where: {
        userId: targetUser.id
      },
      include: {
        subjects: true,
        visibility: {
          select: {
            viewerId: true
          }
        }
      },
      orderBy: {
        index: "asc"
      }
    });

    const summary = buildPerformanceSummary({
      semesters,
      totalSemesters: targetUser.profile?.totalSemesters ?? 8,
      idealPercentage: targetUser.profile?.idealPercentage ?? null,
      minimumPassingMarks: targetUser.profile?.minimumPassingMarks ?? 50
    });

    return NextResponse.json({
      user: targetUser,
      ...summary
    });
  }

  const relationshipStatus = await getRelationshipStatus(session.user.id, targetUser.id);

  const profileVisibility = targetUser.profile?.profileVisibility ?? "FRIENDS";

  if (profileVisibility === "PRIVATE" && relationshipStatus !== "FRIENDS") {
    return NextResponse.json(
      {
        error: "This profile is private"
      },
      { status: 403 }
    );
  }

  if (profileVisibility === "FRIENDS" && relationshipStatus !== "FRIENDS") {
    return NextResponse.json(
      {
        error: "Only friends can view this profile"
      },
      { status: 403 }
    );
  }

  if (profileVisibility === "PUBLIC" && relationshipStatus !== "FRIENDS") {
    return NextResponse.json({
      user: {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
        email: null,
        image: targetUser.image,
        role: targetUser.role,
        isBlueVerified: targetUser.isBlueVerified,
        profile: targetUser.profile
      },
      semesters: [],
      overallPercentage: 0,
      projection: null,
      chanceStats: {
        secondChanceCount: 0,
        thirdChanceCount: 0
      },
      retakeQueues: {
        needSecondChance: [],
        needThirdChance: []
      }
    });
  }

  const semesters = await prisma.semester.findMany({
    where: {
      userId: targetUser.id,
      visibility: {
        some: {
          viewerId: session.user.id
        }
      }
    },
    include: {
      subjects: true,
      visibility: {
        select: {
          viewerId: true
        }
      }
    },
    orderBy: {
      index: "asc"
    }
  });

  const summary = buildPerformanceSummary({
    semesters,
    totalSemesters: targetUser.profile?.totalSemesters ?? 8,
    idealPercentage: targetUser.profile?.idealPercentage ?? null,
    minimumPassingMarks: targetUser.profile?.minimumPassingMarks ?? 50
  });

  return NextResponse.json({
    user: {
      id: targetUser.id,
      name: targetUser.name,
      username: targetUser.username,
      email: targetUser.email,
      image: targetUser.image,
      role: targetUser.role,
      isBlueVerified: targetUser.isBlueVerified,
      profile: targetUser.profile
    },
    ...summary
  });
}
