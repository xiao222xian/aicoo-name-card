import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getBaseUrl: () => "https://www.agentport.world",
  getCardByOwner: vi.fn(),
  getCardBySlug: vi.fn(),
  saveCard: vi.fn(),
  query: vi.fn(),
  listSharedAgents: vi.fn(),
  requestConnection: vi.fn(),
  listConnections: vi.fn(),
  aicooRequest: vi.fn(),
  put: vi.fn(),
}));
vi.mock("../src/lib/auth", () => mocks);
vi.mock("../src/lib/store", () => mocks);
vi.mock("../src/lib/aicoo", () => mocks);
vi.mock("../src/lib/connections", () => mocks);
vi.mock("../src/lib/oauth", () => mocks);
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
import { POST as exchange } from "../src/app/api/connections/route";
import { PUT as save } from "../src/app/api/cards/me/route";
import { POST as sync } from "../src/app/api/connections/[id]/sync/route";
import { POST as upload } from "../src/app/api/upload/route";
import { AppError } from "../src/lib/errors";
import { createDefaultCard } from "../src/lib/defaults";
import sharp from "sharp";
const request = (body: unknown) =>
  new Request("https://www.agentport.world/api/test", {
    method: "POST",
    headers: {
      origin: "https://www.agentport.world",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireSession.mockResolvedValue({
    id: "s",
    user: { id: "me", username: "verified" },
  });
  mocks.getCardByOwner.mockResolvedValue(createDefaultCard("me"));
  mocks.getCardBySlug.mockResolvedValue(createDefaultCard("them"));
  mocks.saveCard.mockImplementation((c) => c);
  mocks.listSharedAgents.mockResolvedValue([]);
  mocks.query.mockResolvedValue([{ count: 1 }]);
  vi.stubEnv("AICOO_CONTACTS_ENABLED", "true");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-only-not-a-real-token");
});
it("unauthenticated exchange writes nothing", async () => {
  mocks.requireSession.mockRejectedValue(new AppError("Sign in", 401));
  expect((await exchange(request({ slug: "them" }))).status).toBe(401);
  expect(mocks.requestConnection).not.toHaveBeenCalled();
});
it("requires the sender's own saved card", async () => {
  mocks.getCardByOwner.mockResolvedValue(null);
  expect((await exchange(request({ slug: "them" }))).status).toBe(409);
  expect(mocks.requestConnection).not.toHaveBeenCalled();
});
it("uses authenticated identity and target lookup, not posted owner IDs", async () => {
  await exchange(
    request({ slug: "them", ownerId: "victim", recipientId: "victim" }),
  );
  expect(mocks.requestConnection).toHaveBeenCalledWith("me", "them", "");
});
it("cannot attach someone else's shared agent", async () => {
  expect(
    (
      await save(
        request({ ...createDefaultCard("victim"), agent: { id: "stolen" } }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.saveCard).not.toHaveBeenCalled();
});
it("server owns card identity and verified username", async () => {
  await save(
    request({ ...createDefaultCard("victim"), aicooUsername: "spoof" }),
  );
  expect(mocks.saveCard).toHaveBeenCalledWith(
    expect.objectContaining({ ownerId: "me", aicooUsername: "verified" }),
  );
});
it("editing contacts preserves the stored agent without depending on upstream availability", async () => {
  const card = {
    ...createDefaultCard("me"),
    aicooUsername: "previous",
    agent: {
      id: "bound",
      label: "Agent",
      url: "https://www.aicoo.io/a/a",
      agentUrl: "https://www.aicoo.io/a/a",
    },
  };
  mocks.requireSession.mockResolvedValue({ id: "s", user: { id: "me" } });
  mocks.getCardByOwner.mockResolvedValue(card);
  mocks.listSharedAgents.mockRejectedValue(new Error("unavailable"));
  expect(
    (
      await save(
        request({
          ...card,
          agent: { id: "bound", url: "https://evil.example" },
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.listSharedAgents).not.toHaveBeenCalled();
  expect(mocks.saveCard).toHaveBeenCalledWith(
    expect.objectContaining({ agent: card.agent, aicooUsername: "previous" }),
  );
});
it.each([null, { error: "unrecognized" }])(
  "unrecognized sync results stay unknown",
  async (payload) => {
    mocks.query.mockResolvedValue([{ data: { aicooUsername: "alice" } }]);
    mocks.aicooRequest.mockResolvedValue(
      Response.json(payload, { status: 409 }),
    );
    expect(
      (await sync(request({}), { params: Promise.resolve({ id: "x" }) }))
        .status,
    ).toBe(502);
    expect(mocks.query).toHaveBeenLastCalledWith(expect.any(String), [
      "x",
      "me",
      "unknown",
    ]);
  },
);
it("HTML upstream errors record unknown instead of returning a JSON parse 500", async () => {
  mocks.query.mockResolvedValue([{ data: { aicooUsername: "alice" } }]);
  mocks.aicooRequest.mockResolvedValue(
    new Response("<html>gateway error</html>", { status: 502 }),
  );
  expect(
    (await sync(request({}), { params: Promise.resolve({ id: "x" }) })).status,
  ).toBe(502);
  expect(mocks.query).toHaveBeenLastCalledWith(expect.any(String), [
    "x",
    "me",
    "unknown",
  ]);
});
it("sync refuses unaccepted or nonparticipant exchange", async () => {
  mocks.query.mockResolvedValue([]);
  expect(
    (await sync(request({}), { params: Promise.resolve({ id: "x" }) })).status,
  ).toBe(409);
  expect(mocks.aicooRequest).not.toHaveBeenCalled();
});
it("sync is gated until administrator verifies scopes", async () => {
  vi.stubEnv("AICOO_CONTACTS_ENABLED", "false");
  expect(
    (await sync(request({}), { params: Promise.resolve({ id: "x" }) })).status,
  ).toBe(503);
  expect(mocks.aicooRequest).not.toHaveBeenCalled();
});
it("does not silently request agent access", async () => {
  mocks.query.mockResolvedValue([{ data: { aicooUsername: "alice_coo" } }]);
  expect(
    (await sync(request({}), { params: Promise.resolve({ id: "x" }) })).status,
  ).toBe(409);
  expect(mocks.aicooRequest).not.toHaveBeenCalled();
});
it("records pending as requested, not connected", async () => {
  mocks.query.mockResolvedValue([{ data: { aicooUsername: "alice" } }]);
  mocks.aicooRequest.mockResolvedValue(
    Response.json({ success: true, status: "requested" }),
  );
  const response = await sync(request({}), {
    params: Promise.resolve({ id: "x" }),
  });
  expect(await response.json()).toEqual({ status: "requested" });
  expect(mocks.aicooRequest).toHaveBeenCalledWith(
    expect.anything(),
    "/net/contacts/request",
    { method: "POST", body: '{"to":"alice"}' },
  );
});
it("anonymous uploads cannot use Blob storage", async () => {
  mocks.requireSession.mockRejectedValue(new AppError("Sign in", 401));
  expect((await upload(request({}))).status).toBe(401);
  expect(mocks.put).not.toHaveBeenCalled();
});
it("cross origin upload is refused before storage", async () => {
  expect(
    (
      await upload(
        new Request("https://www.agentport.world/api/upload", {
          method: "POST",
          body: "x",
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.put).not.toHaveBeenCalled();
});

async function imageRequest(data: Uint8Array, type = "image/png") {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(data)], "image.png", { type }));
  return new Request("https://www.agentport.world/api/upload", {
    method: "POST",
    headers: { origin: "https://www.agentport.world" },
    body: form,
  });
}
it("decodes a real image and uploads only sanitized WebP", async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  mocks.query.mockResolvedValue([{ count: 1 }]);
  mocks.put.mockResolvedValue({
    url: "https://example.public.blob.vercel-storage.com/image.webp",
  });
  const response = await upload(await imageRequest(png));
  expect(response.status).toBe(200);
  const args = mocks.put.mock.calls[0];
  expect(args[0]).toMatch(/^cards\/[a-f0-9]+\/.*\.webp$/);
  expect((await sharp(args[1]).metadata()).format).toBe("webp");
});
it("rejects corrupt images despite a plausible magic header", async () => {
  expect(
    (
      await upload(
        await imageRequest(new Uint8Array([255, 216, 255, 224]), "image/jpeg"),
      )
    ).status,
  ).toBe(415);
  expect(mocks.put).not.toHaveBeenCalled();
});
it("refuses an exhausted upload quota", async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  mocks.query.mockResolvedValue([]);
  expect((await upload(await imageRequest(png))).status).toBe(429);
  expect(mocks.put).not.toHaveBeenCalled();
});
it("exhausted quota rejects even a corrupt image before decoding", async () => {
  mocks.query.mockResolvedValue([]);
  expect(
    (
      await upload(
        await imageRequest(new Uint8Array([255, 216, 255, 224]), "image/jpeg"),
      )
    ).status,
  ).toBe(429);
  expect(mocks.put).not.toHaveBeenCalled();
});
it("refuses declared oversized uploads before decoding", async () => {
  const request = new Request("https://www.agentport.world/api/upload", {
    method: "POST",
    headers: {
      origin: "https://www.agentport.world",
      "content-type": "multipart/form-data; boundary=abc",
      "content-length": "99999999",
    },
    body: "abc",
  });
  expect((await upload(request)).status).toBe(413);
  expect(mocks.put).not.toHaveBeenCalled();
});
