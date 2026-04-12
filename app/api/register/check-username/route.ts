import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const usernameRegex = /^[\p{L}\p{N}_.-]+$/u;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const usernameInput = (searchParams.get("username") ?? "").trim();

  if (usernameInput.length < 3) {
    return NextResponse.json({
      available: false,
      message: "Username must be at least 3 characters"
    });
  }

  if (usernameInput.length > 30 || !usernameRegex.test(usernameInput)) {
    return NextResponse.json({
      available: false,
      message: "Username can use letters, numbers, ., _, -"
    });
  }

  const normalized = usernameInput.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: {
      username: normalized
    },
    select: {
      id: true
    }
  });

  return NextResponse.json({
    available: !existing,
    normalized
  });
}
