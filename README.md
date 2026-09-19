# Passwordify

**Privacy-first password tools for the browser, and a developer API for everything else.**

🔗 **Live:** [https://passwordify.xyz](https://passwordify.xyz)

![Built with Astro](https://img.shields.io/badge/built%20with-Astro-BC52EE?logo=astro&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Deploys to Azure Static Web Apps](https://img.shields.io/badge/deploys%20to-Azure%20Static%20Web%20Apps-0078D4?logo=microsoftazure&logoColor=white)

Passwordify gives people three free, entirely client-side tools for checking and generating
passwords — no password ever leaves the browser — and gives developers a small, fast API for
adding the same checks (strength scoring, breach screening, policy validation, CSPRNG
generation) to their own products. It's built for security-conscious end users and for
developers who need NIST 800-63B-aligned password logic without writing it themselves.

## Features

### Free browser tools

- **Password strength analyzer** — real-time scoring via [zxcvbn](https://github.com/zxcvbn-ts/zxcvbn),
  not naive character-class rules, with crack-time estimates and concrete feedback.
- **Breach check** — tests a password against the Have I Been Pwned Pwned Passwords corpus
  (900M+ records) using **k-anonymity**: only a 5-character SHA-1 prefix ever leaves the device.
- **Password / passphrase generator** — CSPRNG-backed (`crypto.getRandomValues`, rejection
  sampling, no modulo bias), with an EFF diceware wordlist mode for memorable passphrases.

### Developer API

- **`POST /v1/strength`** — zxcvbn score (0–4), guesses, entropy bits, crack time, and
  human-readable feedback for a given password.
- **`POST /v1/breach`** — k-anonymity breach lookup by password or SHA-1 prefix; returns
  whether it's compromised and how many times it's been seen.
- **`POST /v1/validate`** — one call that combines strength + breach status against a
  configurable policy, aligned with **NIST 800-63B** guidance.
- **`POST /v1/generate`** — server-side CSPRNG password and passphrase generation with full
  character-set and passphrase controls.

Every endpoint is stateless JSON over HTTPS, authenticated with a bearer API key, and returns
structured `{error:{code,message}}` bodies with correct HTTP status codes.

## Tech stack

- **[Astro 5](https://astro.build)** — static-first site generation
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling, via `@tailwindcss/vite`
- **React 19 islands** (`@astrojs/react`) — interactive components only where needed
- **Azure Functions v4 (TypeScript)** — the API, in `api/`
- **[zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn)** — realistic password strength estimation
- **Have I Been Pwned** — Pwned Passwords k-anonymity range API
- **Web Crypto (`crypto.getRandomValues`) / `node:crypto`** — cryptographically secure generation
- **Geist + Geist Mono** (`@fontsource-variable`) — typography
- **Azure Static Web Apps** — hosting and deployment, custom domain `passwordify.xyz`

## Project structure

```
Passwordify/
├── src/
│   ├── pages/              # Astro file-based routes (index.astro, etc.)
│   ├── layouts/
│   │   └── Base.astro      # <head>/SEO, Header, Footer shell used by every page
│   ├── components/
│   │   ├── Header.astro, Footer.astro, Logo.astro
│   │   ├── ThemeToggle.astro, ToolIcon.astro
│   │   └── react/
│   │       └── StrengthAnalyzer.tsx   # interactive React island
│   ├── lib/
│   │   ├── strength.ts     # zxcvbn wrapper (client-side strength scoring)
│   │   ├── breach.ts       # HIBP k-anonymity breach check
│   │   ├── generate.ts     # CSPRNG password/passphrase generation
│   │   ├── sha1.ts         # SHA-1 helper for k-anonymity hashing
│   │   └── wordlist.ts     # EFF large diceware wordlist (7,776 words)
│   └── styles/
│       └── global.css      # Tailwind v4 theme tokens & component classes
├── api/                    # Azure Functions v4 API (TypeScript)
│   ├── src/lib/            # shared server-side logic (e.g. strength.ts)
│   ├── host.json           # Functions host configuration
│   └── package.json        # API dependencies & build/start scripts
├── public/                 # static assets
└── astro.config.mjs        # site config (site URL, integrations, Tailwind, Vite)
```

## Getting started

**Prerequisites:** Node.js 20+

### Frontend (Astro site)

```bash
npm install
npm run dev       # start the dev server
npm run build     # build the static site to dist/
npm run preview   # preview the production build locally
```

### API (Azure Functions)

The API runs separately, using the [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`func`):

```bash
cd api
npm install
npm start          # builds (tsc) and runs `func start`
```

For local testing without issuing yourself a real key, use the demo key:

```
Authorization: Bearer pk_test_passwordify_demo
```

## Deployment

Passwordify deploys to **Azure Static Web Apps**:

| Setting | Value |
|---|---|
| `app_location` | `/` |
| `output_location` | `dist` |
| `api_location` | `api` |

A GitHub Actions workflow builds and deploys the site and API automatically on every push to
`main`. The production site is served on the custom domain **passwordify.xyz**.

## Security note

The three free browser tools run **entirely client-side** — passwords are never sent to a
Passwordify server for strength scoring or generation, and breach checks only ever transmit a
5-character hash prefix (k-anonymity). The API is stateless: it does not log or persist
passwords or full password hashes, in requests or in responses.

## License

Released under the [MIT License](./LICENSE).

Passwordify builds on the excellent work of others:

- [EFF Large Wordlist](https://www.eff.org/dice) — Electronic Frontier Foundation, CC BY 3.0 US
- [Have I Been Pwned](https://haveibeenpwned.com/) — Pwned Passwords breach corpus
- [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) — password strength estimation
