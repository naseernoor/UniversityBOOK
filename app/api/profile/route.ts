import { z } from "zod";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onboardingSchema, profileTargetSchema, profileUpsertSchema } from "@/lib/validators";

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[\p{L}\p{N}_.-]+$/u, "Username can only include letters, numbers, ., _, -");

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      image: true,
      profile: true
    }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PUT(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const targetParsed = profileTargetSchema.safeParse(body);
    if (targetParsed.success && Object.keys(body).length <= 2) {
      const updated = await prisma.profile.update({
        where: {
          userId: session.user.id
        },
        data: {
          totalSemesters: targetParsed.data.totalSemesters,
          idealPercentage: targetParsed.data.idealPercentage
        }
      });

      return NextResponse.json({ profile: updated });
    }

    const currentUser = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        username: true,
        image: true
      }
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const needsUsername = !currentUser.username;
    const profileSchema = needsUsername ? onboardingSchema : profileUpsertSchema;
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid profile data",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const profileData = parsed.data;
    const profileImageUrl =
      typeof body.profileImageUrl === "string" && body.profileImageUrl.trim().length > 0
        ? body.profileImageUrl.trim()
        : undefined;

    let username: string | undefined;
    if (needsUsername) {
      const parsedUsername = usernameSchema.safeParse(body.username);
      if (!parsedUsername.success) {
        return NextResponse.json({ error: "Username is required for onboarding" }, { status: 400 });
      }
      username = parsedUsername.data.toLowerCase();
    } else if (typeof body.username === "string" && body.username.trim().length > 0) {
      const parsedUsername = usernameSchema.safeParse(body.username);
      if (!parsedUsername.success) {
        return NextResponse.json({ error: "Invalid username" }, { status: 400 });
      }
      username = parsedUsername.data.toLowerCase();
    }

    if (username) {
      const usernameOwner = await prisma.user.findFirst({
        where: {
          username,
          id: {
            not: session.user.id
          }
        },
        select: {
          id: true
        }
      });

      if (usernameOwner) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        name: `${profileData.firstName} ${profileData.lastName}`,
        ...(username ? { username } : {}),
        ...(profileImageUrl ? { image: profileImageUrl } : {}),
        profile: {
          upsert: {
            create: {
              firstName: profileData.firstName,
              lastName: profileData.lastName,
              fatherName: profileData.fatherName,
              university: profileData.university,
              faculty: profileData.faculty,
              department: profileData.department,
              degreeLevel: profileData.degreeLevel,
              yearOfEnrollment: profileData.yearOfEnrollment,
              dateOfBirth: profileData.dateOfBirth,
              totalSemesters: profileData.totalSemesters,
              minimumPassingMarks: profileData.minimumPassingMarks,
              idealPercentage: profileData.idealPercentage ?? null
            },
            update: {
              firstName: profileData.firstName,
              lastName: profileData.lastName,
              fatherName: profileData.fatherName,
              university: profileData.university,
              faculty: profileData.faculty,
              department: profileData.department,
              degreeLevel: profileData.degreeLevel,
              yearOfEnrollment: profileData.yearOfEnrollment,
              dateOfBirth: profileData.dateOfBirth,
              totalSemesters: profileData.totalSemesters,
              minimumPassingMarks: profileData.minimumPassingMarks,
              idealPercentage: profileData.idealPercentage ?? null
            }
          }
        }
      },
      select: {
        id: true,
        username: true,
        image: true,
        profile: true
      }
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Profile update failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
