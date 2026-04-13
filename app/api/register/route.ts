import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createEmailVerificationToken } from "@/lib/tokens";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid registration data",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      },
      select: {
        id: true,
        email: true,
        username: true
      }
    });

    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Username";
      return NextResponse.json({ error: `${field} is already registered` }, { status: 409 });
    }

    const passwordHash = await hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        name: `${data.firstName} ${data.lastName}`,
        profile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            fatherName: data.fatherName,
            gender: data.gender,
            university: data.university,
            faculty: data.faculty,
            department: data.department,
            degreeLevel: data.degreeLevel,
            yearOfEnrollment: data.yearOfEnrollment,
            dateOfBirth: data.dateOfBirth,
            totalSemesters: data.totalSemesters,
            minimumPassingMarks: data.minimumPassingMarks,
            idealPercentage: data.idealPercentage ?? null
          }
        }
      },
      select: {
        id: true,
        email: true,
        username: true
      }
    });

    const verificationToken = await createEmailVerificationToken(email);
    await sendVerificationEmail({
      toEmail: email,
      firstName: data.firstName,
      token: verificationToken
    });

    return NextResponse.json({
      message: "Registration successful. Please verify your email to activate your account.",
      user
    });
  } catch (error) {
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
