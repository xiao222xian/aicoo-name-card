# Agentport — Aicoo Agent Name Cards

Conference-ready public cards with Aicoo agents and consent-based exchanges.
Canonical production origin: https://www.agentport.world.

## What this PR implements

- Aicoo OAuth PKCE, scoped API requests, rotating-token refresh with a database
  lease, 30-day application sessions, clear reconnect errors. No shared API-key fallback.
- Validated card editing; slug conflicts return 409 rather than overwrite another
  card. Public agent binding is verified against the signed-in owner's active links.
- Authenticated Vercel Blob uploads: PNG/JPEG/WebP, 3 MB input, 16 MP decode limit,
  metadata-stripping WebP conversion, public-upload disclosure and 20 uploads/day/user.
- Public cards, QR, PNG and vCard exports; vCard preserves the agent URL.
  Booking uses a custom booking URL when supplied, otherwise the agent or email.
- Card exchange requests: the recipient must accept. Both participants can see
  the accepted connection; notes are private. Repeat and reciprocal requests
  cannot create duplicate pairs. Rejected/cancelled pairs remain recorded.
- Optional, explicit Aicoo human contact requests. Pending and confirmed states
  are separate; no agent access grants or automated messages.
- Opt-in link renewal with expiry-only PATCH. It never deliberately reactivates
  expired/revoked links, changes their access scope or removes sign-in requirements.

## Development

Use Node.js 24 LTS and npm.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Tests need no production credentials: vCard tests use Node's native runner;
Vitest covers HTTP/security/OAuth/renewals and uses PGlite for real SQL constraints
and exchange transitions. Provider calls are mocked, not live-provider acceptance.
Build downloads Geist fonts and therefore needs internet.

Obtain **development-only** credentials securely from the maintainer. Copy the
variable names from .env.example, never credentials into Git or PR comments.

| Variable | Purpose |
| --- | --- |
| NEXT_PUBLIC_APP_URL | Exact app origin; localhost:3000 for local development |
| AICOO_CLIENT_ID / AICOO_CLIENT_SECRET | Registered development OAuth client |
| AICOO_REDIRECT_URI | Exact registered redirect; production stays www root |
| DATABASE_URL | Neon/Postgres database with migration applied |
| BLOB_READ_WRITE_TOKEN | Public Blob store belonging to this application |
| CRON_SECRET | Random secret for the maintenance endpoint |
| AICOO_CONTACTS_ENABLED | false until net.contacts:manage and user identity are verified |

The production OAuth redirect remains **https://www.agentport.world** (root,
not /callback). The home route forwards code/state to the internal callback.
For local auth, the administrator must register the exact local redirect and origin.

Apply migrations/001_connections.sql, then migrations/002_review_safety.sql explicitly to a backed-up **development**
database before integration testing. There is no request-time schema creation.
Without a DB, local card/session storage still works in ignored .data/db.json for
development only; exchanges, uploads and renewal settings require PostgreSQL.
Vercel fails closed if the database is missing.

## Operational boundaries

This PR does not deploy, migrate production, create credentials, enable cron,
or activate contact integration. See [deployment and acceptance](docs/operations.md).

The Aicoo integration requests os.share:read/write. Contact integration adds
net.contacts:manage only when enabled. It uses only a provider-returned verified
username, never a user-editable card username. If userinfo does not supply it,
the contact button cannot complete; the provider contract must be resolved before
enabling this feature. Local card exchange does not depend on contact sync.

Renewal is **not a promise of a permanent share link**. After staging acceptance,
the administrator can schedule GET /api/maintenance/renewals with Authorization:
Bearer CRON_SECRET. Each run handles at most ten owners due for checking, oldest
first; call frequently enough for the user count. Active links with less than two
days left are extended 30 days. Owners must opt in and maintain an authorized
session (reconnect at least every 30 days, and re-enable after logout).
Expiry/revocation, permission and network errors appear in renewal settings.
Disabling renewal does not shorten a previously extended link; an in-flight
provider request may finish.

Uploaded images are public. Removing an image URL from a card does not delete
the Blob; the administrator must define retention and clean up unreferenced
objects. Do not upload confidential images. Existing /uploads files are not
migrated automatically.

## Review and remaining acceptance

One formal PR contains the complete code work. Approval is not deployment.
Live OAuth/Blob/Neon, scheduler, contact scope/username, two-device exchange,
and iPhone/Android vCard import remain explicit acceptance gates.
See [vCard compatibility](docs/vcard-export.md) and [release checklist](docs/roadmap.md).
