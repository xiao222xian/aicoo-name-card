"use client";
import { useState, useEffect } from "react";
export function RenewalSettings() {
  const [enabled, setEnabled] = useState(false),
    [status, setStatus] = useState("Loading renewal settings…"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/aicoo/renewal")
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        return p;
      })
      .then((p) => {
        if (active) {
          setEnabled(p.enabled);
          setStatus(p.message || p.status);
        }
      })
      .catch(() => {
        if (active)
          setStatus(
            "Renewal settings unavailable. Check database configuration.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function change() {
    setBusy(true);
    try {
      const r = await fetch("/api/aicoo/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setEnabled(p.enabled);
      setStatus(p.status);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Please retry.");
      // The write may have completed even when its response was lost.
      try {
        const r = await fetch("/api/aicoo/renewal");
        if (r.ok) {
          const p = await r.json();
          setEnabled(p.enabled);
          setStatus(p.message || p.status);
        }
      } catch {
        /* Retain the actionable error if reconciliation also fails. */
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 rounded-xl border p-4 text-sm">
      <h3 className="font-bold">Keep my saved agent link active</h3>
      <p className="my-2">
        Optional: extend an active link by 30 days when fewer than 2 days
        remain. This extends how long others can access it, without changing
        permissions. Requires an administrator-configured scheduler and a valid
        Aicoo session; sign in again at least every 30 days. Expired or revoked
        links are never automatically restored.
      </p>
      <button
        className="rounded-full border px-4 py-2"
        disabled={busy}
        onClick={change}
      >
        {busy
          ? "Saving…"
          : enabled
            ? "Disable renewal"
            : "Enable renewal for saved agent"}
      </button>
      <p role="status" className="mt-2">
        {status}
      </p>
    </section>
  );
}
