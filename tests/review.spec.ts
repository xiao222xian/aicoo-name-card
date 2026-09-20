import { expect, it, vi } from "vitest";
import { sameOrigin } from "../src/lib/http";
import { toPublicCard } from "../src/lib/public-card";
import { createDefaultCard } from "../src/lib/defaults";
import { buildVCard } from "../src/lib/vcard";
vi.mock("../src/lib/oauth", () => ({ aicooRequest: vi.fn() }));
import { aicooRequest } from "../src/lib/oauth";
import { listSharedAgents } from "../src/lib/aicoo";

it("accepts preview and localhost origins, rejects cross-site and spoofed forwarded hosts", () => {
  for (const origin of ["https://branch.vercel.app", "http://localhost:3000"])
    expect(() =>
      sameOrigin(
        new Request(`${origin}/api/cards/me`, { headers: { origin } }),
      ),
    ).not.toThrow();
  expect(() =>
    sameOrigin(
      new Request("https://branch.vercel.app/api/cards/me", {
        headers: {
          origin: "https://evil.example",
          "x-forwarded-host": "evil.example",
        },
      }),
    ),
  ).toThrow();
});
it("public DTO excludes internal identity and future private fields", () => {
  const card = {
    ...createDefaultCard("secret-owner"),
    aicooUsername: "private",
    secretFuture: "no",
  };
  const publicCard = toPublicCard(card);
  expect(publicCard).not.toHaveProperty("ownerId");
  expect(publicCard).not.toHaveProperty("aicooUsername");
  expect(publicCard).not.toHaveProperty("secretFuture");
  expect(publicCard.name).toBe(card.name);
});
it("vCard keeps stable identity, revision and booking without removing the agent", () => {
  const card = createDefaultCard("owner");
  card.meetingUrl = "https://example.com/book";
  card.updatedAt = "2026-09-21T00:00:00Z";
  const vcard = buildVCard(card).replace(/\r\n /g, "");
  expect(vcard).toContain(`UID:${card.id}`);
  expect(vcard).toContain("REV:2026-09-21T00:00:00.000Z");
  expect(vcard).toContain("item2.URL:https://example.com/book");
  expect(vcard).toContain("Book a meeting: https://example.com/book");
});
it("one malformed provider link does not hide valid agents", async () => {
  vi.mocked(aicooRequest).mockResolvedValue(
    Response.json({
      links: [
        { id: "bad", isActive: true, url: "javascript:bad" },
        null,
        { id: "good", isActive: true, url: "https://www.aicoo.io/a/good" },
      ],
    }),
  );
  const session = {
    id: "s",
    user: { id: "u", name: "U", email: "" },
    createdAt: new Date().toISOString(),
  };
  expect((await listSharedAgents(session)).map((a) => a.id)).toEqual(["good"]);
});
