import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("../src/lib/store", () => ({
  query: async (sql: string, params: unknown[]) =>
    (await state.db.query(sql, params)).rows,
}));
import {
  requestConnection,
  listConnections,
  transition,
  saveNote,
} from "../src/lib/connections";
beforeAll(async () => {
  state.db = new PGlite();
  await state.db.exec(await readFile("migrations/001_connections.sql", "utf8"));
  await state.db.exec(
    await readFile("migrations/002_review_safety.sql", "utf8"),
  );
});
afterAll(async () => {
  await state.db.close();
});
beforeEach(async () => {
  await state.db.exec(
    "TRUNCATE card_connection_notes,card_connections,name_cards",
  );
  for (const id of ["a", "b", "c"]) {
    await state.db.query(
      "INSERT INTO name_cards(id,owner_id,slug,data) VALUES($1,$1,$1,$2)",
      [id, JSON.stringify({ name: id, slug: id })],
    );
  }
});
describe("card exchange database", () => {
  it("retains terminal history and allows a fresh exchange", async () => {
    const first = await requestConnection("a", "b", "First meeting");
    await transition(first.id, "a", "cancel");
    const second = await requestConnection("b", "a", "Again");
    await transition(second.id, "a", "reject");
    const third = await requestConnection("a", "b", "Later");
    expect(third.id).not.toBe(first.id);
    expect(await listConnections("a")).toHaveLength(3);
    await transition(third.id, "b", "accept");
    await expect(
      requestConnection("b", "a", "Duplicate"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("concurrent reciprocal submissions create exactly one pair", async () => {
    const results = await Promise.allSettled([
      requestConnection("a", "b", "one"),
      requestConnection("b", "a", "two"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await listConnections("a")).toHaveLength(1);
  });
  it("creates one pair only, including reciprocal requests", async () => {
    await requestConnection("a", "b", "Conference");
    await expect(requestConnection("b", "a", "")).rejects.toMatchObject({
      status: 409,
    });
    expect(await listConnections("a")).toHaveLength(1);
    expect(await listConnections("b")).toHaveLength(1);
    expect(await listConnections("c")).toHaveLength(0);
  });
  it("refuses self exchanges", async () => {
    await expect(requestConnection("a", "a", "")).rejects.toMatchObject({
      status: 400,
    });
  });
  it("only recipient can accept; transitions are single use", async () => {
    const { id } = await requestConnection("a", "b", "");
    await expect(transition(id, "c", "accept")).rejects.toMatchObject({
      status: 409,
    });
    await expect(transition(id, "a", "accept")).rejects.toMatchObject({
      status: 409,
    });
    await transition(id, "b", "accept");
    await expect(transition(id, "b", "reject")).rejects.toMatchObject({
      status: 409,
    });
    expect((await listConnections("a"))[0].status).toBe("accepted");
    expect((await listConnections("b"))[0].status).toBe("accepted");
  });
  it("only sender cancels and notes remain private", async () => {
    const { id } = await requestConnection("a", "b", "");
    await saveNote(id, "a", "private A");
    await saveNote(id, "b", "private B");
    await expect(saveNote(id, "c", "intrusion")).rejects.toMatchObject({
      status: 404,
    });
    expect((await listConnections("a"))[0].note).toBe("private A");
    expect((await listConnections("b"))[0].note).toBe("private B");
    await expect(transition(id, "b", "cancel")).rejects.toMatchObject({
      status: 409,
    });
    await transition(id, "a", "cancel");
  });
  it("slug uniqueness is enforced without overwriting someone else", async () => {
    await expect(
      state.db.query(
        "INSERT INTO name_cards(id,owner_id,slug,data) VALUES('z','z','a','{}')",
      ),
    ).rejects.toMatchObject({ code: "23505" });
    expect(
      (await state.db.query("SELECT * FROM name_cards WHERE slug='a'")).rows,
    ).toHaveLength(1);
  });
});
