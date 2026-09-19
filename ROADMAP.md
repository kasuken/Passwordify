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

## Phase 2 — Monetization

Turn API usage into recurring revenue. This is the phase that makes Passwordify a business
rather than a portfolio project.

- **User accounts + dashboard** — required before we can sell anything; lets customers see
  their own usage and justify (or reduce) their spend, which lowers churn.
- **Real API key issuance/rotation** — replaces the shared demo key so usage can be attributed,
  metered, and revoked per customer — the precondition for billing.
- **Stripe billing + usage metering** — the actual revenue mechanism (Free/Pro/Scale tiers,
  overage billing); without it every other phase-2 item is cost with no return.
- **Per-key rate limiting backed by a store** (Azure Table Storage / Cosmos DB) — protects
  margins by enforcing plan limits and prevents one noisy customer from degrading the service
  for everyone else, which protects retention.
- **`api.passwordify.xyz` subdomain** — a stable, versioned base URL signals production-grade
  reliability to paying customers and decouples API deploys from the marketing site.

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
