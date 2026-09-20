# PR 1 review revision — 2026-09-21

Goal: address review correctness/security defects and produce an evidence-labelled
product-concept report. No UI copying, production writes, deployment or auto-merge.

Baseline: clean branch fix/preserve-agent-in-vcard at efa0070. Read all 14 inline
comments, README, entrypoint, next/status memory and affected modules/tests.

Plan:
1. Fix request-origin validation, public serialization, saved-binding isolation,
   malformed provider links, refresh error classification and concurrent refresh.
2. Preserve rejected/cancelled history while allowing explicit new requests through
   a versioned partial-index migration; no production migration execution.
3. Complete vCard identity/revision/booking; defend sync response parsing and
   record uncertain outcomes; reserve upload attempt quota before image decoding.
4. Fence renewal workers by lease identity, isolate failures, bound batch work,
   decouple opt-in persistence from provider renewal and reconcile UI on failure.
5. Pin existing dependency versions/actions; document Blob transitive risk without
   switching storage vendors or adding new dependencies.
6. Add regression tests, run test/typecheck/lint/build/diff checks; inspect diff.
7. Inspect competitor public interactive flows; stop at registration/consent gates.
   Report observed vs advertised vs unverified, focus on relationship/agent concepts.

Validation: Node24 tests incl. PGlite migration, provider mocks, request security,
vCard byte checks, typecheck, ESLint and production build. Real mobile import,
provider credentials, host routing and deployment remain separate acceptance.
Cleanup: temporary browser tabs closed; generated output stays ignored. Preserve
user work. Changes remain reviewable in Git; no destructive rollback. CI activation
and branch protection are maintainer-owned; no claim all comments resolved remotely.

Outcome: implemented the code changes and migration 002; 70 local tests pass,
along with types/lint/build. See docs/review-revision.md for comment mapping and
docs/product-research-2026-09-21.md for evidence-labelled public-flow research.
Account-gated competitor trials and deployed acceptance remain open.
