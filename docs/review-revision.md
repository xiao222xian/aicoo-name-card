# PR #1 review revision

Local revision of the 14 inline comments from the September 20 review.
This is not a claim that the maintainer has approved or resolved the threads.

| Comment | Change / disposition |
| --- | --- |
| 4056620643 | Request-URL origin check; preview/local and spoofed forwarded-host regression tests |
| 4056620644 | Actions pinned to verified v4 commit SHAs; workflow activation and branch protection remain maintainer-owned |
| 4056620645 | Migration 002 replaces global pair uniqueness with a live-state partial index; cancel/reject then re-request keeps history |
| 4056620646 | Unchanged agent binding is retained from storage; missing username claim does not erase a verified stored value |
| 4056620647 | Bad provider URLs are skipped per entry rather than hiding the whole list |
| 4056620649 | Only explicit invalid_grant clears credentials; configuration/transient errors preserve them |
| 4056620652 | PublicCardPage passes an explicit allowlisted DTO to the client component, keeping server ownership checks intact |
| 4056620654 | Upload attempt quota reserved before Sharp; corrupt inputs and Blob failures deliberately consume attempts |
| 4056620658 | Renewal metadata/status writes fenced by live lease token and enabled flag; status code separated from message |
| 4056620659 | Bounded loser polling, pre-provider lease extension and expiry-fenced persistence; no stale rollback after uncertain token write |
| 4056620660 | Stable UID, updatedAt-based REV and grouped booking URL plus note fallback; real-device deduplication remains unverified |
| 4056620661 | Unknown sync status recorded before request; guarded JSON and recognized success/conflict cases only |
| 4056620664 | Two maintenance workers, per-owner isolation, truthful outcomes, maxDuration and due index; opt-in no longer runs renewal inline; UI reconciles ambiguous saves |
| 4056620668 | Exact Next/ESLint-next/Vitest versions; ESM test config; explicit Blob token and documented transitive SDK risk without vendor replacement |

## Verification

70 local tests (12 Node + 58 Vitest), including PGlite migration/history and refresh
lease SQL tests. Typecheck, ESLint and production build passed. Provider calls use
mocks; these do not establish deployed OAuth/Blob/contact/scheduler acceptance.
No production migration, deployment, merge or permission changes were performed.

## Deployment gates

- Apply 001 then 002 on a backed-up isolated database and verify the actual schema.
  Code and migration 002 are a coordinated rollout; do not deploy the code alone.
- Maintainer enables the new workflow and required checks; authorize fork preview.
- Validate actual reverse-proxy origin, OAuth grants, Blob storage and scheduler
  capacity/timeouts; net.contacts remains disabled until explicitly verified.
- Complete two-user/device flow and repeated contact imports. Full competitor
  trials also await approved test logins; see the separate product research note.
