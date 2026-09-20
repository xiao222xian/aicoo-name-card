import { AppError } from "./errors";

export function sameOrigin(request: Request) {
  // The request URL is supplied by the server adapter. Never trust a caller's
  // x-forwarded-host, or the build-time public URL (which breaks previews).
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new AppError("Cross-site request refused.", 403);
}
export async function readLimited(request: Request, max: number) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > max) throw new AppError("Request too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Empty request.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) {
        await reader.cancel();
        throw new AppError("Request too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("Expected JSON.", 415);
  const bytes = await readLimited(request, 32 * 1024);
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new AppError("Invalid JSON.");
  }
}
