import type { StoredSession } from "./types";
import { AppError } from "./errors";
import {
  claimRefresh,
  extendRefresh,
  finishRefresh,
  getSession,
} from "./store";

export const resource = "https://www.aicoo.io/api/v1";
export const scopes =
  "openid profile email offline_access os.share:read os.share:write" +
  (process.env.AICOO_CONTACTS_ENABLED === "true" ? " net.contacts:manage" : "");

export async function accessToken(session: StoredSession): Promise<string> {
  let current = await getSession(session.id);
  if (
    !current ||
    !Number.isFinite(Date.parse(current.createdAt)) ||
    Date.now() - Date.parse(current.createdAt) > 30 * 86400000
  )
    throw new AppError("Please sign in again.", 401);
  if (current.accessToken && (current.expiresAt || 0) > Date.now() + 60000)
    return current.accessToken;
  if (!current.refreshToken)
    throw new AppError("Please reconnect Aicoo to continue.", 401);
  const lease = crypto.randomUUID();
  if (!(await claimRefresh(current.id, lease))) {
    // Wait briefly for the winner, without ever racing its rotating token.
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const winner = await getSession(current.id);
      if (!winner) throw new AppError("Please sign in again.", 401);
      if (winner.accessToken && (winner.expiresAt || 0) > Date.now() + 60000)
        return winner.accessToken;
    }
    throw new AppError(
      "Your session is refreshing. Please retry in a moment.",
      503,
    );
  }
  let persistenceStarted = false;
  try {
    // A different request may have completed between our first read and claim.
    // Re-read under the lease before using a single-use rotating refresh token.
    const latest = await getSession(current.id);
    if (!latest)
      throw new AppError("Session ended. Please sign in again.", 401);
    current = latest;
    if (current.accessToken && (current.expiresAt || 0) > Date.now() + 60000) {
      if (!(await finishRefresh(current.id, lease, current)))
        throw new AppError("Session ended. Please sign in again.", 401);
      return current.accessToken;
    }
    if (!current.refreshToken)
      throw new AppError("Please reconnect Aicoo to continue.", 401);
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: process.env.AICOO_CLIENT_ID || "",
      resource,
    });
    if (process.env.AICOO_CLIENT_SECRET)
      body.set("client_secret", process.env.AICOO_CLIENT_SECRET);
    if (!(await extendRefresh(current.id, lease)))
      throw new AppError(
        "Session refresh ownership changed. Please retry.",
        503,
      );
    const response = await fetch("https://www.aicoo.io/api/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      if (
        (response.status === 400 || response.status === 401) &&
        failure?.error === "invalid_grant"
      ) {
        persistenceStarted = true;
        await finishRefresh(current.id, lease, {
          ...current,
          accessToken: undefined,
          refreshToken: undefined,
        });
        throw new AppError(
          "Aicoo authorization expired. Please sign in again.",
          401,
        );
      }
      throw new AppError("Aicoo is unavailable. Please retry.", 502);
    }
    const tokens = await response.json();
    if (
      !tokens ||
      typeof tokens.access_token !== "string" ||
      !Number.isFinite(Number(tokens.expires_in)) ||
      !(Number(tokens.expires_in) > 0)
    )
      throw new AppError("Invalid Aicoo token response.", 502);
    const next = {
      ...current,
      accessToken: tokens.access_token,
      refreshToken:
        typeof tokens.refresh_token === "string"
          ? tokens.refresh_token
          : current.refreshToken,
      scope: typeof tokens.scope === "string" ? tokens.scope : current.scope,
      expiresAt: Date.now() + Number(tokens.expires_in) * 1000,
    };
    persistenceStarted = true;
    if (!(await finishRefresh(current.id, lease, next)))
      throw new AppError("Session ended. Please sign in again.", 401);
    return next.accessToken;
  } catch (error) {
    // Clear only our lease; never overwrite a newer session or recreate logout.
    // A write may have succeeded even if its response was lost. Never restore
    // the pre-rotation credentials after attempting to persist new tokens.
    if (!persistenceStarted) await finishRefresh(current.id, lease, current);
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Aicoo could not refresh your session. Please retry.",
      502,
    );
  }
}

export async function aicooRequest(
  session: StoredSession,
  path: string,
  init: RequestInit = {},
) {
  const token = await accessToken(session);
  const response = await fetch(`${resource}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401)
    throw new AppError(
      "Please reconnect Aicoo; this session cannot access the API.",
      401,
    );
  if (response.status === 403)
    throw new AppError(
      "Aicoo permission is missing. Reconnect, or ask the app administrator to enable the required scopes.",
      403,
    );
  return response;
}
