# Passwordify API

Backend API for Passwordify, built as Azure Functions (Node.js/TypeScript, v4 programming model). Deploys to Azure Static Web Apps as a managed Functions app, served under `/api`.

## Requirements

- Node.js 18+
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4 (`npm i -g azure-functions-core-tools@4`) for local runs

## Local development

```bash
npm install
cp local.settings.json.example local.settings.json
# edit local.settings.json and set PASSWORDIFY_API_KEYS if you want extra keys
npm start
```

`npm start` runs `prestart` (`tsc` build) automatically, then starts the Functions host (`func start`). The API will be available at `http://localhost:7071/api/...`.

## Environment variables

Configured in `local.settings.json` (local) or Application Settings (Azure):

| Variable | Required | Description |
| --- | --- | --- |
| `FUNCTIONS_WORKER_RUNTIME` | Yes | Must be `node`. |
| `PASSWORDIFY_API_KEYS` | No | Comma-separated list of additional valid API keys, e.g. `pk_live_abc,pk_live_def`. The built-in demo key `pk_test_passwordify_demo` always works regardless of this setting. |

## Authentication

Every endpoint (except `OPTIONS` preflight requests) requires:

```
Authorization: Bearer <api-key>
```

- The demo key `pk_test_passwordify_demo` is always accepted, and is capped at **60 requests/hour** (per Functions host instance).
- Any key listed in `PASSWORDIFY_API_KEYS` is accepted, capped at 600 requests/hour (per Functions host instance).
- Missing/blank/invalid keys get `401 Unauthorized` with a JSON error body.
- Requests over the limit get `429 Too Many Requests`.

All responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (seconds) headers.

> **Note:** the rate limiter is a simple in-memory, fixed-window counter kept per Functions worker process. It is fine as a basic/conceptual safeguard, but on a scaled-out Consumption plan (multiple instances, or instances recycling) it is **not** a globally accurate or durable limit. For real production rate limiting, back this with a shared store (Azure Table Storage, Redis, Azure API Management policies, etc.).

## Endpoints

All endpoints are `POST` (plus `OPTIONS` for CORS preflight), accept/return JSON, and are namespaced under `/api/v1/`.

### `POST /api/v1/strength`

Analyze password strength with [zxcvbn-ts](https://zxcvbn-ts.github.io/zxcvbn/).

Request body:
```json
{ "password": "correct horse battery staple", "userInputs": ["jane.doe", "acme"] }
```

Response:
```json
{
  "score": 4,
  "guesses": 1e14,
  "entropyBits": 46.5,
  "crackTimeOfflineFast": { "seconds": 123456, "display": "2 days" },
  "crackTimeOnline": { "seconds": 987654, "display": "centuries" },
  "feedback": { "warning": null, "suggestions": [] }
}
```

### `POST /api/v1/breach`

Check a password against the [Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords) Pwned Passwords database using k-anonymity (only a 5-character SHA-1 prefix ever leaves this API).

Either send the plaintext password (this API hashes it and does the k-anonymity round trip for you):
```json
{ "password": "hunter2" }
```

...or do the SHA-1 hashing yourself and only send the range query on to us (so the full hash never leaves your client, and we merely proxy the range lookup):
```json
{ "sha1Prefix": "F3BBB", "sha1Suffix": "D66315AC353C3C6A61F529B3AA0B379E2C4" }
```

Response:
```json
{ "breached": true, "count": 345920 }
```

### `POST /api/v1/validate`

Run strength analysis + breach screening + [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) style policy validation together.

NIST SP 800-63B explicitly recommends **against** composition rules (forced upper/lower/digit/symbol mixes) and against periodic mandatory password expiration — this endpoint does not enforce either. It checks length and screens against breach data instead.

Request body:
```json
{
  "password": "hunter2",
  "policy": { "minLength": 8, "recommendedLength": 15, "maxLength": 64, "screenBreaches": true }
}
```

Response:
```json
{
  "valid": false,
  "score": 1,
  "breached": true,
  "breachCount": 123456,
  "violations": ["found_in_breach"],
  "feedback": { "warning": "This is a top-10 common password", "suggestions": ["Add another word or two"] },
  "policy": { "minLength": 8, "recommendedLength": 15, "maxLength": 64, "screenBreaches": true }
}
```

Violation codes: `empty`, `too_short`, `too_long`, `found_in_breach`.

### `POST /api/v1/generate`

Generate one or more cryptographically-random passwords using Node's CSPRNG (`crypto.randomInt`).

Request body (all fields optional):
```json
{
  "length": 20,
  "count": 1,
  "lowercase": true,
  "uppercase": true,
  "numbers": true,
  "symbols": true,
  "avoidAmbiguous": false,
  "mode": "password"
}
```

- `length` is clamped to `[8, 128]` (default `20`).
- `count` is clamped to `[1, 100]` (default `1`).
- `lowercase`/`uppercase`/`numbers`/`symbols` default to `true`; at least one must remain enabled.
- `avoidAmbiguous` strips visually-confusable characters (`l`, `I`, `1`, `O`, `0`, `o`) from the pools.

Response:
```json
{ "passwords": ["k7#mQ2...", "..."], "entropyBits": 130.5 }
```

**Passphrase mode** (`"mode": "passphrase"`) generates diceware-style passphrases from the
full EFF large wordlist (7,776 words, ~12.9 bits each). Extra fields:

- `words` — number of words (3–12, default 5)
- `separator` — string between words (default `"-"`)
- `capitalize` — capitalize each word (default `true`)
- `includeNumber` — append a random digit to one word (default `true`)

```json
{ "passwords": ["Doorman-Consonant3-Unbraided-Agreeing-Shortwave"], "entropyBits": 67.9 }
```

## Errors

All errors use the shape:
```json
{ "error": { "code": "unauthorized", "message": "..." } }
```

Common codes: `unauthorized` (401), `rate_limited` (429), `invalid_json` / `missing_field` / `invalid_field` / `invalid_options` (400), `upstream_error` (502).
