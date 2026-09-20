import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => ({ query: async (sql: string, values: unknown[]) => (await state.db.query(sql, values)).rows }),
}));
import { claimRefresh, extendRefresh, finishRefresh } from "../src/lib/store";
const session = { id:"s",user:{id:"u",name:"U",email:""},createdAt:new Date().toISOString(),refreshToken:"original" };
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL","postgres://test-only");
  state.db = new PGlite();
  await state.db.exec(await readFile("migrations/001_connections.sql","utf8"));
});
afterAll(async () => { await state.db.close(); });
beforeEach(async () => {
  await state.db.exec("TRUNCATE card_sessions");
  await state.db.query("INSERT INTO card_sessions(id,data) VALUES('s',$1)",[JSON.stringify(session)]);
});
it("only the owning live lease can extend and persist tokens", async () => {
  expect(await claimRefresh("s","first")).toBe(true);
  expect(await claimRefresh("s","second")).toBe(false);
  expect(await extendRefresh("s","second")).toBe(false);
  expect(await extendRefresh("s","first")).toBe(true);
  expect(await finishRefresh("s","second",session)).toBe(false);
  expect(await finishRefresh("s","first",{...session,refreshToken:"rotated"})).toBe(true);
  const rows = await state.db.query<{data:typeof session}>("SELECT data FROM card_sessions");
  expect(rows.rows[0].data.refreshToken).toBe("rotated");
});
it("expired leases cannot commit or renew even before a new worker claims", async () => {
  await claimRefresh("s","old");
  await state.db.exec("UPDATE card_sessions SET data=jsonb_set(data,'{refreshUntil}','0')");
  expect(await extendRefresh("s","old")).toBe(false);
  expect(await finishRefresh("s","old",session)).toBe(false);
  expect(await claimRefresh("s","new")).toBe(true);
  expect(await finishRefresh("s","old",session)).toBe(false);
});
it("logout prevents a worker from recreating the session", async () => {
  await claimRefresh("s","first");
  await state.db.exec("DELETE FROM card_sessions WHERE id='s'");
  expect(await finishRefresh("s","first",session)).toBe(false);
});
