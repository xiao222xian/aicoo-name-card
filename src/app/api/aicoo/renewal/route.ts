import { requireSession } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { readJson, sameOrigin } from "@/lib/http";
import { record } from "@/lib/validation";
import { getCardByOwner, query } from "@/lib/store";
import { listSharedAgents } from "@/lib/aicoo";
export async function GET() {
  try {
    const session = await requireSession();
    const rows = await query(
      "SELECT enabled,status,message,checked_at FROM card_renewals WHERE owner_id=$1",
      [session.user.id],
    );
    return Response.json(rows[0] || { enabled: false, status: "disabled" });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireSession();
    const body = record(await readJson(request));
    if (typeof body.enabled !== "boolean")
      throw new AppError("Choose whether renewal is enabled.");
    if (!body.enabled) {
      await query(
        "UPDATE card_renewals SET enabled=false,status='disabled',message=NULL,lease_token=NULL,lease_until=NULL WHERE owner_id=$1",
        [session.user.id],
      );
      return Response.json({ enabled: false, status: "disabled" });
    }
    const card = await getCardByOwner(session.user.id);
    if (
      !card?.agent ||
      !(await listSharedAgents(session)).some(
        (a) => a.id === card.agent?.id && a.isActive,
      )
    )
      throw new AppError("Save a card with an active agent first.", 409);
    await query(
      `INSERT INTO card_renewals(owner_id,session_id,agent_id,enabled) VALUES($1,$2,$3,true)
      ON CONFLICT(owner_id) DO UPDATE SET session_id=EXCLUDED.session_id,agent_id=EXCLUDED.agent_id,enabled=true,status='enabled',message=NULL,checked_at=NULL,lease_token=NULL,lease_until=NULL`,
      [session.user.id, session.id, card.agent.id],
    );
    return Response.json({
      enabled: true,
      status: "enabled",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
