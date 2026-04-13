import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { isPrivateBlobUrl } from "@/lib/blob-url";

export const runtime = "nodejs";

const isBlobEnabled = () =>
  typeof process.env.BLOB_READ_WRITE_TOKEN === "string" &&
  process.env.BLOB_READ_WRITE_TOKEN.trim().length > 0;

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBlobEnabled()) {
    return NextResponse.json({ error: "Blob storage is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const blobUrl = searchParams.get("url");
  if (!blobUrl || !isPrivateBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "Invalid blob URL" }, { status: 400 });
  }

  try {
    const blobResult = await get(blobUrl, { access: "private" });
    if (!blobResult) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (blobResult.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: blobResult.blob.etag,
          "Cache-Control": "private, max-age=60"
        }
      });
    }

    return new NextResponse(blobResult.stream, {
      status: 200,
      headers: {
        "Content-Type": blobResult.blob.contentType,
        "Content-Disposition": blobResult.blob.contentDisposition,
        "Cache-Control": "private, max-age=300",
        ETag: blobResult.blob.etag
      }
    });
  } catch (error) {
    console.error("Failed to proxy private blob", error);
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
