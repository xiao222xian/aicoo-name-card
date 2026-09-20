# Agentport — product philosophy and competitor review

## Scope and evidence

This is a public-flow inspection, not a claim that all three products have been
fully trialled with registered accounts. No real contacts were uploaded, no
messages sent, and no paid subscriptions or account terms accepted.

| Product | Actually inspected | Not yet tested |
| --- | --- | --- |
| Bonjour | Community navigation; Nexmoe public card; Add Friend opens a login/terms gate; Bonnie public profile | Logged-in recommendations, messaging, actual AI responses and relationship exchange |
| HiHello | Current product site; app entry redirects to email login with terms notice; official scanner documentation | Creating/saving a card, reciprocal capture, actual scanning, CRM integration |
| Blinq | Product site; signup entry opens a pre-account card editor; entered fictional Demo Research and saw the preview update | Saving/publishing (Next accepts terms), real exchange, AI enrichment/notetaker/MCP |

## What form does AI take?

### Bonjour: identity and intent in a social context

The [Nexmoe card](https://bonjour.bio/nexmoe) exposes a current networking intent,
Coffee Chat availability, identity, interests, projects and recent posts, plus
friend/contact actions. This makes the profile a reason to start a conversation,
not just a list of contact fields. The community also has a Bonnie’s Pick entry.

The [Bonnie profile](https://bonjour.bio/w4jo21) describes itself as an AI friend
for expanding connections and has a Bonjour verification badge. This is visible
evidence of AI positioning, **not verification of autonomous matching or proof
that every member has their own shareable agent**. Login is needed to examine
the actual interaction. We should not describe Bonjour as simply having no AI.

Lesson: communicate why two people might want to meet. Do not copy its feed,
visual components or build a broad social network before the exchange loop works.

### HiHello: make professional connections usable and manageable

[HiHello](https://www.hihello.com/) emphasizes consistent professional identity,
company-wide management and measurable relationships. Its
[scanner documentation](https://support.hihello.com/hc/en-us/articles/12193467417627-How-to-Scan-a-Paper-Business-Card-or-Event-Badge-With-HiHello)
describes AI transcription into contacts, while its
[scanner page](https://www.hihello.com/features/business-card-scanner) describes
enrichment, notes and CRM synchronization. These are contact-processing tools;
the inspected evidence does not establish a personal representative that visitors
can converse with on each card. These capabilities were read, not tested live.

Lesson: preserve useful information after the introduction, with clear consent
and a dependable destination. An attractive profile alone is insufficient.

### Blinq: remember the person and the context

[Blinq](https://blinq.me/) explicitly presents digital cards, reciprocal detail
sharing without requiring the recipient’s app, AI contact enrichment, AI
notetaking, and MCP connections to AI tools. Its published examples focus on
capturing who someone is, where/when you met and what was discussed, then making
that context available for follow-up. We tested only its pre-account editor;
these AI functions remain advertised rather than personally verified.

This is substantially more than a static card. But AI working on the owner’s
contact records is not the same contract as giving a stranger permission to
converse with the owner’s personal representative. Do not claim exclusive
ownership of “AI networking”; test the precise interaction and permission model.

## Aicoo / Agentport: current implementation versus proposed direction

The inspected Agentport integration uses user OAuth, lists active shared agents,
binds an owner-selected shared link, and sends visitors to that link. Its current
code calls `/os/share/list`, expiry-only `/os/share/{id}`, and the gated
`/net/contacts/request` adapter. These paths are code evidence, not proof that
the deployed OAuth client has every scope or that real provider acceptance passed.
The client’s contacts scope and verified username still require administrator
validation. Never substitute a developer’s personal API key.

The card exchange record is separate from Aicoo friendship and separate again
from agent access. Accepting a card must not silently broaden agent permissions.
Likewise, a saved agent URL does not by itself implement autonomous follow-up.

**Proposed product promise:** after a conference introduction, keep both the
relationship and a permission-bounded way to continue the conversation with the
person’s agent. This is a design hypothesis, not a completed feature claim.

### Proposed first end-to-end experience

1. A opens a shareable card with identity, what A can help with, what A is looking
   for, and an explanation of the agent’s permitted role.
2. B scans and can understand A without first installing an app. B can save the
   contact/agent link or choose to exchange their own card.
3. B explicitly initiates exchange; A accepts. Both retain the connection and
   optional meeting context. Private notes stay private.
4. B can talk to A’s selected shared agent within Aicoo’s existing permission
   boundary. Questions requiring private information or a commitment go to A.
5. A can review a suggested follow-up based on the meeting context. Sending,
   booking or sharing further information requires explicit authorization.

Steps 4’s advanced handoff and 5 are product proposals requiring API validation,
not promises about the present PR. Initial additions should favor intent and
context over more decorative buttons. Do not add a community feed, unsolicited
outreach, background scraping or automatic disclosure of private memory.

## How to evaluate the idea

Run a two-user conference scenario: scan, understand intent, exchange, save,
ask the agent a permitted question, and resume the relationship the next day.
Measure completion/drop-off, whether each person recalls why they connected,
whether the agent answer is useful and correctly bounded, and whether a human
needs to repair missing context. Count accepted exchanges and useful follow-up,
not just QR views. Start with a small moderated pilot, not an invented KPI result.

Next research gate: sign in with approved test accounts to verify each product’s
exchange, AI interaction and consent model. Bonjour deserves priority because
its relationship/intent philosophy is the closest reference requested by the team.
