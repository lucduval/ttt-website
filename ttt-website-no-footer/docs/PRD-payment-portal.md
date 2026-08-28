# PRD — TTT Tax Payment Portal

| Field | Value |
| --- | --- |
| Author | Luc Duval (Riivo) |
| Date | 2026-05-20 |
| Status | Draft — pending TTT sign-off on companion proposal |
| Owner (Eng) | Riivo |
| Owner (Biz) | TTT Tax Services — Finance / Tax Crew |
| Related precedents | `/embed/onboarding`, `/embed/contact`, existing Dynamics + Graph email infra |
| Companion doc | [PROPOSAL-payment-portal.md](./PROPOSAL-payment-portal.md) |

---

## 1. Problem Statement

TTT Tax Services delivers tax work and then bills the client. The client receives a tax invoice PDF by email and is expected to EFT the amount. In practice:

- Many clients drag payment by weeks or months, requiring repeated manual reminders.
- A material fraction never pay at all — TTT writes off material amounts each financial year as bad debt.
- Reconciling EFT payments against `new_invoices` records is manual: finance matches bank statement line items to outstanding invoices and updates Dynamics by hand.

The proposed portal removes friction at the moment the client decides whether to pay:

- A **single-use payment link** is issued from inside Dynamics on each `new_invoices` record.
- The client opens the link on their phone and pays by card or Instant EFT in <60 seconds.
- The invoice is automatically marked paid in Dynamics, with a receipt to the client and a notification to the invoice owner + finance.

Scope is intentionally narrow for v1: TTT Tax Services only, pay-in-full only, links issued manually by staff from Dynamics. See §5 for the full out-of-scope list.

## 2. Goals & Success Metrics

**Primary metric (build-team accountable):** Payment link conversion rate.

```
count(payment_requests WHERE status = 'paid' AND paid_at < expires_at)
  /
count(payment_requests WHERE status IN ('paid', 'expired'))
  ≥ 0.70
```

Measured over each rolling 4-week window post-launch.

**Business outcome metric (TTT finance accountable):** Days Sales Outstanding (DSO) for Tax invoices.

- Baseline: TTT to compute average DSO for Tax over preceding 12 months pre-launch.
- Target: 30% reduction within 6 months of full rollout.

**Long-term headline:** Bad debt write-offs (R, absolute) for Tax in FY following launch vs preceding FY. Target: ≥40% reduction. Read 12 months after go-live.

**Operational metric:** Median time-to-payment per paid invoice. Target: <72 hours from link issue to settlement.

## 3. Users & Pain Today

| User | Pain today | Resolution |
| --- | --- | --- |
| Tax client (payer) | Receives PDF, must manually EFT, type beneficiary details, type reference. Friction → procrastination. | One-tap link → hosted checkout → done. |
| Tax invoice owner | Chases clients for payment manually, doesn't know paid-status without checking with finance. | Auto-email on payment success + Dynamics field updated. |
| Tax finance / credit control | Matches bank statements to invoices line-by-line, updates Dynamics manually. | Provider webhook updates Dynamics; bank reconciliation becomes spot-check. |
| Dynamics admin | New custom fields + ribbon button — once. | Standard Dynamics customisation; no ongoing maintenance. |
| TTT POPIA Information Officer | Must be named in privacy notice. | Listed in launch action items. |

## 4. Solution & File Plan

### 4.1 End-to-end functional behaviour

```
[A. Link issuance]
  1. Tax staff opens a new_invoices record in Dynamics.
  2. Staff clicks ribbon button "Send Payment Link".
  3. Power Automate flow fires:
       POST {API_BASE}/api/payment-links
       { dynamics_invoice_id, dynamics_contact_id, issued_by }
  4. Our API:
       - Reads invoice + contact details from Dynamics (amount, ref, client name + email,
         tax invoice annotation PDF).
       - Generates 32-byte crypto-random token; stores SHA-256 hash in Supabase
         payment_requests row.
       - Writes back to Dynamics: riivo_paymentstatus = 'sent',
         riivo_paymentlinktoken_hash, riivo_paymentlinkissuedat,
         riivo_paymentlinkexpiresat (+14 days).
       - Sends "Payment Request" email from payments@ttt-tax.co.za via Microsoft Graph:
           * To: contact email
           * Reply-To: payments@ttt-tax.co.za
           * Body: invoice summary + "Pay Now" button → https://pay.ttt-tax.co.za/pay/{token}
           * Attachment: existing tax invoice PDF (from Dynamics annotation on new_invoices)
       - Returns { success, payment_request_id } to Power Automate.

[B. Client pays]
  5. Client clicks link on phone.
  6. Next.js route handler at /pay/[token]:
       - Hashes incoming token, looks up payment_requests by token_hash.
       - Validates: status='sent' AND expires_at>now() AND not voided.
       - Renders TTT Tax-branded page: client name, invoice ref, amount, [Pay R3,200.00].
  7. Client clicks Pay → server creates Peach Checkout session (server-to-server, scoped to
     this payment_request only) → redirects to Peach hosted checkout.
  8. Client completes payment (card / Instant EFT via SiD) on Peach's PCI-compliant page.
     Card data NEVER touches TTT infrastructure.
  9. Peach redirects browser back to pay.ttt-tax.co.za/pay/{token}/result?ref=...
     This page is UX-only — it polls payment_requests.status until webhook arrives, then
     shows a success or failure card. NEVER trusts the redirect alone for status.

[C. Webhook reconciliation — source of truth]
 10. Peach POSTs to /api/webhook/peach with signed payload.
 11. Webhook handler:
       - Verifies HMAC signature against PEACH_WEBHOOK_SECRET. Reject 401 if invalid.
       - Idempotency check: insert into webhook_events with event_id as unique key.
         If duplicate, return 200 (already processed) without side effects.
       - Updates payment_requests.status = 'paid' | 'failed'.
       - On paid: writes back to Dynamics:
           * riivo_paymentstatus = 'paid'
           * riivo_paymentprovidertxnref, riivo_paymentpaidat, riivo_paymentamount
           * Creates Dynamics annotation on new_invoices with payment receipt summary.
       - On paid: sends three emails from payments@ttt-tax.co.za:
           * Client: receipt email (PDF receipt attached) + reattaches tax invoice PDF
           * Invoice owner (Dynamics ownerid → systemuser email): "Invoice {ref} paid"
           * Finance: finance@ttt-tax.co.za "Payment received: {client} R{amount}"

[D. Edge cases]
  E1. Already-paid link reclicked: /pay/[token] detects status='paid', renders receipt page.
  E2. Expired link: status remains 'sent', expires_at < now() → "Link expired, please contact
      TTT" page. Daily cron emits digest to finance@ of links expiring next 24h still unpaid.
  E3. Card declined / 3DS abandoned: payment_attempts row recorded, link remains payable.
      If 5+ failures in 24h → status = 'locked', email to invoice owner.
  E4. Staff voids: Dynamics ribbon "Void Payment Link" → Power Automate → POST
      /api/payment-links/{id}/void → status = 'voided'. Link page shows "Link no longer valid".
  E5. Refunds: handled by finance directly in the Peach dashboard. NOT exposed in this app.
      Finance manually updates Dynamics annotation post-refund.
```

### 4.2 File / system plan

| Status | Path / system | Purpose |
| --- | --- | --- |
| NEW (subdomain) | `pay.ttt-tax.co.za` (Vercel host alias on the existing Next.js deployment) | Dedicated host for the payment portal — cookie / CSP / blast-radius isolation. |
| NEW | `app/(payment)/pay/[token]/page.tsx` | Capability-link landing page. Server component, reads from Supabase, renders TTT Tax-branded UI. |
| NEW | `app/(payment)/pay/[token]/result/page.tsx` | Post-checkout polling page. Shows pending → success / failed once webhook fires. |
| NEW | `app/(payment)/privacy/page.tsx` | POPIA privacy notice (footer link from `/pay/...`). |
| NEW | `app/api/payment-links/route.ts` | `POST` — called by Dynamics Power Automate to issue a link. Service-account auth (shared-secret bearer). |
| NEW | `app/api/payment-links/[id]/void/route.ts` | `POST` — called by Dynamics Power Automate to void a link. |
| NEW | `app/api/checkout-sessions/route.ts` | `POST` — called by `/pay/[token]` client when user clicks "Pay". Creates Peach Checkout session server-side. |
| NEW | `app/api/webhook/peach/route.ts` | `POST` — Peach webhook receiver. HMAC-verified, idempotent. The only path that marks a payment_request paid. |
| NEW | `app/api/cron/expiring-links/route.ts` | `GET` — daily Vercel cron. Emits digest of soon-to-expire unpaid links to finance@. |
| NEW | `app/lib/peach.ts` | Peach REST client (create checkout, verify webhook signature, error normalisation). |
| NEW | `app/lib/supabase.ts` | Supabase server client. Service-role key for write operations from API routes. |
| NEW | `app/lib/payment-tokens.ts` | Token generation (32 bytes via `crypto.randomBytes`), hashing (SHA-256), constant-time compare. |
| NEW | `app/lib/payment-emails.ts` | `sendPaymentLinkEmail`, `sendPaymentReceiptClient`, `sendPaymentOwnerNotification`, `sendPaymentFinanceNotification`, `sendExpiringLinksDigest`. Wraps existing `app/lib/email.ts` infra with the `payments@` sender. |
| MODIFIED | `app/lib/email.ts` | Add optional `senderAddress` parameter (defaults to `EMAIL_SENDER_ADDRESS`) so payment flows can send from `payments@` while onboarding continues sending from `registrations@`. |
| MODIFIED | `app/lib/email-templates.ts` | New templates: `buildPaymentLinkHtml`, `buildPaymentReceiptClientHtml`, `buildPaymentOwnerHtml`, `buildPaymentFinanceHtml`, `buildExpiringLinksDigestHtml`. All branded as TTT Tax Services (reuse existing `SERVICE_BRANDING.tax`). |
| NEW | `supabase/migrations/0001_payment_portal.sql` | Schema: `payment_requests`, `payment_attempts`, `webhook_events`. RLS denying all anon access — service role only. Indexes on `token_hash`, `dynamics_invoice_id`, `status`, `expires_at`. |
| NEW | `vercel.json` | Cron entry for `/api/cron/expiring-links` (daily 08:00 SAST). Subdomain rewrite for `pay.ttt-tax.co.za`. |
| REMOVED | `convex/*` | Convex is unused (zero schema, only a server-action runtime calling Dynamics). Same PR removes Convex provisioning and migrates the `getIndustries` action into `app/actions.ts`. |
| NEW (Dynamics) | Custom fields on `new_invoices` | `riivo_paymentstatus` (optionset: none/sent/paid/expired/voided/locked/refunded), `riivo_paymentlinktoken_hash` (string 64), `riivo_paymentlinkissuedat` (datetime), `riivo_paymentlinkexpiresat` (datetime), `riivo_paymentprovidertxnref` (string 128), `riivo_paymentpaidat` (datetime), `riivo_paymentamount` (decimal). |
| NEW (Dynamics) | Ribbon buttons on `new_invoices` form | "Send Payment Link" (visible when `riivo_paymentstatus` ∈ {none, expired, voided}), "Void Payment Link" (visible when `riivo_paymentstatus = sent` or `locked`). |
| NEW (Dynamics) | Power Automate flows | (i) Issue Link — button click → HTTP POST to `/api/payment-links` with bearer token. (ii) Void Link — button click → HTTP POST to `/api/payment-links/{id}/void`. (iii) View "Awaiting Payment" — filtered list view. |

### 4.3 Visual specification (`/pay/[token]`)

Mobile-first, single column, max-width 480px on desktop. Matches existing TTT Tax Services brand colours from `SERVICE_BRANDING.tax`.

```
┌─────────────────────────────────┐
│ TTT Tax Services logo (centred) │
├─────────────────────────────────┤
│                                 │
│  Hi {firstName},                │
│                                 │
│  ╔═══════════════════════════╗  │
│  ║  AMOUNT DUE               ║  │
│  ║                           ║  │
│  ║       R 3,200.00          ║  │
│  ║                           ║  │
│  ║  Invoice {ref}            ║  │
│  ║  Due: {dueDate}           ║  │
│  ╚═══════════════════════════╝  │
│                                 │
│  ┌─────────────────────────┐    │
│  │  PAY NOW                │    │
│  └─────────────────────────┘    │
│                                 │
│  Secured by Peach Payments      │
│  Cards · Instant EFT            │
│                                 │
│  [View tax invoice (PDF)]       │
│                                 │
├─────────────────────────────────┤
│ Privacy · Contact TTT           │
└─────────────────────────────────┘
```

- Currency formatting: `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`.
- "Pay Now" button: primary brand colour, full width, 56px tap target.
- Loading state on submit shows spinner; redirect to Peach within 2s.
- No autocomplete-able PII inputs on this page (we already have the client's name from Dynamics; we don't ask for it again).
- Footer: privacy policy link, contact email (`payments@ttt-tax.co.za`).

### 4.4 Supabase schema (concrete)

```sql
create type payment_status as enum (
  'sent', 'paid', 'failed', 'expired', 'voided', 'locked', 'refunded'
);

create type payment_attempt_result as enum (
  'initiated', 'succeeded', 'declined', 'abandoned', 'error'
);

create table payment_requests (
  id                     uuid primary key default gen_random_uuid(),
  dynamics_invoice_id    text not null,
  dynamics_contact_id    text not null,
  dynamics_owner_id      text,                    -- systemuser id for owner notification
  token_hash             text not null unique,    -- sha256 hex of the URL token
  amount_cents           bigint not null,         -- store in cents to avoid float math
  currency               text not null default 'ZAR',
  status                 payment_status not null default 'sent',
  -- snapshot of invoice details at issue time, so we don't re-hit Dynamics on every page load
  snapshot_invoice_ref   text not null,
  snapshot_client_name   text not null,
  snapshot_client_email  text not null,
  -- lifecycle
  issued_by              text not null,           -- dynamics user who clicked send
  issued_at              timestamptz not null default now(),
  expires_at             timestamptz not null,
  voided_at              timestamptz,
  voided_by              text,
  -- payment
  peach_checkout_id      text,
  peach_payment_id       text,
  paid_at                timestamptz,
  failed_attempt_count   int not null default 0,
  locked_at              timestamptz
);

create index on payment_requests (dynamics_invoice_id);
create index on payment_requests (status, expires_at);

create table payment_attempts (
  id                     uuid primary key default gen_random_uuid(),
  payment_request_id     uuid not null references payment_requests(id),
  attempted_at           timestamptz not null default now(),
  ip_address             inet,
  user_agent             text,
  result                 payment_attempt_result not null,
  failure_reason         text,
  peach_event_id         text
);

create index on payment_attempts (payment_request_id);

create table webhook_events (
  id                     uuid primary key default gen_random_uuid(),
  provider               text not null,            -- 'peach'
  provider_event_id      text not null,            -- unique per event from Peach
  received_at            timestamptz not null default now(),
  processed_at           timestamptz,
  signature_valid        boolean not null,
  payload                jsonb not null,
  unique (provider, provider_event_id)
);

-- RLS: deny all anon access. Service-role key from API routes only.
alter table payment_requests enable row level security;
alter table payment_attempts enable row level security;
alter table webhook_events    enable row level security;
```

### 4.5 Power Automate flow contract (Dynamics side)

```
Trigger:    Manual button on new_invoices form ("Send Payment Link")
Steps:
  1. Get current new_invoices record (entity id, related contact)
  2. HTTP action:
       POST https://pay.ttt-tax.co.za/api/payment-links
       Headers:
         Authorization: Bearer {{ENV: PAYMENT_API_SERVICE_TOKEN}}
         Content-Type: application/json
       Body:
         {
           "dynamics_invoice_id": "{{record.new_invoicesid}}",
           "dynamics_contact_id": "{{record._customerid_value}}",
           "issued_by": "{{user.systemuserid}}"
         }
  3. On 2xx: success notification toast "Payment link sent."
  4. On non-2xx: error notification toast with response body.
```

The bearer token is a long-lived service token shared between Power Automate and our API (stored in Dynamics environment variables, rotated annually). Our API checks `Authorization` header against `PAYMENT_API_SERVICE_TOKEN`; mismatched → 401. The token is **never** exposed to the client browser — it lives in Dynamics secret store and Vercel env only.

---

## 5. Out of Scope (v1)

| Item | Why excluded | Re-open trigger |
| --- | --- | --- |
| TTT Accounting, Insurance, Financial Advisory entities | Tax has the worst bad-debt pain. Other entities have different merchant accounts, branding, and recipient lists. | v2 — per-entity merchant routing on top of the same architecture. |
| Partial payments | Adds significant data-model + UX complexity (re-issue link? overpay? track balance?). At R1–5k ticket size, doesn't move the needle. | v2 if pilot data shows clients abandoning because the full amount is too big to pay at once. |
| Automated payment reminders | Requires a Power Automate scanning workflow + careful tone control. Not v1 critical path. | v2 once we have a baseline of how many clients pay without reminders. |
| SMS / WhatsApp delivery of links | SA SMS open rates dominate email, but each channel adds infrastructure (BulkSMS / Clickatell / WhatsApp Business API). Email-only ships fastest. | v2 — strong candidate for the next iteration based on conversion data. |
| In-app refund UI | Refunds at R1–5k tickets are rare. Peach dashboard is PCI-compliant and auditable. | If refund volume exceeds ~5/month and finance complains about dashboard friction. |
| Customer portal / payment history / "view all my invoices" | Single-use links by design. Building a portal triples auth + UI surface. | If clients ask for a self-service "where's my receipt" page. |
| Subscription / recurring billing | TTT Tax is one-shot work, not subscription. | If TTT introduces retainer-only tax-services tier. |
| Multi-currency | TTT Tax bills in ZAR. | If TTT picks up cross-border clients. |
| Multi-language | English only. | When TTT enters non-English-first markets. |
| Browser-side payment status (trust the redirect) | Browser can be tampered with / closed mid-redirect. Webhook is the only source of truth. | Never. This is a security invariant. |
| Manual EFT confirmation | If a client EFTs out-of-band, finance reconciles in Dynamics directly (existing process). The portal handles only Peach-confirmed payments. | If finance wants the portal to track all payments regardless of channel. |

---

## 6. AI / Engineering Contracts

### 6.1 `POST /api/payment-links` — issue link

**Auth:** `Authorization: Bearer ${PAYMENT_API_SERVICE_TOKEN}` (constant-time compare).

**Request:**
```ts
{
  dynamics_invoice_id: string;  // uuid
  dynamics_contact_id: string;  // uuid
  issued_by:           string;  // dynamics systemuser id
}
```

**Behaviour:**
1. Fetch `new_invoices` record from Dynamics (amount, status, ref, due date, ownerid).
2. Fetch related contact (email, name).
3. Reject if invoice already has a non-terminal payment link (status ∈ {sent, paid, locked}).
4. Generate token: `crypto.randomBytes(32).toString('base64url')` → 43-char URL-safe.
5. Insert `payment_requests` row with `token_hash = sha256(token)`, `expires_at = now() + 14 days`.
6. Update Dynamics: set `riivo_paymentstatus=sent`, `riivo_paymentlinktoken_hash`, `riivo_paymentlinkissuedat`, `riivo_paymentlinkexpiresat`.
7. Send `sendPaymentLinkEmail` from `payments@ttt-tax.co.za` with tax invoice PDF attached.

**Response:**
```ts
{ success: true, payment_request_id: string, link_url: string }
   | { success: false, error: string }
```

### 6.2 `GET /pay/[token]` — capability landing

**Behaviour:**
- Hash incoming token, look up by `token_hash`.
- 404 if no row (don't leak whether the token ever existed).
- If `status='paid'` → render receipt summary page.
- If `status='voided' | 'locked' | 'refunded'` → render "Link no longer valid".
- If `expires_at < now()` and `status='sent'` → background update `status='expired'`, render expired page.
- Else render the payment page (§4.3 spec).

**Security headers** (subdomain-scoped):
```
Content-Security-Policy: default-src 'self'; frame-src https://*.peachpayments.com;
                         script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
                         img-src 'self' data: https:; connect-src 'self' https://*.peachpayments.com;
                         frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: payment=(self "https://*.peachpayments.com")
```

### 6.3 `POST /api/checkout-sessions` — create Peach checkout

**Auth:** Bearer of the unhashed token (verified against `token_hash` in DB).

**Behaviour:**
- Validate `payment_request` is still in `status='sent'` and not expired.
- Insert `payment_attempts` row with `result='initiated'`.
- Server-to-server: `POST https://api.peachpayments.com/v2/checkout` with amount, ref, return URL, webhook URL. (Exact shape per Peach Checkout v3 docs at build time.)
- Persist `peach_checkout_id` on the payment_request.
- Return `{ redirect_url }`.

### 6.4 `POST /api/webhook/peach` — webhook receiver

**Auth:** HMAC signature in `X-Peach-Signature` header, verified against `PEACH_WEBHOOK_SECRET`.

**Behaviour (idempotent):**
```ts
async function handlePeachWebhook(req) {
  const raw = await req.text();
  if (!verifyHmac(raw, req.headers['x-peach-signature'], PEACH_WEBHOOK_SECRET)) {
    return new Response('invalid signature', { status: 401 });
  }
  const event = JSON.parse(raw);

  // idempotency: unique key on (provider, provider_event_id)
  const inserted = await supabase.from('webhook_events').insert({
    provider: 'peach',
    provider_event_id: event.id,
    signature_valid: true,
    payload: event,
  }).select().single();

  if (inserted.error?.code === '23505') {
    return new Response('already processed', { status: 200 });
  }

  // process based on event.type
  if (event.type === 'payment.succeeded') {
    await markPaid(event);
  } else if (event.type === 'payment.failed') {
    await markFailed(event);
  }
  // ... etc

  await supabase.from('webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', inserted.data.id);

  return new Response('ok', { status: 200 });
}
```

**Critical invariants:**
- HMAC verification happens **before** any DB write or Dynamics call.
- `payment_requests.status='paid'` is set ONLY in this handler. The browser redirect page never writes status.
- Dynamics write is the last side effect; if it fails, webhook returns 500 and Peach retries (the Dynamics write is idempotent because `paid_at` is set-once).
- Email sends are best-effort and logged. A failed email does not cause webhook to retry (would re-mark paid).

### 6.5 `POST /api/payment-links/[id]/void`

**Auth:** Bearer `PAYMENT_API_SERVICE_TOKEN` (called from Dynamics Power Automate).

**Behaviour:**
- Update `payment_requests.status='voided'`, `voided_at=now()`, `voided_by={dynamics user}`.
- Update Dynamics: `riivo_paymentstatus=voided`.
- No client email (the staff member is voiding *because* something is wrong; auto-emailing would be confusing).

### 6.6 Environment-variable matrix

| Env var | Required? | Purpose | Behaviour if unset |
| --- | --- | --- | --- |
| `PAYMENT_API_SERVICE_TOKEN` | Prod yes | Shared secret between Dynamics Power Automate and our API. | API rejects all link-issue / void requests with 401. |
| `PAYMENT_API_BASE_URL` | Prod yes | `https://pay.ttt-tax.co.za` for production link URLs in emails. | Emails contain broken links. |
| `PEACH_ENTITY_ID` | Prod yes | Peach merchant identifier. | Checkout creation fails. |
| `PEACH_API_KEY` | Prod yes | Peach REST API authentication. | Checkout creation fails. |
| `PEACH_WEBHOOK_SECRET` | Prod yes | HMAC verification key. | All webhooks rejected as unauthenticated. |
| `SUPABASE_URL` | Prod yes | Supabase project URL. | All DB operations fail. |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod yes | Server-only key. NEVER expose to client. | All DB operations fail. |
| `EMAIL_PAYMENTS_SENDER_ADDRESS` | Prod yes | `payments@ttt-tax.co.za` for outgoing payment emails. | Falls back to `EMAIL_SENDER_ADDRESS` (wrong sender — alert). |
| `EMAIL_FINANCE_ADDRESS` | Prod yes | `finance@ttt-tax.co.za` or equivalent — finance notification recipient. | Finance not notified; daily digest fails to send. |
| `DYNAMICS_*` | Prod yes | Existing — for reading `new_invoices` + writing back. | Inherits existing behaviour. |

All Peach + Supabase vars are new. The `EMAIL_PAYMENTS_SENDER_ADDRESS` and `EMAIL_FINANCE_ADDRESS` are new. `PAYMENT_API_SERVICE_TOKEN` is new and must be set in both Vercel and Dynamics environment variables.

---

## 7. Test Plan

| # | Scenario | Expected |
| --- | --- | --- |
| **Link issuance** | | |
| T1 | Staff clicks "Send Payment Link" on a valid `new_invoices` record | Power Automate POST returns 200; `riivo_paymentstatus=sent`; row in `payment_requests`; client receives email with link + tax invoice PDF attached, sender = `payments@ttt-tax.co.za`. |
| T2 | Staff clicks "Send Payment Link" on an invoice that already has an active link | API returns 409; toast in Dynamics: "This invoice already has an active payment link." No duplicate row. |
| T3 | Staff clicks "Send Payment Link" on an invoice with `riivo_paymentstatus=paid` | API returns 409; toast: "This invoice is already paid." |
| **Capability link** | | |
| T4 | Client opens valid link on phone | Renders TTT Tax-branded page with name, invoice ref, amount, Pay button. |
| T5 | Client opens link with manipulated token | 404. No info leakage about which tokens exist. |
| T6 | Client opens expired link | Renders "expired" page; background updates `status='expired'`. |
| T7 | Client opens voided link | Renders "no longer valid" page. |
| T8 | Client opens already-paid link | Renders receipt summary page (no Pay button). |
| **Payment flow** | | |
| T9 | Client clicks Pay → completes card payment on Peach hosted page | Webhook fires `payment.succeeded`; `payment_requests.status=paid`; Dynamics updated; three emails sent (client receipt, owner notification, finance notification); Dynamics annotation created. |
| T10 | Client pays via Instant EFT (SiD) | Same as T9 but `peach_payment_id` reflects EFT instrument. |
| T11 | Card declined | Webhook fires `payment.failed`; `payment_attempts` row added; link remains payable; no Dynamics field change. |
| T12 | Client closes browser before Peach redirect back | Webhook still fires (server-to-server); state still correctly updated; client can re-open original link to see status. |
| **Webhook security** | | |
| T13 | Webhook with invalid HMAC | 401; no DB write; no Dynamics change. |
| T14 | Webhook replay (same event_id) | 200; no duplicate side effects (idempotent). |
| T15 | Webhook with unknown event type | 200 (acknowledged); logged; no state change. |
| T16 | Webhook arrives during Dynamics outage | Webhook handler returns 500; Peach retries; on Dynamics recovery, retry succeeds; no duplicate emails (emails are gated on `paid_at` being newly set within the transaction). |
| **Lockout** | | |
| T17 | 5 declines in 24h on same link | `status=locked`; further `/pay/[token]` views show "Please contact TTT"; invoice owner receives lockout email. |
| **Voiding** | | |
| T18 | Staff clicks "Void Payment Link" on an active link | `status=voided`; Dynamics field updated; link page renders "no longer valid." |
| **Daily cron** | | |
| T19 | Cron runs at 08:00 SAST | Single digest email to `finance@` listing all links with `status=sent AND expires_at < now()+24h`. |
| **Reconciliation** | | |
| T20 | Manual reconciliation: finance compares `payment_requests` paid rows for a week against bank statement | 100% match (zero variance). Spot-checked weekly during pilot. |

---

## 8. Rollout

**Phase 0 — Pre-launch (Riivo + TTT in parallel)**
- Riivo: build code per §4, deploy to staging, smoke-test against Peach sandbox + Dynamics sandbox (if available; else against a guarded production Dynamics with test data marked clearly).
- TTT: provision `payments@ttt-tax.co.za` shared mailbox, complete Peach KYC + sign Operator Agreement, name POPIA Information Officer, gather baseline DSO + write-off data.

**Phase 1 — Pilot (Week 1)**
- Tax team selects 5 invoices belonging to known-good payers.
- Issues links via Dynamics ribbon button.
- Daily standup (15 min): Riivo + Tax lead + finance review every paid + every failed event.
- Success criteria: 5/5 webhooks landed correctly, 5/5 Dynamics writebacks correct, 0 reconciliation errors.

**Phase 2 — Pilot expansion (Week 2)**
- Add 10–15 more invoices, including some historically slow payers.
- Same daily review cadence.
- Success criteria: ≥70% paid within 14 days, ≥95% paid within 14 days for known-good payers, 0 reconciliation errors, 0 security incidents.

**Phase 3 — Go/no-go gate (End of Week 2)**
- Riivo + TTT Tax lead + TTT finance review pilot data jointly.
- Green light requires:
  - ≥70% conversion in window
  - 0 reconciliation errors
  - 0 webhook security issues
  - Tax team confident in the Dynamics UX
- Red light: extend pilot by 1–2 weeks, address specific issue, re-gate.

**Phase 4 — Hard cutover (Week 3+)**
- All new `new_invoices` records get a payment link by default.
- Tax team policy: payment link is the standard delivery; PDF-only email is reserved for exceptions (e.g. corporate client whose AP system requires a specific format).
- Weekly metric review for first 8 weeks.

**Phase 5 — Steady state**
- Monthly metric review (conversion %, DSO, time-to-payment).
- Quarterly review of bad-debt write-offs vs prior periods.
- v2 backlog: per-entity expansion, auto-reminders, SMS/WhatsApp.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Peach merchant onboarding takes longer than expected (KYC delays) | Medium | High (blocks launch) | Start Peach onboarding in parallel with build, not after. Flag any week-3 delay as a critical path issue. |
| Dynamics customisation expertise gap on TTT side | Medium | Medium | Riivo handles all custom field + Power Automate setup. TTT only needs to approve the schema additions and grant deployment access. |
| Webhook handler bug marks an invoice paid that wasn't paid | Low | High | HMAC verification + idempotency + nightly bank-statement spot-check during pilot. Webhook code reviewed line-by-line + dedicated test suite for security path. |
| Client confused by "two ways to pay" during pilot (some get link, some get old PDF) | Medium | Low | Pilot is small (15 clients). Tax team explicitly briefs each pilot client by phone before sending. |
| Bad debt doesn't drop measurably (clients still don't pay) | Low | Medium | The metric we *can* move is conversion %. If clients still don't pay even with one-tap links, the bad debt is a different problem (e.g. clients lack funds, not friction). v2 might be debit-order arrangements rather than reminder cadence. |
| Peach goes down on a busy day | Low | Medium | Hosted checkout side handled by Peach (their SLA). Our side: links stay valid; clients can retry once Peach is up. |
| Email deliverability issues (DMARC, spam filtering) for new `payments@` sender | Medium | Medium | Confirm SPF + DKIM + DMARC alignment for `ttt-tax.co.za` covers the new mailbox. Test from multiple consumer mail providers (Gmail, Outlook, Yahoo) pre-launch. |
| Token leaked via email forwarding to wrong recipient | Low | Low | Capability URL model — accepted in design. The "wrong person" can only *pay* an invoice meant for someone else, which is not a security loss. 14-day expiry + single-use limits exposure. |
| POPIA non-compliance (no Information Officer, no operator agreement signed) | High if not addressed | High (regulatory) | Listed as launch blockers in §10. Cannot go live until checked. |
| Refunds not handled cleanly because they live outside the system | Medium | Low | Finance trained on Peach dashboard. Refund triggers a manual Dynamics annotation. Volume expected to be low. |

---

## 10. Launch Blockers (TTT actions)

| # | Item | Owner | Resolution by |
| --- | --- | --- | --- |
| L1 | Designate POPIA Information Officer (name + email) for privacy notice | TTT compliance / partners | Before pilot start |
| L2 | Sign Peach Operator Agreement / Data Processing Addendum | TTT legal | Before pilot start |
| L3 | Complete Peach merchant KYC (banking details, FICA docs) | TTT finance | Before pilot start |
| L4 | Provision `payments@ttt-tax.co.za` shared M365 mailbox, grant Send-As to existing Graph app | TTT IT | Before pilot start |
| L5 | Confirm `finance@ttt-tax.co.za` (or equivalent) is the correct credit-control inbox | TTT finance | Before pilot start |
| L6 | Provide baseline DSO + bad-debt write-off data for preceding 12 months | TTT finance | Before pilot start (else no measurement baseline) |
| L7 | Grant Riivo access to Dynamics environment for custom field + Power Automate deployment | TTT IT | Before build phase 0 |
| L8 | Confirm production HTTPS domain `pay.ttt-tax.co.za` — DNS + Vercel host alias | TTT IT + Riivo | Before pilot start |
| L9 | Verify SPF/DKIM/DMARC for `ttt-tax.co.za` covers the new `payments@` mailbox | TTT IT | Before pilot start |

## 11. Open Questions

| # | Question | Owner | Resolution by |
| --- | --- | --- | --- |
| Q1 | Does TTT have a Dynamics sandbox / test environment, or does staging run against production with test-flagged records? | TTT IT | Before build phase 0 |
| Q2 | Final go/no-go on Peach as the provider (vs Paystack alternative documented in proposal) | TTT exec | Before phase 0 |
| Q3 | Tax invoice PDF — confirm it is stored as a Dynamics annotation on `new_invoices` (vs generated on-demand). If on-demand: identify the generator endpoint. | Riivo + TTT IT | Before phase 0 |
| Q4 | Any client segments to *exclude* from the link flow on principle (e.g. specific corporate clients on a contractual payment-terms arrangement)? | TTT Tax lead | Before phase 1 |
| Q5 | After full rollout, can the PDF-only fallback be removed entirely, or is it always required as a parallel channel? | TTT Tax lead | After phase 4 |

---

*End of PRD.*
