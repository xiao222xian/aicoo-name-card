import { put } from "@vercel/blob";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { requireSession } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { readLimited, sameOrigin } from "@/lib/http";
import { query } from "@/lib/store";
import { imageType } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireSession();
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      throw new AppError("Image storage is not configured.", 503);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;"))
      throw new AppError("Use a file upload.", 415);
    const bytes = await readLimited(request, 3 * 1024 * 1024 + 65536);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "content-type": contentType },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024)
      throw new AppError("Choose an image up to 3 MB.", 413);
    const data = Buffer.from(await file.arrayBuffer());
    const type = imageType(data);
    if (!type || type.mime !== file.type)
      throw new AppError("Only PNG, JPEG and WebP images are supported.", 415);
    // Reserve attempts before image decoding; corrupt inputs and storage failures
    // intentionally consume quota so retries cannot bypass the CPU bound.
    const quota = await query(
      `INSERT INTO card_upload_quotas(owner_id,day,count) VALUES($1,CURRENT_DATE,1)
      ON CONFLICT(owner_id,day) DO UPDATE SET count=card_upload_quotas.count+1
      WHERE card_upload_quotas.count<20 RETURNING count`,
      [session.user.id],
    );
    if (!quota.length)
      throw new AppError(
        "Daily upload limit reached. Please try tomorrow.",
        429,
      );
    let sanitized: Buffer;
    try {
      // Decode, bound pixel count and strip metadata rather than trusting a magic header.
      sanitized = await sharp(data, { limitInputPixels: 16000000 })
        .rotate()
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppError("Invalid image, or image exceeds 16 megapixels.", 415);
    }
    const owner = createHash("sha256")
      .update(session.user.id)
      .digest("hex")
      .slice(0, 24);
    const blob = await put(
      `cards/${owner}/${crypto.randomUUID()}.webp`,
      sanitized,
      {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      },
    );
    return Response.json({ url: blob.url });
  } catch (error) {
    return errorResponse(error);
  }
}
