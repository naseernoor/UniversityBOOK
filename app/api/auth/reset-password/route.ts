import { hash } from "bcryptjs";
import { z } from "zod";
import { NextResponse } from "next/server";

import { consumeToken, parseVerificationToken } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = resetSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const parsedToken = await parseVerificationToken(parsedBody.data.token, "reset");

    if (!parsedToken.valid) {
      return NextResponse.json({ error: parsedToken.reason }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: parsedToken.email
      },
      select: {
        id: true
      }
    });

    if (!user) {
      await consumeToken(parsedBody.data.token);
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const passwordHash = await hash(parsedBody.data.password, 12);

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        passwordHash
      }
    });

    await consumeToken(parsedBody.data.token);

    return NextResponse.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
