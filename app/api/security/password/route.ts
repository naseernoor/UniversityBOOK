import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid password request",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        passwordHash: true
      }
    });

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Password login is not enabled for this account" }, { status: 400 });
    }

    const validCurrent = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!validCurrent) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const newPasswordHash = await hash(parsed.data.newPassword, 12);

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        passwordHash: newPasswordHash
      }
    });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Failed to change password", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
