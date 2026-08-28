# Proposal — TTT Tax Payment Portal

| Field | Value |
| --- | --- |
| Prepared by | Riivo (Luc Duval) |
| Prepared for | TTT — Tax Services |
| Date | 2026-05-20 |
| Status | For TTT decision |
| Companion technical doc | [PRD-payment-portal.md](./PRD-payment-portal.md) |
| Decision deadline | TBC by TTT |

---

## Executive Summary

TTT Tax Services writes off material amounts each year as bad debt because clients delay or default on invoice payments. Reminders are manual, EFT reconciliation is manual, and there is no friction-removing payment channel.

Riivo proposes a **secure payment portal** integrated with TTT's existing Microsoft Dynamics CRM. The Tax team will issue a single-click payment link from the existing `new_invoices` record. The client receives the link by email, pays by card or Instant EFT, and the invoice is automatically marked paid in Dynamics, with a receipt to the client and a notification to the invoice owner and finance team.

**Key recommendations:**

1. **Provider:** Peach Payments (cards + Instant EFT, hosted checkout, ZAR settlement, local SA support).
2. **Scope (v1):** TTT Tax Services only. Pay-in-full only. Email delivery only.
3. **Rollout:** 2-week supervised pilot with 15–20 invoices, then hard cutover for all Tax invoices.
4. **Architecture:** New dedicated subdomain `pay.ttt-tax.co.za`, hosted on the existing Riivo-managed Next.js infrastructure, with Supabase as the local database and Dynamics as the financial source of truth. **Card data never touches TTT or Riivo infrastructure** — Peach handles all PCI scope.

**Expected outcomes:**

| KPI | Target | Time to measure |
| --- | --- | --- |
| Payment link conversion rate | ≥70% paid within 14 days | 4 weeks post go-live |
| Median time-to-payment | <72 hours from link issue | 4 weeks post go-live |
| Days Sales Outstanding (DSO) reduction | 30% vs baseline | 6 months post go-live |
| Bad debt write-offs reduction | ≥40% vs prior FY | 12 months post go-live |

---

## 1. The Problem in TTT's Own Terms

Today, the Tax invoicing process looks like this:

1. Work is performed.
2. Tax invoice is generated in Dynamics (`new_invoices`).
3. Tax team emails the PDF to the client with EFT banking details.
4. The client must:
   - Open their banking app.
   - Type the beneficiary account number.
   - Type the invoice reference.
   - Type the amount.
   - Confirm the payment.
5. TTT waits. Some clients pay quickly. Many don't.
6. Finance manually matches bank statement lines to outstanding invoices in Dynamics.
7. The Tax team chases unpaid invoices by phone and email — repeatedly.

The friction in step 4 is the single largest determinant of whether a client pays today or "next week" (which becomes never). For a R3,200 invoice, the perceived effort of EFT setup exceeds the perceived urgency. Bad debt accumulates not because clients can't pay, but because they procrastinate the act of paying.

For TTT, this manifests as:

- **Lost cash flow** — invoices outstanding for 60+ days that should be paid within 7.
- **Wasted staff time** — Tax team members spending hours per week on payment chasing rather than tax work.
- **Bad debt write-offs** — material amounts annually that simply never come in.
- **Operational fragility** — payment reconciliation depends on one or two finance staff matching things by hand.

## 2. The Proposed Solution

### 2.1 What the client experiences

1. Client receives an email from `payments@ttt-tax.co.za` with subject `"Payment for Invoice INV-2026-0123 — TTT Tax Services"`.
2. Email includes the tax invoice PDF (the same one TTT issues today) and a prominent **"Pay Now"** button.
3. Client taps the button on their phone → lands on a clean TTT-branded page showing their name, the invoice reference, the amount due, and one button: **Pay R3,200.00**.
4. Client taps Pay → choose card or Instant EFT → completes payment on Peach's secure hosted page.
5. Client receives a payment receipt by email within seconds.

Total time from "I'll do this now" to "done": ~30 seconds. No banking app, no typing, no reference numbers.

### 2.2 What the Tax team experiences

1. Tax staff opens an invoice record in Dynamics (no change to existing workflow).
2. Clicks a new **"Send Payment Link"** ribbon button.
3. Receives a confirmation toast: "Payment link sent."
4. The invoice automatically updates its status in Dynamics — `Awaiting Payment` → `Paid`.
5. On payment, the invoice owner is notified by email.

No new login. No new system to learn. No new training beyond a 15-minute walkthrough.

### 2.3 What the Finance team experiences

1. On every successful payment, finance receives an automated notification: `"Payment received: {client name} R{amount} — invoice {ref}"`.
2. The Dynamics invoice record carries an automatic audit trail (annotation) with the Peach reference, paid amount, and timestamp.
3. Weekly: finance spot-checks the payment portal records against the bank settlement statement. Should match 1:1.
4. Refunds (rare at this ticket size) are processed directly in the Peach dashboard, with finance manually noting it in Dynamics.

No more line-by-line statement matching for invoices that came through the portal.

## 3. Why Peach Payments

We compared the major South African payment providers against TTT's specific requirements: cards + Instant EFT, ZAR settlement, hosted checkout (so TTT inherits no PCI compliance burden), reliable webhooks for Dynamics integration, and local support.

| Provider | Cards | Instant EFT | Hosted Checkout | Local Support | Fit for TTT |
| --- | --- | --- | --- | --- | --- |
| **Peach Payments** | ~2.9% + R1.50 | Yes (SiD) | Yes — Checkout v3 | Strong — JHB-based account management | **Recommended** |
| Paystack | ~2.9% | Yes (partner-integrated) | Yes — Inline/Popup | Smaller team, Stripe-backed | Strong runner-up |
| PayFast | ~3.5% + R2 | Yes (~2% + R2) | Yes | Local, but dated DX | Cheaper EFT but rougher integration |
| Yoco Online | ~2.95% | No | Yes | Local | Card-only — fails the requirement |
| Stripe (SA) | ~2.9% + R2 | No (in SA) | Yes | Limited local | Card-only in SA |
| Ozow | N/A | ~1.5% + R1.50 | Yes | Local | EFT-only — fails the requirement |

**Why Peach for TTT specifically:**

1. **Cards + Instant EFT in one integration.** No need to manage two contracts, two webhooks, or two reconciliation flows.
2. **Local account management.** TTT is a professional services firm, not a fintech. When something goes wrong, you want a named SA account manager who picks up the phone — not a support ticket queue.
3. **Mature webhook reliability + signed payloads.** This is the critical piece for our Dynamics integration. Peach's webhook semantics are documented, signed, and have idempotency-friendly retry behaviour.
4. **Negotiable rates at volume.** Peach competes for mid-market financial-services clients. Once TTT shows steady monthly volume, the card rate is negotiable down from ~2.9% to ~2.6% or lower.
5. **Established trust signal.** Many of TTT's clients have paid Peach-powered pages before (insurers, telcos, retailers). Brand familiarity at checkout helps conversion.

**Worth considering Paystack if:**

- TTT is sensitive to onboarding speed — Paystack's self-serve KYC is faster than Peach's enterprise process.
- TTT has plans to expand to other African markets (Nigeria, Kenya, Ghana) — Paystack has much stronger non-SA coverage.

For SA-only Tax operations with the bad-debt problem we're solving, **Peach is the recommendation**. The proposal stands either way — the architecture works identically with Paystack as the provider, with a one-day swap at the integration layer if TTT prefers.

## 4. Architecture & Security Overview

```
Tax staff in Dynamics
       │
       │ clicks "Send Payment Link"
       ▼
Dynamics Power Automate flow
       │
       │ HTTPS + bearer token
       ▼
pay.ttt-tax.co.za (Riivo-managed Next.js + Supabase)
       │
       ├──── generates secure single-use token
       ├──── writes payment_request to Supabase
       ├──── writes status to Dynamics new_invoices
       └──── emails client (link + tax invoice PDF) via Microsoft Graph

Client opens link → Peach Payments hosted checkout (PCI scope = Peach, NOT TTT)
       │
       │ pays
       ▼
Peach webhook (signed, verified) → pay.ttt-tax.co.za
       │
       ├──── marks payment_request paid (Supabase)
       ├──── writes status to Dynamics new_invoices
       └──── emails client receipt + invoice owner + finance team
```

**Security stance:**

| Concern | Approach |
| --- | --- |
| Card data | **Never touches TTT or Riivo systems.** Handled entirely by Peach's PCI-DSS Level 1 certified hosted checkout. |
| PCI compliance scope | SAQ-A (smallest possible scope — applies because card data never touches our infrastructure). |
| Payment link tokens | 32 bytes of cryptographic randomness, single-use, 14-day expiry, stored hashed (SHA-256), never logged in plaintext. |
| Webhook authenticity | HMAC signature verified before any database or Dynamics write. Forged webhooks are rejected at the door. |
| Replay attacks | Each webhook event is idempotency-keyed by provider event ID; duplicates are accepted and discarded silently. |
| Data at rest | Supabase encryption at rest (AES-256). Dynamics: Microsoft's standard encryption. |
| Data in transit | TLS 1.2+ end to end. HSTS enforced on `pay.ttt-tax.co.za`. |
| POPIA compliance | Footer privacy notice on payment page; Peach signs an Operator Agreement with TTT; 7-year retention on financial records (SARS alignment), 90-day retention on operational logs. |
| Audit trail | Every payment generates an immutable annotation on the Dynamics invoice record. |
| Permission control | Issuing and voiding links uses existing Dynamics role-based access. No new permission system to manage. |

## 5. What's In Scope vs Out of Scope

**In scope (v1):**

- Single-use payment links for TTT Tax Services invoices.
- Cards (Visa, Mastercard, with 3DS2) + Instant EFT (via SiD).
- Email delivery of links (via existing Microsoft Graph infrastructure).
- Automatic reconciliation back to Dynamics on payment.
- Receipt emails to client; notification emails to invoice owner + finance.
- Daily digest of soon-to-expire unpaid links.
- Dynamics ribbon buttons for issuing and voiding links.
- Audit annotations on every payment event.

**Out of scope (v1), candidates for v2:**

- Other TTT entities (Accounting, Insurance, Financial Advisory).
- Partial payments.
- Automated payment reminders (e.g. "your invoice is 7 days overdue").
- SMS / WhatsApp delivery (high-impact addition for v2 — SA SMS open rates dominate email).
- In-app refund interface (refunds handled directly in Peach dashboard).
- Customer-facing portal / payment history.
- Subscription / recurring billing.

The architecture is intentionally designed so v2 additions are *additive* — adding other entities is a per-entity merchant routing layer, not a rewrite.

## 6. Rollout Plan

The rollout is deliberately conservative because real money is involved and the cost of getting reconciliation wrong is high (eroded trust with both clients and TTT's finance team).

### Phase 0 — Pre-launch (4–6 weeks, parallel work)

**Riivo:**

- Build payment portal per technical PRD.
- Set up `pay.ttt-tax.co.za` subdomain and infrastructure.
- Implement Dynamics customisations (custom fields, ribbon buttons, Power Automate flows).
- Sandbox integration with Peach test environment.
- Deploy to staging; pre-launch security review.

**TTT (launch blockers — see PRD §10):**

- Complete Peach merchant onboarding (KYC, banking details, FICA — typically 1–3 weeks).
- Sign Peach Operator Agreement / Data Processing Addendum.
- Provision `payments@ttt-tax.co.za` shared mailbox in Microsoft 365.
- Designate POPIA Information Officer (name + email).
- Provide baseline DSO + bad debt write-off data for prior 12 months.
- Confirm `finance@ttt-tax.co.za` as the credit-control notification inbox.
- Grant Riivo deployment access to Dynamics.

### Phase 1 — Pilot Week 1 (5 invoices, known-good payers)

- Tax team selects 5 clients who are reliable payers.
- Each link is issued via Dynamics ribbon button.
- Daily 15-minute standup: Riivo + Tax lead + finance review every event.
- Validates the happy path end-to-end at low risk.

### Phase 2 — Pilot Week 2 (10–15 invoices, broader mix)

- Includes some historically slow-paying clients (the actual target audience).
- Continued daily standup.
- Measures real conversion lift on the problem segment.

### Phase 3 — Go / No-Go Gate (End of Week 2)

Decision is taken jointly by TTT (Tax lead + finance) and Riivo. Green light requires:

- ≥70% of pilot links paid within 14 days.
- 0 reconciliation discrepancies (every webhook-confirmed payment matches the bank settlement).
- 0 security incidents (no token leaks, no webhook auth failures in production traffic).
- Tax team confidence that the Dynamics UX is workable.

If any criterion fails, the pilot is extended 1–2 weeks while the specific issue is addressed.

### Phase 4 — Hard Cutover (Week 3+)

- All new Tax invoices issued via the payment link by default.
- PDF-only fallback is reserved for explicit exceptions (e.g. corporate clients whose AP system requires a different format).
- Weekly metric review for the first 8 weeks.

### Phase 5 — Steady state + v2 planning

- Monthly metric review.
- Quarterly bad-debt review.
- v2 backlog discussions (auto-reminders, SMS, other entities).

## 7. Commercial Structure

This section is a placeholder for Riivo + TTT to finalise commercial terms.

### 7.1 Build cost (one-off)

**Effort estimate:**

| Workstream | Effort |
| --- | --- |
| Backend (API routes, Supabase schema, Peach integration, webhook handler, email infra) | ~2–3 weeks |
| Frontend (payment page, result page, privacy notice, mobile-first responsive) | ~1 week |
| Dynamics customisations (custom fields, ribbon buttons, Power Automate flows) | ~0.5–1 week |
| Convex removal + cleanup | ~0.5 week |
| Security review + sandbox testing | ~0.5 week |
| Pilot supervision + daily standups (2 weeks) | ~1 week elapsed (part-time) |
| **Total Riivo effort** | **~5–7 weeks** |

**Commercial terms: [to be finalised by Riivo and TTT]**

### 7.2 Ongoing transaction fees (paid to Peach by TTT)

| Method | Indicative rate | Notes |
| --- | --- | --- |
| Cards (Visa, Mastercard) | ~2.9% + R1.50 per transaction | Negotiable down at volume |
| Instant EFT (SiD) | ~R5–R10 flat per transaction | Lower % for higher tickets |

At TTT's typical R1–5k ticket size, expect blended effective rates of ~2.5–3.0%. For every R100,000 collected, transaction fees are ~R2,500–R3,000.

**Critical framing:** The relevant comparison is **not** "transaction fees vs free EFT." The relevant comparison is **transaction fees vs current bad debt write-offs**. If even a single previously-unpaid R10k invoice gets paid because the friction was removed, it pays for ~R300k of card processing fees.

### 7.3 Ongoing hosting + infrastructure (paid to Riivo / vendors)

| Item | Indicative monthly cost |
| --- | --- |
| Supabase (small project tier) | ~$25/month |
| Vercel (already in use for the website; subdomain adds negligible cost) | Within existing plan |
| Microsoft 365 shared mailbox `payments@` | Within existing M365 tenant |
| Riivo support / maintenance | [to be finalised] |

Total incremental infrastructure cost is small — well under R1,000/month at expected volumes.

## 8. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| **Bad debt doesn't drop measurably** — clients still don't pay even with one-tap links. | We measure conversion rate *of the link itself* as the primary metric. If that's ≥70% but write-offs don't drop, the bad debt is a *funds* problem, not a *friction* problem, and v2 should focus on debit-order arrangements rather than reminder cadence. The data tells us which problem we're solving. |
| **Peach onboarding takes longer than expected** | Start KYC immediately in parallel with build, not after. Flag any 3-week delay as a critical path issue. |
| **Webhook bug marks an invoice paid that wasn't paid** | HMAC verification + idempotency + nightly bank reconciliation during pilot. Code reviewed line-by-line. Pilot's daily standup catches anomalies within 24 hours. |
| **POPIA compliance gap** (no Information Officer, no operator agreement) | Listed as a launch blocker. Cannot go live without it. Riivo will provide a checklist; TTT executes. |
| **Email deliverability issues** for new `payments@` sender | Confirm SPF + DKIM + DMARC alignment pre-launch. Test from Gmail, Outlook, Yahoo, ProtonMail. |
| **Adoption gap** — Tax staff forget to click the button and revert to old PDF-only flow | Default the link issuance into the standard process post-cutover. Track per-staff issuance rates in the weekly metric review. |

## 9. What TTT Needs to Decide

To move forward, Riivo asks TTT to confirm or push back on:

1. **Approval to proceed** with the build at the proposed scope (TTT Tax only, pay-in-full only, cards + Instant EFT).
2. **Provider selection**: confirm Peach Payments (Riivo's recommendation), or instruct Riivo to substitute Paystack.
3. **Commercial terms** with Riivo (to be finalised separately).
4. **Launch blocker ownership**: confirm TTT will action items L1–L9 in PRD §10 within the timeline implied by Phase 0 (4–6 weeks).
5. **POPIA Information Officer**: name + email to appear in the privacy notice.
6. **Baseline data commitment**: TTT finance will pull DSO + write-off history for the prior 12 months before pilot starts.

Once these are confirmed, Riivo can begin Phase 0 within one week.

## 10. Why This Project Is Worth Doing

The bad debt problem at TTT today is not a question of poor judgement about which clients to take on, or of legal collection power. It is a problem of **friction at the moment of payment**. Every additional click, every typed banking detail, every "I'll do it later" is a percentage point of bad debt accumulating.

The portal eliminates that friction with a single-purpose, professionally branded, secure payment experience. It costs Riivo's build fee + a small percentage of payments collected, against a current cost of millions of rand written off annually.

If the pilot data confirms even a modest improvement in conversion rate (say, 60% paid in 14 days vs an estimated current ~30% in 30 days), the project pays for itself within months and continues compounding in TTT's favour year over year.

---

*Riivo recommends TTT approve this proposal. We are ready to start within one week of sign-off.*
