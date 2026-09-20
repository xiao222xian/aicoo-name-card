import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getSession: vi.fn(),
  getCardByOwner: vi.fn(),
  listSharedAgents: vi.fn(),
  aicooRequest: vi.fn(),
}));
vi.mock("../src/lib/store", () => mocks);
vi.mock("../src/lib/aicoo", () => mocks);
vi.mock("../src/lib/oauth", () => mocks);
import { renewalDue, renewOwner } from "../src/lib/renewal";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue([
    { owner_id: "a", session_id: "s", agent_id: "agent" },
  ]);
  mocks.getSession.mockResolvedValue({ id: "s", user: { id: "a" } });
  mocks.getCardByOwner.mockResolvedValue({ agent: { id: "agent" } });
  mocks.listSharedAgents.mockResolvedValue([
    {
      id: "agent",
      isActive: true,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  ]);
  mocks.aicooRequest.mockResolvedValue(
    Response.json({
      success: true,
      shareLink: {
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    }),
  );
});
it("only renews unexpired links near expiry", () => {
  const now = 1000000000;
  expect(renewalDue(new Date(now + 1000).toISOString(), now)).toBe(true);
  for (const value of [
    undefined,
    null,
    "bad",
    new Date(now - 1).toISOString(),
    new Date(now + 3 * 86400000).toISOString(),
  ])
    expect(renewalDue(value, now)).toBe(false);
});
it("renewal changes expiry only, never access permissions", async () => {
  expect(await renewOwner("a")).toBe("renewed");
  expect(mocks.aicooRequest).toHaveBeenCalledWith(
    expect.anything(),
    "/os/share/agent",
    { method: "PATCH", body: JSON.stringify({ expiresIn: "30d" }) },
  );
});
it("revoked or absent links are not resurrected", async () => {
  mocks.listSharedAgents.mockResolvedValue([]);
  expect(await renewOwner("a")).toBe("failed");
  expect(mocks.aicooRequest).not.toHaveBeenCalled();
});
it("disabled or leased renewal has no side effects", async () => {
  mocks.query.mockResolvedValue([]);
  expect(await renewOwner("a")).toBe("skipped");
  expect(mocks.getSession).not.toHaveBeenCalled();
});
it("a different bound agent cannot be renewed with old consent", async () => {
  mocks.getCardByOwner.mockResolvedValue({ agent: { id: "new" } });
  expect(await renewOwner("a")).toBe("failed");
  expect(mocks.aicooRequest).not.toHaveBeenCalled();
});
it("a disabled or superseded worker cannot report success", async () => {
  mocks.query
    .mockResolvedValueOnce([
      { owner_id: "a", session_id: "s", agent_id: "agent" },
    ])
    .mockResolvedValue([]);
  expect(await renewOwner("a")).toBe("superseded");
  const cardWrite = mocks.query.mock.calls.find(([sql]) =>
    sql.includes("UPDATE name_cards"),
  );
  expect(cardWrite?.[0]).toContain("r.lease_token=$4");
  expect(cardWrite?.[0]).toContain("r.enabled=true");
  const final = mocks.query.mock.calls.at(-1)!;
  expect(final[0]).toContain("lease_token=$3");
  expect(final[1][2]).toBe(cardWrite?.[1][3]);
});
