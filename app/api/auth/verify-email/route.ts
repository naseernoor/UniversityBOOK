import { NextResponse } from "next/server";

import { consumeToken, parseVerificationToken } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const parsed = await parseVerificationToken(token, "verify");
  if (!parsed.valid) {
    return NextResponse.json({ error: parsed.reason }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: {
      email: parsed.email
    },
    select: {
      id: true
    }
  });

  if (!user) {
    await consumeToken(token);
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      emailVerified: new Date()
    }
  });

  await consumeToken(token);

  return NextResponse.json({ message: "Email verified successfully" });
}
