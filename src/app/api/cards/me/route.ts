import { createDefaultCard } from "@/lib/defaults";
import { requireSession } from "@/lib/auth";
import { getCardByOwner, saveCard } from "@/lib/store";
import { editCard, record } from "@/lib/validation";
import { readJson, sameOrigin } from "@/lib/http";
import { AppError, errorResponse } from "@/lib/errors";
import { listSharedAgents } from "@/lib/aicoo";

export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireSession();
    const body = record(await readJson(request));
    const base =
      (await getCardByOwner(session.user.id)) ||
      createDefaultCard(session.user.id);
    const card = editCard(base, body);
    card.aicooUsername = session.user.username || base.aicooUsername;
    if (!body.agent) card.agent = undefined;
    else {
      const id = record(body.agent).id;
      card.agent =
        id === base.agent?.id
          ? base.agent
          : (await listSharedAgents(session)).find((agent) => agent.id === id);
      if (!card.agent)
        throw new AppError("Choose one of your active shared agents.");
    }
    return Response.json({ card: await saveCard(card) });
  } catch (error) {
    return errorResponse(error);
  }
}
