import { randomUUID } from "crypto";
import { del, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

const getExtension = (fileName: string, mimeType: string) => {
  const extFromName = path.extname(fileName).replace(".", "").toLowerCase();
  if (extFromName) {
    return extFromName;
  }

  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  return "webp";
};

const isBlobEnabled = () =>
  typeof process.env.BLOB_READ_WRITE_TOKEN === "string" &&
  process.env.BLOB_READ_WRITE_TOKEN.trim().length > 0;

const isBlobUrl = (value: string) => value.includes(".blob.vercel-storage.com/");

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Unsupported image type. Please upload JPG, PNG, or WEBP"
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: "Image must be 4MB or smaller" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        image: true
      }
    });

    let imageUrl: string;

    if (isBlobEnabled()) {
      const extension = getExtension(file.name, file.type);
      const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
      const blob = await put(`profile/${session.user.id}/${fileName}`, file, {
        access: "public"
      });

      imageUrl = blob.url;

      if (existingUser?.image && isBlobUrl(existingUser.image)) {
        await del(existingUser.image).catch(() => undefined);
      }
    } else {
      const uploadsDirectory = path.join(process.cwd(), "public", "uploads", "profile");
      await fs.mkdir(uploadsDirectory, { recursive: true });

      const extension = getExtension(file.name, file.type);
      const fileName = `${session.user.id}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
      const absoluteFilePath = path.join(uploadsDirectory, fileName);
      const relativeFilePath = `/uploads/profile/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absoluteFilePath, Buffer.from(arrayBuffer));

      imageUrl = relativeFilePath;

      if (existingUser?.image?.startsWith("/uploads/profile/")) {
        const previousPath = path.join(
          process.cwd(),
          "public",
          existingUser.image.replace(/^\/+/, "")
        );
        await fs.unlink(previousPath).catch(() => undefined);
      }
    }

    await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        image: imageUrl
      }
    });

    return NextResponse.json({
      imageUrl
    });
  } catch (error) {
    console.error("Profile photo upload failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
