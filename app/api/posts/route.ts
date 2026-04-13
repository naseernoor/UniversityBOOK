import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getFeedPosts, getPostByIdForViewer } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { buildPerformanceSummary } from "@/lib/semester";
import { createPostSchema } from "@/lib/validators";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await getFeedPosts(session.user.id);
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid post data",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const sharedSemesterIds = [...new Set(data.sharedSemesterIds)];

    const userProfile = await prisma.profile.findUnique({
      where: {
        userId: session.user.id
      },
      select: {
        defaultPostVisibility: true,
        idealPercentage: true,
        totalSemesters: true,
        minimumPassingMarks: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const ownedSemesters = await prisma.semester.findMany({
      where: {
        userId: session.user.id,
        id: {
          in: sharedSemesterIds
        }
      },
      select: {
        id: true
      }
    });

    if (ownedSemesters.length !== sharedSemesterIds.length) {
      return NextResponse.json(
        {
          error: "You can only share your own semesters"
        },
        { status: 400 }
      );
    }

    let overallPercentageSnapshot: number | null = null;
    if (data.includeOverallPercentage) {
      const semesters = await prisma.semester.findMany({
        where: {
          userId: session.user.id
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
        semesters,
        totalSemesters: userProfile.totalSemesters,
        idealPercentage: userProfile.idealPercentage ?? null,
        minimumPassingMarks: userProfile.minimumPassingMarks
      });

      overallPercentageSnapshot = summary.overallPercentage;
    }

    const created = await prisma.post.create({
      data: {
        userId: session.user.id,
        content: data.content,
        visibility: data.visibility ?? userProfile.defaultPostVisibility,
        includeOverallPercentage: data.includeOverallPercentage,
        overallPercentageSnapshot,
        sharedSemesters: {
          create: ownedSemesters.map((semester) => ({
            semesterId: semester.id
          }))
        }
      },
      select: {
        id: true
      }
    });

    const post = await getPostByIdForViewer(created.id, session.user.id);

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Post creation failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
