# Launch setup — Stripe, Azure & Auth

Everything you need to configure to take the new pricing, dashboard and Stripe
billing live. Nothing here is in the repo (no secrets committed); it all lives in
**Azure Static Web App → Configuration → Application settings** and in your
**Stripe Dashboard**.

---

## 1. Structure the product in Stripe

Create **one Product** with **two recurring prices**. Do this in **Test mode**
first, then repeat in Live mode.

1. Stripe Dashboard → **Product catalog → Add product**
   - **Name:** `Passwordify Pro`
   - **Description:** `100,000 API requests/mo, 5 API keys, higher burst limits, email support.`
2. Add **two prices** to that product (both **Recurring**):

   | Price | Amount | Billing period | Notes |
   |-------|--------|----------------|-------|
   | Monthly | **$2.00 USD** | Monthly | Standard monthly |
   | Annual | **$18.00 USD** | Yearly | = $1.50/mo, the "save 25%" option |

   > Do **not** make the annual price "$1.50/month" — Stripe bills the *actual*
   > charge. $18 charged once a year **is** $1.50/mo. The site does the “/mo” math.

3. Copy each **Price ID** (looks like `price_1AbC...`). You'll need both:
   - Monthly → `STRIPE_PRICE_PRO_MONTHLY`
   - Annual → `STRIPE_PRICE_PRO_ANNUAL`

4. **Billing Portal:** Stripe Dashboard → **Settings → Billing → Customer portal**
   → **Activate**. Recommended: allow customers to **cancel** and **switch plans**
   (so they can move between monthly/annual). The dashboard's "Manage billing"
   button sends them here.

5. *(Optional)* Turn on **promotion codes** if you want launch coupons — checkout
   already passes `allow_promotion_codes: true`.

---

## 2. No webhook required ✅

Passwordify verifies a customer's plan **live against Stripe** and caches the
result — there is no webhook to create or secret to manage.

- **Dashboard** (`/api/me`): checks Stripe on every load, so the plan shown is
  always current.
- **API hot path** (`authorize()`): reads the cached plan and re-verifies against
  Stripe at most **once per key every 12 hours** (`PLAN_TTL_MS` in
  `api/src/lib/billing.ts`), so normal requests never call Stripe.

**Trade-off to know:** a cancellation or failed payment is reflected on the API
within the 12-hour TTL (instantly on the next dashboard visit), rather than in
seconds. For this product that's an accepted trade for zero webhook setup. Lower
the TTL for faster enforcement.

---

## 3. Create the storage account (for accounts, keys & usage)

The dashboard, API keys and usage metering are stored in **Azure Table Storage**.

1. Azure Portal → **Create a resource → Storage account** (Standard, LRS is fine).
2. After it's created → **Security + networking → Access keys** → copy the
   **Connection string** → this is `PASSWORDIFY_STORAGE_CONNECTION`.
3. No need to create tables manually — the API creates `pwfyusers`, `pwfykeys`
   and `pwfyusage` automatically on first use.

---

## 4. Application settings (Azure Static Web App)

Azure Portal → your Static Web App → **Settings → Configuration** →
**Application settings** → add each of these → **Save**:

| Name | Value | Purpose |
|------|-------|---------|
| `PASSWORDIFY_STORAGE_CONNECTION` | *(storage connection string)* | Users, keys, usage |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe API access (also used for live plan checks) |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_...` | $2/mo price ID |
| `STRIPE_PRICE_PRO_ANNUAL` | `price_...` | $18/yr price ID |
| `SITE_URL` | `https://passwordify.xyz` | Checkout redirect URLs |
| `PASSWORDIFY_API_KEYS` | *(optional)* | Comma-separated keys granted by hand (treated as Pro) |

> Use **live** Stripe values in production and **test** values in a staging slot.
> After saving, the Functions restart automatically.

---

## 5. Authentication — nothing to configure 🎉

The dashboard uses **Azure Static Web Apps built-in auth**, which ships GitHub
and Microsoft (aad) sign-in **with no OAuth app to register**. The login buttons
already point at `/.auth/login/github` and `/.auth/login/aad`, and the API reads
the signed-in user from the `x-ms-client-principal` header.

- Want Google too? Register a [custom provider](https://learn.microsoft.com/azure/static-web-apps/authentication-custom)
  and add its client-id/secret app settings (this *replaces* the pre-configured
  providers, so add GitHub/Entra as custom ones too if you go this route).
- Want to restrict who can sign in? Use the SWA **Role management** invitations.

---

## 6. Go-live checklist

- [ ] Stripe **Live mode**: product + 2 prices created, Price IDs copied.
- [ ] Storage account created, connection string copied.
- [ ] All app settings above filled with **live** values, saved.
- [ ] Billing Portal activated in Stripe.
- [ ] Deploy `main` (GitHub Actions builds the site + `api/`).
- [ ] Smoke test:
  1. Sign in at `/dashboard` → **Create key** → copy it.
  2. `curl https://passwordify.xyz/api/v1/validate -H "Authorization: Bearer <key>" -H "Content-Type: application/json" -d '{"password":"hunter2"}'` → 200.
  3. `/pricing` → toggle Annual → **Upgrade to Pro** → complete Stripe **test** checkout.
  4. Back on `/dashboard`, plan shows **Pro** (verified live from Stripe on load).
  5. **Manage billing** opens the Stripe portal; cancel there → dashboard shows Free on next load.
- [ ] Confirm `robots.txt` + `sitemap-index.xml` resolve; submit sitemap in
      Google Search Console.

---

## How billing maps to the code

| Concern | Where |
|--------|-------|
| Plan quotas (Free/Pro numbers) | `api/src/lib/plans.ts` |
| API-key validation + quota enforcement | `api/src/lib/auth.ts` (`authorize`) |
| Live plan verification + TTL cache | `api/src/lib/billing.ts` |
| Data access (Table Storage) | `api/src/lib/store.ts` |
| Stripe client + price mapping + live check | `api/src/lib/stripe.ts` |
| Checkout / Portal | `api/src/functions/{checkout,portal}.ts` |
| Dashboard data + key management | `api/src/functions/{me,keys}.ts` |
| Dashboard UI | `src/components/react/Dashboard.tsx`, `src/pages/dashboard.astro` |
| Pricing page (toggle, schema) | `src/pages/pricing.astro` |

### Fulfillment note
Plan changes are detected by verifying the subscription live against Stripe
(cached with a 12 h TTL — see §2). **Delivering the API key is self-serve**:
after upgrading, the user creates/rotates their key on the dashboard. There is no
email step yet (a good next task — see ROADMAP).
