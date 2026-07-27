import { NextResponse } from "next/server";

import { isMissingAnyLegacyUserFieldError } from "@/lib/db-compat";
import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createEmailVerificationToken } from "@/lib/tokens";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        {
          message: "If your account exists, we sent a verification email"
        },
        { status: 200 }
      );
    }

    let user:
      | {
          name: string | null;
          emailVerified: Date | null;
          profile?: {
            firstName: string;
          } | null;
        }
      | null;

    try {
      user = await prisma.user.findUnique({
        where: {
          email
        },
        select: {
          name: true,
          emailVerified: true,
          profile: {
            select: {
              firstName: true
            }
          }
        }
      });
    } catch (error) {
      if (!isMissingAnyLegacyUserFieldError(error)) {
        throw error;
      }

      user = await prisma.user.findUnique({
        where: {
          email
        },
        select: {
          name: true,
          emailVerified: true
        }
      });
    }

    if (user && !user.emailVerified) {
      const token = await createEmailVerificationToken(email);
      await sendVerificationEmail({
        toEmail: email,
        firstName: user.profile?.firstName ?? user.name,
        token
      });
    }

    return NextResponse.json({
      message: "If your account exists, we sent a verification email"
    });
  } catch (error) {
    console.error("Resend verification failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
