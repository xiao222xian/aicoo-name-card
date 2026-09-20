import { createHash, randomUUID } from "node:crypto";
import { query } from "./store";
import { AppError } from "./errors";

export async function requestConnection(
  from: string,
  to: string,
  event: string,
) {
  if (from === to)
    throw new AppError("You cannot exchange a card with yourself.");
  const key = createHash("sha256")
    .update(JSON.stringify([from, to].sort()))
    .digest("hex");
  const rows = await query(
    `INSERT INTO card_connections(id,requester_id,recipient_id,pair_key,status,event)
    VALUES($1,$2,$3,$4,'pending',$5) ON CONFLICT(pair_key) WHERE status IN ('pending','accepted') DO NOTHING RETURNING id`,
    [randomUUID(), from, to, key, event],
  );
  if (!rows.length)
    throw new AppError(
      "An exchange already exists between these accounts.",
      409,
    );
  return rows[0];
}
export async function listConnections(owner: string) {
  return query(
    `SELECT c.id,c.status,c.event,c.created_at,c.updated_at,
    (c.recipient_id=$1) AS incoming, card.data AS card,
    COALESCE(n.note,'') AS note,COALESCE(n.sync_status,'not_synced') AS sync_status
    FROM card_connections c
    JOIN name_cards card ON card.owner_id=CASE WHEN c.requester_id=$1 THEN c.recipient_id ELSE c.requester_id END
    LEFT JOIN card_connection_notes n ON n.connection_id=c.id AND n.owner_id=$1
    WHERE c.requester_id=$1 OR c.recipient_id=$1 ORDER BY c.updated_at DESC LIMIT 200`,
    [owner],
  );
}
export async function transition(id: string, owner: string, action: string) {
  const status = (
    { accept: "accepted", reject: "rejected", cancel: "cancelled" } as Record<
      string,
      string
    >
  )[action];
  if (!status) throw new AppError("Unknown exchange action.");
  const actor = action === "cancel" ? "requester_id" : "recipient_id";
  const rows = await query(
    `UPDATE card_connections SET status=$3,updated_at=now()
    WHERE id=$1 AND ${actor}=$2 AND status='pending' RETURNING id`,
    [id, owner, status],
  );
  if (!rows.length)
    throw new AppError("Exchange is unavailable or has already changed.", 409);
}
export async function saveNote(id: string, owner: string, note: string) {
  const rows = await query(
    `INSERT INTO card_connection_notes(connection_id,owner_id,note)
    SELECT id,$2,$3 FROM card_connections WHERE id=$1 AND (requester_id=$2 OR recipient_id=$2)
    ON CONFLICT(connection_id,owner_id) DO UPDATE SET note=EXCLUDED.note RETURNING connection_id`,
    [id, owner, note],
  );
  if (!rows.length) throw new AppError("Exchange not found.", 404);
}
