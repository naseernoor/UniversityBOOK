import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { buildPerformanceSummary } from "@/lib/semester";
import { prisma } from "@/lib/prisma";
import { createSemesterSchema } from "@/lib/validators";

type Params = {
  params: {
    semesterId: string;
  };
};

export async function PUT(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingSemester = await prisma.semester.findFirst({
    where: {
      id: params.semesterId,
      userId: session.user.id
    },
    select: {
      id: true
    }
  });

  if (!existingSemester) {
    return NextResponse.json({ error: "Semester not found" }, { status: 404 });
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

    const semester = await prisma.semester.update({
      where: {
        id: params.semesterId
      },
      data: {
        index: parsed.data.index,
        name: parsed.data.name,
        subjects: {
          deleteMany: {},
          create: parsed.data.subjects.map((subject) => ({
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

    console.error("Semester update failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await prisma.semester.deleteMany({
    where: {
      id: params.semesterId,
      userId: session.user.id
    }
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Semester not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Semester deleted" });
}
