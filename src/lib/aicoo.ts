import type { SharedAgent, StoredSession } from "@/lib/types";
import { aicooRequest } from "./oauth";
import { AppError } from "./errors";
import { safeUrl } from "./validation";

type AicooShareLink = {
  id?: string;
  token?: string;
  label?: string;
  url?: string;
  agentUrl?: string;
  isActive?: boolean;
  expiresAt?: string | null;
};

export async function listSharedAgents(
  session: StoredSession | null,
): Promise<SharedAgent[]> {
  if (!session) throw new AppError("Please sign in with Aicoo.", 401);
  const response = await aicooRequest(
    session,
    "/os/share/list?status=active&limit=50",
  );

  if (!response.ok) {
    throw new AppError("Unable to load agents. Please retry.", 502);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.links))
    throw new AppError("Unexpected agent response. Please retry.", 502);
  const links: AicooShareLink[] = payload.links;

  return links
    .filter(
      (link) =>
        link?.id && link.isActive === true && (link.url || link.agentUrl),
    )
    .flatMap((link) => {
      try {
        return [
          {
            id: String(link.id || link.token || link.url),
            label: String(link.label || "Aicoo Shared Agent"),
            url: safeUrl(link.url || link.agentUrl, "Agent URL"),
            agentUrl: safeUrl(link.agentUrl || link.url, "Agent URL"),
            isActive: Boolean(link.isActive ?? true),
            expiresAt: link.expiresAt,
          },
        ];
      } catch {
        return [];
      }
    });
}
