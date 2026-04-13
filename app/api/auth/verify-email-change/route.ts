import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { consumeToken, parseEmailChangeToken } from "@/lib/tokens";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const parsed = await parseEmailChangeToken(token);
  if (!parsed.valid) {
    return NextResponse.json({ error: parsed.reason }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: parsed.userId
    },
    select: {
      id: true,
      pendingEmail: true
    }
  });

  if (!user) {
    await consumeToken(token);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.pendingEmail?.toLowerCase() !== parsed.newEmail.toLowerCase()) {
    return NextResponse.json({ error: "Email change request no longer valid" }, { status: 400 });
  }

  const existingOwner = await prisma.user.findFirst({
    where: {
      email: parsed.newEmail.toLowerCase(),
      id: {
        not: user.id
      }
    },
    select: {
      id: true
    }
  });

  if (existingOwner) {
    return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
  }

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      email: parsed.newEmail.toLowerCase(),
      emailVerified: new Date(),
      pendingEmail: null
    }
  });

  await consumeToken(token);

  return NextResponse.json({
    message: "Email changed and verified successfully"
  });
}
