import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { adminReviewSchema } from "@/lib/validators";

type Params = {
  params: {
    requestId: string;
  };
};

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
    const parsed = adminReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid review request",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const verificationRequest = await prisma.profileVerificationRequest.findUnique({
      where: {
        id: params.requestId
      },
      select: {
        id: true,
        status: true,
        userId: true
      }
    });

    if (!verificationRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const nextStatus = parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED";

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.profileVerificationRequest.update({
        where: {
          id: verificationRequest.id
        },
        data: {
          status: nextStatus,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.note ?? null
        },
        select: {
          id: true,
          status: true,
          reviewedAt: true,
          reviewNote: true
        }
      });

      const updatedUser = await tx.user.update({
        where: {
          id: verificationRequest.userId
        },
        data:
          nextStatus === "APPROVED"
            ? {
                isBlueVerified: true,
                blueVerifiedAt: new Date(),
                blueVerifiedById: actor.id
              }
            : {
                isBlueVerified: false,
                blueVerifiedAt: null,
                blueVerifiedById: null
              },
        select: {
          id: true,
          isBlueVerified: true
        }
      });

      await tx.adminActionLog.create({
        data: {
          adminId: actor.id,
          targetUserId: verificationRequest.userId,
          action: `PROFILE_VERIFICATION_${nextStatus}`,
          entityType: "PROFILE_VERIFICATION_REQUEST",
          entityId: verificationRequest.id,
          detailsJson: JSON.stringify({
            previousStatus: verificationRequest.status,
            note: parsed.data.note ?? null
          })
        }
      });

      return {
        request: updatedRequest,
        user: updatedUser
      };
    });

    await createNotification({
      userId: verificationRequest.userId,
      actorId: actor.id,
      type: "PROFILE_VERIFICATION_STATUS",
      title:
        nextStatus === "APPROVED"
          ? "Profile verification approved"
          : "Profile verification rejected",
      body:
        nextStatus === "APPROVED"
          ? "Your blue badge verification has been approved"
          : "Your blue badge verification was rejected. You can submit again.",
      link: "/dashboard",
      data: {
        requestId: verificationRequest.id,
        status: nextStatus,
        note: parsed.data.note ?? null
      }
    });

    return NextResponse.json({
      message: `Request ${nextStatus.toLowerCase()}`,
      ...result
    });
  } catch (error) {
    console.error("Failed to review profile verification", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
