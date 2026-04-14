import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { securitySettingsSchema } from "@/lib/validators";

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
      email: true,
      pendingEmail: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
      twoFactorPhone: true,
      profile: {
        select: {
          profileVisibility: true,
          allowFriendRequests: true,
          defaultPostVisibility: true
        }
      }
    }
  });

  if (!user?.profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    settings: {
      email: user.email,
      pendingEmail: user.pendingEmail,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      twoFactorPhone: user.twoFactorPhone,
      profileVisibility: user.profile.profileVisibility,
      allowFriendRequests: user.profile.allowFriendRequests,
      defaultPostVisibility: user.profile.defaultPostVisibility
    }
  });
}

export async function PUT(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = securitySettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid security settings",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: session.user.id
        },
        data: {
          twoFactorEnabled: data.twoFactorEnabled,
          twoFactorMethod: data.twoFactorMethod,
          twoFactorPhone: data.twoFactorMethod === "PHONE" ? data.twoFactorPhone ?? null : null
        }
      }),
      prisma.profile.updateMany({
        where: {
          userId: session.user.id
        },
        data: {
          profileVisibility: data.profileVisibility,
          allowFriendRequests: data.allowFriendRequests,
          defaultPostVisibility: data.defaultPostVisibility
        }
      })
    ]);

    return NextResponse.json({ message: "Security settings updated" });
  } catch (error) {
    console.error("Failed to update security settings", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
