import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { isMissingProfileGenderError, legacyProfileSelect } from "@/lib/db-compat";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";
import { adminUserUpdateSchema } from "@/lib/validators";

type Params = {
  params: {
    userId: string;
  };
};

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      role: true
    }
  });

  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let user;

  try {
    user = await prisma.user.findUnique({
      where: {
        id: params.userId
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        image: true,
        isBlueVerified: true,
        blueVerifiedAt: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            semesters: true,
            sentFriendRequests: true,
            receivedFriendRequests: true
          }
        }
      }
    });
  } catch (error) {
    if (!isMissingProfileGenderError(error)) {
      throw error;
    }

    user = await prisma.user.findUnique({
      where: {
        id: params.userId
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        image: true,
        isBlueVerified: true,
        blueVerifiedAt: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: legacyProfileSelect
        },
        _count: {
          select: {
            posts: true,
            comments: true,
            semesters: true,
            sentFriendRequests: true,
            receivedFriendRequests: true
          }
        }
      }
    });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = adminUserUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid user update",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: {
        id: params.userId
      },
      select: {
        id: true,
        role: true,
        isBlueVerified: true
      }
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (parsed.data.role !== undefined && !isSuperAdminRole(actor.role)) {
      return NextResponse.json(
        { error: "Only super admin can change user roles" },
        { status: 403 }
      );
    }

    if (
      parsed.data.role === "SUPER_ADMIN" &&
      !isSuperAdminRole(actor.role)
    ) {
      return NextResponse.json(
        { error: "Only super admin can assign super admin role" },
        { status: 403 }
      );
    }

    const updated = await prisma.user.update({
      where: {
        id: target.id
      },
      data: {
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.isBlueVerified !== undefined
          ? {
              isBlueVerified: parsed.data.isBlueVerified,
              blueVerifiedAt: parsed.data.isBlueVerified ? new Date() : null,
              blueVerifiedById: parsed.data.isBlueVerified ? actor.id : null
            }
          : {})
      },
      select: {
        id: true,
        role: true,
        isBlueVerified: true,
        blueVerifiedAt: true
      }
    });

    await prisma.adminActionLog.create({
      data: {
        adminId: actor.id,
        targetUserId: target.id,
        action: "UPDATE_USER",
        entityType: "USER",
        entityId: target.id,
        detailsJson: JSON.stringify({
          previousRole: target.role,
          nextRole: updated.role,
          previousBlueVerified: target.isBlueVerified,
          nextBlueVerified: updated.isBlueVerified
        })
      }
    });

    return NextResponse.json({
      message: "User updated",
      user: updated
    });
  } catch (error) {
    console.error("Failed to update user", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
