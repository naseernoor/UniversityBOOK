import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { sendEmailChangeVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createEmailChangeToken } from "@/lib/tokens";
import { emailChangeRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = emailChangeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid email change request",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const newEmail = parsed.data.newEmail.toLowerCase();

    const currentUser = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        email: true,
        name: true,
        profile: {
          select: {
            firstName: true
          }
        }
      }
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.email?.toLowerCase() === newEmail) {
      return NextResponse.json({ error: "New email must be different from current email" }, { status: 400 });
    }

    const emailOwner = await prisma.user.findUnique({
      where: {
        email: newEmail
      },
      select: {
        id: true
      }
    });

    if (emailOwner) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }

    const token = await createEmailChangeToken({
      userId: currentUser.id,
      newEmail
    });

    await prisma.user.update({
      where: {
        id: currentUser.id
      },
      data: {
        pendingEmail: newEmail
      }
    });

    await sendEmailChangeVerificationEmail({
      toEmail: newEmail,
      token,
      firstName: currentUser.profile?.firstName ?? currentUser.name
    });

    return NextResponse.json({
      message: "Verification link sent to new email. The address will change after verification."
    });
  } catch (error) {
    console.error("Email change request failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
