import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), renewOwner: vi.fn() }));
vi.mock("../src/lib/store", () => mocks);
vi.mock("../src/lib/renewal", () => mocks);
import { GET, maxDuration } from "../src/app/api/maintenance/renewals/route";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "test-only");
});
it("isolates failed owners and reports actual outcomes with at most two workers", async () => {
  mocks.query.mockResolvedValue(
    Array.from({ length: 5 }, (_, i) => ({ owner_id: String(i) })),
  );
  let active = 0,
    peak = 0;
  mocks.renewOwner.mockImplementation(async (owner) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    if (owner === "0") throw new Error("DB error");
    return owner === "1" ? "skipped" : "checked";
  });
  const response = await GET(
    new Request("https://example.com", {
      headers: { authorization: "Bearer test-only" },
    }),
  );
  const result = await response.json();
  expect(result.selected).toBe(5);
  expect(result.succeeded).toBe(3);
  expect(result.outcomes).toHaveLength(5);
  expect(peak).toBe(2);
  expect(maxDuration).toBe(300);
});
