import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileVerificationRequestSchema } from "@/lib/validators";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.profileVerificationRequest.findMany({
    where: {
      userId: session.user.id
    },
    select: {
      id: true,
      documentType: true,
      documentUrl: true,
      documentName: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      isBlueVerified: true,
      blueVerifiedAt: true
    }
  });

  return NextResponse.json({
    isBlueVerified: Boolean(user?.isBlueVerified),
    blueVerifiedAt: user?.blueVerifiedAt ?? null,
    requests
  });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = profileVerificationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid profile verification request",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const created = await prisma.profileVerificationRequest.create({
      data: {
        userId: session.user.id,
        documentType: parsed.data.documentType,
        documentUrl: parsed.data.documentUrl,
        documentName: parsed.data.documentName ?? null,
        status: "PENDING"
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      message: "Verification request submitted",
      request: created
    });
  } catch (error) {
    console.error("Profile verification request failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

