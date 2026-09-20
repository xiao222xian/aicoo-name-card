import { requireSession } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { sameOrigin } from "@/lib/http";
import { query } from "@/lib/store";
import { aicooRequest } from "@/lib/oauth";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const session = await requireSession();
    const { id } = await params;
    if (process.env.AICOO_CONTACTS_ENABLED !== "true")
      throw new AppError(
        "Aicoo contact integration awaits administrator scope verification. Your card exchange is saved locally.",
        503,
      );
    const rows = await query(
      `SELECT card.data FROM card_connections c JOIN name_cards card
      ON card.owner_id=CASE WHEN c.requester_id=$2 THEN c.recipient_id ELSE c.requester_id END
      WHERE c.id=$1 AND c.status='accepted' AND (c.requester_id=$2 OR c.recipient_id=$2)`,
      [id, session.user.id],
    );
    if (!rows.length)
      throw new AppError(
        "Accept the exchange before connecting on Aicoo.",
        409,
      );
    const username = rows[0].data.aicooUsername;
    if (
      typeof username !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(username) ||
      /_coo$/i.test(username)
    )
      throw new AppError(
        "A verified human Aicoo username is unavailable. Ask this person to reconnect and save their card.",
        409,
      );
    // Mark an attempt as uncertain before sending: a timeout or lost response
    // must not leave an old successful status in the local UI.
    await query(
      `INSERT INTO card_connection_notes(connection_id,owner_id,sync_status) VALUES($1,$2,'unknown')
      ON CONFLICT(connection_id,owner_id) DO UPDATE SET sync_status='unknown'`,
      [id, session.user.id],
    );
    const response = await aicooRequest(session, "/net/contacts/request", {
      method: "POST",
      body: JSON.stringify({ to: username }),
    });
    const payload = await response.json().catch(() => null);
    let status = "unknown";
    if (response.ok && payload?.success && payload.status === "approved")
      status = "connected";
    else if (response.ok && payload?.success && payload.status === "requested")
      status = "requested";
    else if (response.status === 409 && payload?.error === "already_connected")
      status = "connected";
    else if (response.status === 409 && payload?.error === "already_pending")
      status = "requested";
    await query(
      `INSERT INTO card_connection_notes(connection_id,owner_id,sync_status) VALUES($1,$2,$3)
      ON CONFLICT(connection_id,owner_id) DO UPDATE SET sync_status=EXCLUDED.sync_status`,
      [id, session.user.id, status],
    );
    if (status === "unknown")
      throw new AppError(
        "Aicoo could not confirm the connection. Check your Aicoo contacts before retrying.",
        502,
      );
    return Response.json({ status });
  } catch (error) {
    return errorResponse(error);
  }
}
