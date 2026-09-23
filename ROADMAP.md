# Roadmap

This roadmap tracks how Passwordify grows from a free tools site into a small, sustainable
developer-API business. It's scoped for a small/solo team — each phase is meant to be shippable
without a hiring plan.

## Phase 1 — Shipped (current)

The foundation: free tools that build trust and traffic, plus an API that proves the product
works.

- **Browser tools** (strength analyzer, breach check, generator) — the free, no-signup entry
  point that establishes credibility and gets the domain indexed and shared.
- **Public marketing site** (Astro, Tailwind, React islands) — fast, SEO-friendly pages that
  convert visitors into tool users and tool users into API leads.
- **Docs site** (`/docs`, `/developers`) — reduces support burden and is a prerequisite for
  anyone integrating the API without talking to us first.
- **4 API endpoints** (`/v1/strength`, `/v1/breach`, `/v1/validate`, `/v1/generate`) with
  demo-key auth and basic rate limiting — lets prospective customers try the API risk-free
  before we ask for payment details.

## Phase 2 — Monetization (shipped)

Turn API usage into recurring revenue. This is the phase that makes Passwordify a business
rather than a portfolio project.

- **User accounts + dashboard** — ✅ shipped. `/dashboard` uses Azure Static Web Apps built-in
  auth (GitHub + Microsoft), showing plan, monthly usage and API-key management.
- **Real API key issuance/rotation** — ✅ shipped. `POST/DELETE /api/keys` issues/rotates/revokes
  `pk_live_*` keys, stored as SHA-256 hashes in Azure Table Storage; `authorize()` validates them.
- **Stripe billing** — ✅ shipped. Two tiers only, **Free** and **Pro** ($2/mo, $1.50/mo billed
  annually). Stripe Checkout (`/api/checkout`) and Billing Portal (`/api/portal`). No webhook:
  plans are verified live against Stripe and cached (dashboard on every load; API path on a 12 h
  TTL — see `api/src/lib/billing.ts`).
- **Per-key rate limiting + quota backed by a store** — ✅ shipped. Plan quotas live in
  `api/src/lib/plans.ts`; monthly usage is metered in Table Storage (`pwfyusage`), plus a coarse
  in-memory per-hour burst limit. (Burst limit is still per-instance — move to a shared store /
  APIM for globally-accurate limits at scale.)
- **`api.passwordify.xyz` subdomain** — still open; API currently served under `/api` on the SWA.

Remaining phase-2 polish: automate key delivery email on upgrade, and a durable/shared burst
limiter.

## Phase 3 — Product depth

Make the API stickier and harder to switch away from once a customer has integrated it.

- **SDKs (JS/TS, .NET, Python)** — cuts integration time from hours to minutes, which directly
  raises trial-to-paid conversion and reduces support tickets.
- **Self-hostable breach corpus / Pwned Passwords mirror** — unlocks Enterprise and regulated
  customers (finance, healthcare, government) who can't send even hashed data off-prem —
  a distinct, higher-ACV revenue line.
- **Webhooks** (e.g. breach-status changes) — moves customers from polling to event-driven
  integration, which deepens reliance on the platform and raises switching cost.
- **Passkey / WebAuthn module** — rides the industry-wide passkey push; positions Passwordify
  as a security-tools platform rather than a single-feature API, opening a second product line.
- **Breach monitoring alerts** — a natural upsell (from one-time check to ongoing monitoring)
  that converts one-off API calls into a recurring, higher-margin subscription add-on.

## Phase 4 — Growth

Scale distribution once the core product and billing are proven, focusing on cheap,
compounding acquisition channels a small team can sustain.

- **SEO content for the free tools** — the tools are the top-of-funnel acquisition engine;
  content built around them (e.g. "how strong is my password", breach explainers) compounds
  organic traffic without paid spend.
- **WordPress / Shopify plugin** — meets developers where they already build, turning
  Passwordify into a checkbox integration for a large existing install base rather than a
  from-scratch API integration — a low-friction acquisition channel.
- **SOC2-lite trust page** — addresses the #1 objection from mid-market buyers (security
  posture) without the cost of a full audit, unblocking larger deals earlier than a full SOC 2
  program would.
