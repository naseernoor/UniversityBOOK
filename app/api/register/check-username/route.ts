import { NextResponse } from "next/server";

import { isMissingUserFieldError } from "@/lib/db-compat";
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

  let existing: { id: string } | null = null;

  try {
    existing = await prisma.user.findUnique({
      where: {
        username: normalized
      },
      select: {
        id: true
      }
    });
  } catch (error) {
    if (!isMissingUserFieldError(error, "username")) {
      throw error;
    }

    return NextResponse.json({
      available: true,
      normalized,
      message: "Username checks are temporarily limited on this deployment. You can continue."
    });
  }

  return NextResponse.json({
    available: !existing,
    normalized
  });
}
