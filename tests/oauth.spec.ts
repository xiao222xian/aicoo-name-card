import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  claimRefresh: vi.fn(),
  extendRefresh: vi.fn(),
  finishRefresh: vi.fn(),
}));
vi.mock("../src/lib/store", () => mocks);
import { accessToken } from "../src/lib/oauth";
const session = {
  id: "session",
  user: { id: "owner", name: "Owner", email: "" },
  createdAt: new Date().toISOString(),
  accessToken: "old",
  refreshToken: "refresh",
  expiresAt: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ ...session });
  mocks.claimRefresh.mockResolvedValue(true);
  mocks.extendRefresh.mockResolvedValue(true);
  mocks.finishRefresh.mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn());
});
it("refreshes and persists rotated token", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      access_token: "new",
      refresh_token: "rotated",
      expires_in: 900,
    }),
  );
  expect(await accessToken(session)).toBe("new");
  expect(mocks.finishRefresh).toHaveBeenCalledWith(
    "session",
    expect.any(String),
    expect.objectContaining({ refreshToken: "rotated", accessToken: "new" }),
  );
});
it("uses an unexpired token without network calls", async () => {
  mocks.getSession.mockResolvedValue({
    ...session,
    expiresAt: Date.now() + 300000,
  });
  expect(await accessToken(session)).toBe("old");
  expect(fetch).not.toHaveBeenCalled();
});
it("re-reads the rotating token after winning the lease", async () => {
  mocks.getSession
    .mockResolvedValueOnce({ ...session })
    .mockResolvedValueOnce({
      ...session,
      accessToken: "concurrent-new",
      refreshToken: "concurrent-rotated",
      expiresAt: Date.now() + 300000,
    });
  expect(await accessToken(session)).toBe("concurrent-new");
  expect(fetch).not.toHaveBeenCalled();
});
it("does not race another refresh", async () => {
  mocks.claimRefresh.mockResolvedValue(false);
  await expect(accessToken(session)).rejects.toMatchObject({ status: 503 });
  expect(fetch).not.toHaveBeenCalled();
});
it("does not resurrect a logged out session", async () => {
  mocks.getSession.mockResolvedValue(null);
  await expect(accessToken(session)).rejects.toMatchObject({ status: 401 });
  expect(fetch).not.toHaveBeenCalled();
});
it("invalid grant clears unusable credentials", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ error: "invalid_grant" }, { status: 400 }),
  );
  await expect(accessToken(session)).rejects.toMatchObject({ status: 401 });
  expect(mocks.finishRefresh).toHaveBeenCalledWith(
    "session",
    expect.any(String),
    expect.objectContaining({
      accessToken: undefined,
      refreshToken: undefined,
    }),
  );
});
it("failed persistence after logout cannot return a token", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ access_token: "new", expires_in: 900 }),
  );
  mocks.finishRefresh.mockResolvedValue(false);
  await expect(accessToken(session)).rejects.toMatchObject({ status: 401 });
});
it("invalid_client preserves credentials for configuration recovery", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ error: "invalid_client" }, { status: 401 }),
  );
  await expect(accessToken(session)).rejects.toMatchObject({ status: 502 });
  expect(mocks.finishRefresh).toHaveBeenCalledWith(
    "session",
    expect.any(String),
    expect.objectContaining({ refreshToken: "refresh" }),
  );
});
it("concurrent request receives the winner's fresh token", async () => {
  mocks.claimRefresh.mockResolvedValue(false);
  mocks.getSession
    .mockResolvedValueOnce(session)
    .mockResolvedValue({
      ...session,
      accessToken: "winner",
      expiresAt: Date.now() + 300000,
    });
  expect(await accessToken(session)).toBe("winner");
  expect(fetch).not.toHaveBeenCalled();
});
it("uncertain rotated-token persistence never restores stale credentials", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      access_token: "new",
      refresh_token: "rotated",
      expires_in: 900,
    }),
  );
  mocks.finishRefresh.mockRejectedValue(new Error("DB response lost"));
  await expect(accessToken(session)).rejects.toMatchObject({ status: 502 });
  expect(mocks.finishRefresh).toHaveBeenCalledTimes(1);
});
it("does not call the provider after losing its lease", async () => {
  mocks.extendRefresh.mockResolvedValue(false);
  await expect(accessToken(session)).rejects.toMatchObject({ status: 503 });
  expect(fetch).not.toHaveBeenCalled();
});
