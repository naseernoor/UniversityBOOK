import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { buildPerformanceSummary } from "@/lib/semester";
import { prisma } from "@/lib/prisma";
import { createSemesterSchema } from "@/lib/validators";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, semesters] = await Promise.all([
    prisma.profile.findUnique({
      where: {
        userId: session.user.id
      },
      select: {
        idealPercentage: true,
        totalSemesters: true,
        minimumPassingMarks: true
      }
    }),
    prisma.semester.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        subjects: {
          orderBy: {
            createdAt: "asc"
          }
        },
        visibility: {
          select: {
            viewerId: true
          }
        }
      },
      orderBy: {
        index: "asc"
      }
    })
  ]);

  const summary = buildPerformanceSummary({
    semesters,
    totalSemesters: profile?.totalSemesters ?? 8,
    idealPercentage: profile?.idealPercentage ?? null,
    minimumPassingMarks: profile?.minimumPassingMarks ?? 50
  });

  return NextResponse.json({
    ...summary,
    completedSemesters: semesters.length
  });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSemesterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid semester data",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const hasProfile = await prisma.profile.findUnique({
      where: {
        userId: session.user.id
      },
      select: {
        id: true
      }
    });

    if (!hasProfile) {
      return NextResponse.json(
        {
          error: "Please complete your profile before adding semesters"
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const semester = await prisma.semester.create({
      data: {
        userId: session.user.id,
        index: data.index,
        name: data.name,
        subjects: {
          create: data.subjects.map((subject) => ({
            name: subject.name,
            credits: subject.credits,
            code: subject.code,
            teacherName: subject.teacherName,
            lectureMaterialsJson: JSON.stringify(subject.lectureMaterials ?? []),
            chance: subject.chance,
            score: subject.score
          }))
        }
      },
      include: {
        subjects: true,
        visibility: {
          select: {
            viewerId: true
          }
        }
      }
    });

    const summary = buildPerformanceSummary({
      semesters: [semester],
      totalSemesters: 1,
      idealPercentage: null,
      minimumPassingMarks: 50
    });

    return NextResponse.json({
      semester: summary.semesters[0]
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This semester number already exists" },
        { status: 409 }
      );
    }

    console.error("Semester creation failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
