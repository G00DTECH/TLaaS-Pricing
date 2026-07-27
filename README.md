# CivicChain TLaaS — Pricing Estimator

A standalone web app that produces an **annual cost estimate for a municipality** to run
**TLaaS (Trustless Ledger as a Service)** — CivicChain's blockchain-backed replacement for
legacy BI / open-data incumbents, whose commercial weapon is **$0 per-user pricing**.

Built to `TLaaS_Pricing_App_Build_Spec.md` (Draft v1.0). Styled to the
[CivicChain brand system](https://civicchain-v2.vercel.app/brand) — DM Serif Text / DM Sans,
OKLCH civic-ink + gold + sage palette.

## Two modes

| | **Municipality** (public) | **Sales rep** (passphrase-gated) |
|---|---|---|
| Inputs | Population, solicitations, departments, contact | + known volume, deployment, tier override, discount, add-ons, competitor benchmark |
| Cost / margin | Hidden | Visible (COGS, gross margin, floor status) |
| Discounting | No | Yes — guardrail-checked against the 60% margin floor |
| Output | Value-framed estimate + PDF | Full quote + PDF proposal |

Rep mode demo passphrase: **`civicchain`** (set `VITE_REP_PASSPHRASE` to change).

## Run

```bash
npm install
npm run dev        # http://localhost:5180
npm test           # 16 tests — includes the spec's worked examples A & B
npm run build      # static bundle in dist/  → deploy to Vercel/Netlify/S3
```

No backend is required for the calculator. Add one only for auth, lead capture, or saved quotes.

## The one rule: pricing is DATA, not code

**Every tunable number lives in [`src/pricing.config.ts`](src/pricing.config.ts).** Tiers, overage
rates, estimation coefficients, implementation fees, COGS, the margin floor, and competitor
defaults can all be changed there with **no code change**. The engine
([`src/lib/pricing.ts`](src/lib/pricing.ts)) is a set of pure functions and never hard-codes a price.

### Modeling principle (do not break)
Population is a **sizing heuristic** and a **value-framing** metric only — it **never directly
multiplies the price**. The directly-billed drivers are **on-chain anchors** (primary) and
**ingestion transactions** (secondary). Charging per citizen would recreate the per-seat model
we're attacking.

## ⚑ Calibrate before launch (spec §12)

The following in `pricing.config.ts` are seed/placeholder values — replace with real data:

- **Estimation coefficients** (`estimation.*`) — calibrate against real pilot ingestion/anchoring volume.
- **Implementation fees & COGS** (`implementation.*`, `cogs.*`) — plug in real onboarding hours + loaded rate.
- **Competitor defaults** (`competitor.*`) — populate from the incumbent vendor's public procurement records.
- **Margin floor** (`guardrail.MIN_GROSS_MARGIN`, default 60%) — confirm the target.
- **Tier population floors** (`tiers[].minPopulation`, `tierSelection.usePopulationFloor`).

## Structure

```
src/
  pricing.config.ts     ← single source of truth (all $ and coefficients)
  lib/
    pricing.ts          ← pure estimation + tiering + quote engine
    pricing.test.ts     ← worked examples A & B + overage/margin/competitor tests
    pdf.ts              ← branded PDF quote/proposal export (jsPDF)
    format.ts           ← currency / number helpers
  components/
    QuoteForm.tsx        ← customer + rep inputs
    QuoteResults.tsx     ← headline metrics, breakdown, TCO, savings, margin
    ui.tsx               ← brand-styled form primitives
  App.tsx                ← mode toggle + rep auth gate + layout
```

## Roadmap (v1 out-of-scope, architected for)

The config + UI are module-shaped so a second product (payment rails, card issuing, full
CivicChain bundle) can be added later without reworking the engine. Live billing/metering and
CRM lead-capture integration are Phase 2.
