import { timingSafeEqual } from "node:crypto";
import { query } from "@/lib/store";
import { renewOwner } from "@/lib/renewal";
import { errorResponse } from "@/lib/errors";
export const maxDuration = 300;
// Schedule externally only after staging acceptance. No cron is enabled by this PR.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    given.length !== expected.length ||
    !timingSafeEqual(given, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows =
      await query(`SELECT owner_id FROM card_renewals WHERE enabled=true
      AND (checked_at IS NULL OR checked_at<now()-interval '12 hours') ORDER BY checked_at NULLS FIRST LIMIT 10`);
    const outcomes: string[] = [];
    // Two workers bound provider load; isolate one owner's failure from others.
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 2 }, async () => {
        while (cursor < rows.length) {
          const row = rows[cursor++];
          try {
            outcomes.push(await renewOwner(row.owner_id));
          } catch {
            outcomes.push("failed");
          }
        }
      }),
    );
    return Response.json({
      selected: rows.length,
      succeeded: outcomes.filter((s) => s === "checked" || s === "renewed")
        .length,
      outcomes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
