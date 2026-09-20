import { getCardByOwner, getSession, query } from "./store";
import { listSharedAgents } from "./aicoo";
import { aicooRequest } from "./oauth";
import { AppError } from "./errors";

export function renewalDue(
  expiresAt: string | null | undefined,
  now = Date.now(),
) {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) && time > now && time - now < 2 * 86400000;
}
export async function renewOwner(owner: string) {
  const lease = crypto.randomUUID();
  const rows = await query(
    `UPDATE card_renewals SET lease_until=now()+interval '90 seconds',lease_token=$2
    WHERE owner_id=$1 AND enabled=true AND (lease_until IS NULL OR lease_until<now()) RETURNING *`,
    [owner, lease],
  );
  if (!rows.length) return "skipped";
  const pref = rows[0];
  let status = "checked";
  let message: string | null = null;
  try {
    const session = await getSession(pref.session_id);
    if (!session || session.user.id !== owner)
      throw new AppError("Reconnect Aicoo and re-enable renewal.", 401);
    const card = await getCardByOwner(owner);
    if (card?.agent?.id !== pref.agent_id)
      throw new AppError("Bound agent changed. Re-enable renewal.", 409);
    const agent = (await listSharedAgents(session)).find(
      (a) => a.id === pref.agent_id && a.isActive,
    );
    if (!agent)
      throw new AppError(
        "Agent unavailable, expired or revoked. Choose an active link.",
        409,
      );
    if (renewalDue(agent.expiresAt)) {
      const response = await aicooRequest(
        session,
        `/os/share/${encodeURIComponent(agent.id)}`,
        { method: "PATCH", body: JSON.stringify({ expiresIn: "30d" }) },
      );
      if (!response.ok)
        throw new AppError("Renewal failed. Check Aicoo permissions.", 502);
      const payload = await response.json();
      if (
        !payload?.success ||
        !Number.isFinite(Date.parse(payload.shareLink?.expiresAt))
      )
        throw new AppError("Renewal response could not be verified.", 502);
      agent.expiresAt = payload.shareLink.expiresAt;
      status = "renewed";
    }
    // Update only this agent's metadata, never overwrite concurrent card edits.
    await query(
      `UPDATE name_cards SET data=jsonb_set(data,'{agent}',$3::jsonb),updated_at=now()
      WHERE owner_id=$1 AND data->'agent'->>'id'=$2
      AND EXISTS (SELECT 1 FROM card_renewals r WHERE r.owner_id=$1 AND r.enabled=true AND r.lease_token=$4 AND r.lease_until>now())`,
      [owner, agent.id, JSON.stringify(agent), lease],
    );
  } catch (error) {
    status = "failed";
    message =
      error instanceof AppError
        ? error.message
        : "Renewal unavailable; retry later.";
  }
  const finished = await query(
    `UPDATE card_renewals SET status=$2,message=$4,checked_at=now(),lease_until=NULL,lease_token=NULL
    WHERE owner_id=$1 AND enabled=true AND lease_token=$3 AND lease_until>now() RETURNING owner_id`,
    [owner, status, lease, message],
  );
  return finished.length ? status : "superseded";
}
