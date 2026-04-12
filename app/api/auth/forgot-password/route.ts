import { NextResponse } from "next/server";

import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/tokens";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        {
          message: "If that email exists, a password reset link has been sent"
        },
        { status: 200 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email
      },
      include: {
        profile: {
          select: {
            firstName: true
          }
        }
      }
    });

    if (user?.passwordHash) {
      const token = await createPasswordResetToken(email);
      await sendPasswordResetEmail({
        toEmail: email,
        firstName: user.profile?.firstName ?? user.name,
        token
      });
    }

    return NextResponse.json({
      message: "If that email exists, a password reset link has been sent"
    });
  } catch (error) {
    console.error("Forgot password failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
