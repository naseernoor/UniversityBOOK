import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm"
];

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const getSafeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-");

const isBlobEnabled = () =>
  typeof process.env.BLOB_READ_WRITE_TOKEN === "string" &&
  process.env.BLOB_READ_WRITE_TOKEN.trim().length > 0;

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Unsupported file type for posts"
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Post file must be 20MB or smaller" }, { status: 400 });
    }

    let fileUrl: string;

    if (isBlobEnabled()) {
      const cleanOriginalName = getSafeFileName(file.name || "post-file");
      const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${cleanOriginalName}`;
      const blob = await put(`posts/${session.user.id}/${fileName}`, file, {
        access: "public"
      });
      fileUrl = blob.url;
    } else {
      const uploadsDirectory = path.join(process.cwd(), "public", "uploads", "posts", session.user.id);
      await fs.mkdir(uploadsDirectory, { recursive: true });

      const cleanOriginalName = getSafeFileName(file.name || "post-file");
      const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${cleanOriginalName}`;
      const absoluteFilePath = path.join(uploadsDirectory, fileName);
      const relativeFilePath = `/uploads/posts/${session.user.id}/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(absoluteFilePath, Buffer.from(arrayBuffer));
      fileUrl = relativeFilePath;
    }

    return NextResponse.json({
      media: {
        url: fileUrl,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      }
    });
  } catch (error) {
    console.error("Post upload failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

