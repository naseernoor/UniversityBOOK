import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { adminReviewSchema, semesterVerificationRequestSchema } from "@/lib/validators";

type Params = {
  params: {
    semesterId: string;
  };
};

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = semesterVerificationRequestSchema.safeParse({
      ...body,
      semesterId: params.semesterId
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid verification request",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const semester = await prisma.semester.findFirst({
      where: {
        id: params.semesterId,
        userId: session.user.id
      },
      select: {
        id: true
      }
    });

    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    const updated = await prisma.semester.update({
      where: {
        id: params.semesterId
      },
      data: {
        verificationStatus: "PENDING",
        verificationDocumentUrl: parsed.data.documentUrl,
        verificationDocumentName: parsed.data.documentName ?? null,
        verificationRequestedAt: new Date(),
        verificationReviewedAt: null,
        verificationReviewNote: null,
        verificationReviewedById: null
      },
      select: {
        id: true,
        verificationStatus: true
      }
    });

    const requester = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        username: true,
        email: true,
        profile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const requesterName = requester?.profile
      ? `${requester.profile.firstName} ${requester.profile.lastName}`
      : requester?.username ?? requester?.email ?? "A student";

    await notifyAdmins({
      actorId: session.user.id,
      type: "SEMESTER_VERIFICATION_REQUEST",
      title: "New semester verification request",
      body: `${requesterName} submitted semester marks for review`,
      link: "/admin",
      data: {
        semesterId: params.semesterId,
        userId: session.user.id
      }
    });

    return NextResponse.json({
      message: "Semester verification request submitted",
      semester: updated
    });
  } catch (error) {
    console.error("Semester verification request failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

    const semester = await prisma.semester.findUnique({
      where: {
        id: params.semesterId
      },
      select: {
        id: true,
        userId: true,
        verificationStatus: true
      }
    });

    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    const nextStatus = parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED";

    const updated = await prisma.semester.update({
      where: {
        id: semester.id
      },
      data: {
        verificationStatus: nextStatus,
        verificationReviewedAt: new Date(),
        verificationReviewNote: parsed.data.note ?? null,
        verificationReviewedById: actor.id
      },
      select: {
        id: true,
        verificationStatus: true,
        verificationReviewNote: true,
        verificationReviewedAt: true
      }
    });

    await prisma.adminActionLog.create({
      data: {
        adminId: actor.id,
        targetUserId: semester.userId,
        action: `SEMESTER_VERIFICATION_${nextStatus}`,
        entityType: "SEMESTER",
        entityId: semester.id,
        detailsJson: JSON.stringify({
          previousStatus: semester.verificationStatus,
          note: parsed.data.note ?? null
        })
      }
    });

    await createNotification({
      userId: semester.userId,
      actorId: actor.id,
      type: "SEMESTER_VERIFICATION_STATUS",
      title:
        nextStatus === "APPROVED"
          ? "Semester verification approved"
          : "Semester verification rejected",
      body:
        nextStatus === "APPROVED"
          ? "Your semester marks have been verified by admin"
          : "Your semester verification was rejected. Please review and resubmit.",
      link: "/dashboard",
      data: {
        semesterId: semester.id,
        status: nextStatus,
        note: parsed.data.note ?? null
      }
    });

    return NextResponse.json({
      message: `Semester marked as ${nextStatus.toLowerCase()}`,
      semester: updated
    });
  } catch (error) {
    console.error("Semester verification review failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
