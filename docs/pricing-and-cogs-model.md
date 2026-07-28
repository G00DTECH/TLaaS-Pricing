# TLaaS Pricing & COGS Model

A plain-language walkthrough of how the estimator turns a few municipal inputs into a
quote, and how the internal COGS / margin model works. Every number here comes from
[`src/pricing.config.ts`](../src/pricing.config.ts) — change it there and the whole app
(and these calculations) move with it.

> **Reviewer's note on precision:** all coefficients marked ⚑ below are seed values, not
> observed data. The *structure* is what to review here; the *numbers* get calibrated with
> real pilot + infrastructure data before launch.

---

## 1. The commercial idea in one paragraph

TLaaS bills on **data volume and on-chain anchoring**, and gives **unlimited citizen and
staff access for $0 per user**. Population is used only to *size* a town and to *frame value*
("cost per citizen") — it is never a direct price multiplier, because per-citizen pricing
would recreate the per-seat model we're displacing. The directly-billed drivers are
**anchors** (primary) and **ingestion transactions** (secondary).

---

## 2. The calculation, end to end

```
municipal inputs
   │
   ▼
[A] Estimate monthly volume ──► transactions/mo, anchors/mo
   │
   ▼
[B] Select tier (soft cap) ───► the cheapest tier at/above the population floor
   │
   ▼
[C] Overage ──────────────────► charge for volume above the tier's included allowance
   │
   ▼
[D] Subscription + add-ons + discount ► recurring annual $
   │
   ▼
[E] One-time implementation ──► onboarding + integrations + backfill + setup
   │
   ▼
[F] Totals ───────────────────► year-1, recurring (yr 2+), 3-yr TCO, cost/citizen
   │
   ▼
[G] Margin (internal) ────────► per-tenant COGS, gross margin, floor check
   │
   ▼
[H] Competitor comparison ────► $ and % saved vs. the incumbent
```

### [A] Volume estimation

If a rep supplies **known monthly transactions**, the engine uses them directly and skips
estimation. Otherwise it estimates from municipal inputs:

```
monthly_transactions =
    TX_BASE_PER_DEPT      × departments
  + TX_PER_1000_CITIZENS  × (population / 1000)
  + TX_PER_SOLICITATION   × (annual_solicitations / 12)

monthly_anchors =
    ANCHORS_PER_SOLICITATION × (annual_solicitations / 12)
  + ANCHOR_BASELINE_PER_DEPT × departments
```

Current coefficients (⚑ calibrate): `TX_BASE_PER_DEPT=400`, `TX_PER_1000_CITIZENS=150`,
`TX_PER_SOLICITATION=8`, `ANCHORS_PER_SOLICITATION=3`, `ANCHOR_BASELINE_PER_DEPT=2`.

### [B] Tier selection — a **soft cap**, not a hard cap

The three tiers:

| Tier | Monthly base | Included tx/mo | Included anchors/mo | Population floor |
|---|---:|---:|---:|---:|
| Startup / Single Facility | $150 | 2,500 | 5 | — |
| Growth / Public Utility | $750 | 25,000 | 25 | 15,000 |
| Enterprise / Municipality | $2,500 | 150,000 | Unlimited | 60,000 |

Selection rule:

1. **Population floor** — the town's population sets the *minimum* tier so a large
   municipality is never sold a tiny plan. (≥15,000 → at least Growth; ≥60,000 → Enterprise.)
2. Among the tiers **at or above that floor**, pick the one that costs the **customer** the
   least: `base × 12 + projected overage`.

This is the key behavior: a customer **stays on their tier and pays overage** for usage above
the included allowance. A higher tier is chosen **only when its flat rate actually beats
lower-tier-plus-overage**. There is therefore **no price cliff** at a tier boundary — going
one transaction over a limit adds cents of overage, not a jump to the next tier's base.

> **What this replaced:** the old rule picked the smallest tier whose limits *fully
> contained* demand, which force-upgraded on any excess (one tx over Growth → Enterprise, a
> ~$9k → $30k jump) and made the overage system unreachable.

### [C] Overage

```
tx_overage_yr     = max(0, monthly_tx - included_tx) × 12 / 100 × $0.05
anchor_overage_yr = max(0, monthly_anchors - included_anchors) × 12 × $0.10
```

Ingestion overage is **$0.05 per 100 rows**; anchoring overage is **$0.10 per anchor write**
(the real on-chain fee is a fraction of a cent, so this line is ~99% margin and safely covers
network cost). Enterprise has unlimited anchors, so its anchor overage is always $0.

### [D] Recurring (annual)

```
annual_subscription        = tier.base × 12
discount_amount            = annual_subscription × (discount% / 100)   ← subscription only
recurring_addons_yr        = priority/gov SLA support + dedicated RPC + GovCloud premium
recurring_annual (yr 2+)   = (annual_subscription − discount_amount)
                             + tx_overage_yr + anchor_overage_yr + recurring_addons_yr
```

Add-ons (⚑): priority support $4,800/yr, Gov SLA $12,000/yr, dedicated RPC $3,600/yr,
GovCloud premium = 20% of subscription. Discount applies to the **subscription only** and is
guardrail-checked (see [G]).

### [E] One-time implementation

```
one_time = IMPL_BASE
         + IMPL_PER_INTEGRATION × integrations   (integrations defaults to # departments)
         + backfill_records / 1000 × BACKFILL_FEE_PER_1000   (if backfill)
         + DEDICATED_SETUP_FEE                                (if dedicated/GovCloud)
```

Current (⚑): `IMPL_BASE=$7,500`, `IMPL_PER_INTEGRATION=$1,200`, `BACKFILL_FEE_PER_1000=$40`,
`DEDICATED_SETUP_FEE=$6,000`.

### [F] Totals

```
year_one_total   = one_time + recurring_annual
recurring_annual = subscription(after discount) + overages + add-ons   (year 2+)
three_year_tco   = year_one_total + 2 × recurring_annual   (implementation counted once)
cost_per_citizen = year_one_total / population              (value framing only)
```

---

## 3. The COGS model (internal — drives margin view & guardrails)

This is the part that was rebuilt. **TLaaS is multi-tenant**, so the cost of a tier's shared
environment is spread across every tenant on it, plus a small true marginal cost per tenant.

### Why the old model was wrong

The previous model set per-tenant infra COGS equal to the cost of a **whole environment**
($100 / $400 / $750 a month). That's the cost of the *deployment*, not of *one customer* on
it. With more than a couple of tenants sharing an environment, it wildly overstated cost —
so Startup showed 33% and Growth 47% gross margin at list price, and the 60% margin-floor
warning fired on nearly every quote (training reps to ignore it).

### The formula

**Shared (standard) deployment — cost is amortized:**

```
per_tenant_infra_monthly = shared_env_monthly / tenants_per_environment + marginal_monthly
```

**Dedicated / GovCloud — single-tenant, bears the full environment:**

```
per_tenant_infra_monthly = (shared_env_monthly + marginal_monthly) × (1 + dedicated_uplift%)
```

```
annual_COGS = per_tenant_infra_monthly × 12
```

### The inputs (all ⚑ calibrate)

| Tier | Shared env $/mo | Tenants / env | Marginal $/mo/tenant |
|---|---:|---:|---:|
| Startup | $100 | 40 | $8 |
| Growth | $400 | 25 | $20 |
| Enterprise | $750 | 12 | $45 |

`dedicated_uplift% = 20%`.

- **Shared env $/mo** — the full monthly cost to run that tier's environment (managed
  Postgres, containers, storage, monitoring, secrets, RPC). Midpoints of the spec's ranges.
- **Tenants / env** — how many customers share one environment. This is the amortization
  denominator and the single most important number to calibrate; it falls as you scale.
- **Marginal $/mo/tenant** — the true incremental cost of adding one tenant (per-tenant
  storage, DB share, support overhead) that does *not* amortize.

### Resulting per-tenant COGS

| Tier | Shared (standard) | | Dedicated / GovCloud | |
|---|---:|---:|---:|---:|
| | **$/mo** | **$/yr** | **$/mo** | **$/yr** |
| Startup | 100/40 + 8 = **$10.50** | **$126** | (100+8)×1.2 = **$129.60** | **$1,555** |
| Growth | 400/25 + 20 = **$36.00** | **$432** | (400+20)×1.2 = **$504.00** | **$6,048** |
| Enterprise | 750/12 + 45 = **$107.50** | **$1,290** | (750+45)×1.2 = **$954.00** | **$11,448** |

### Implementation COGS

```
implementation_COGS = loaded_hourly_rate × onboarding_hours(complexity)
```

`loaded_hourly_rate = $165`; hours by complexity (⚑): low 30 ($4,950), med 60 ($9,900),
high 110 ($18,150). Complexity defaults from integration count (≤2 low, ≤6 med, else high).

> ⚠️ **Known gap (not yet fixed):** the margin floor checks *recurring* revenue only.
> Implementation is not floor-checked, so a high-integration deal can, in principle, be sold
> below its labor cost. Flagged for a follow-up if you want it.

---

## 4. Margin & the guardrail (spec §4.3)

```
recurring_gross_margin = (recurring_annual − annual_COGS) / recurring_annual
min_recurring_for_floor = annual_COGS / (1 − MIN_GROSS_MARGIN)      MIN_GROSS_MARGIN = 60%
meets_floor = recurring_annual ≥ min_recurring_for_floor
```

A rep discount that pushes recurring revenue below `min_recurring_for_floor` raises a
**warning** and requires an explicit, logged override flag.

**At full list price, every tier now clears the floor comfortably:**

| Tier | Subscription $/yr | Annual COGS | Gross margin | Floor min ($COGS/0.4) | Max discount before floor* |
|---|---:|---:|---:|---:|---:|
| Startup | $1,800 | $126 | **93.0%** | $315 | ~82% |
| Growth | $9,000 | $432 | **95.2%** | $1,080 | ~88% |
| Enterprise | $30,000 | $1,290 | **95.7%** | $3,225 | ~89% |

\* discount on subscription with no overage/add-ons. The point isn't that reps *should*
discount 80%+ — it's that the floor is now a **real** guardrail that only trips on genuinely
unprofitable deals, instead of firing on every quote.

---

## 5. Worked example (end to end)

**Input:** City of Example — population 30,000, 300 solicitations/yr, 6 departments,
standard deployment, no discount, no add-ons. No known volume (estimated path).

**[A] Estimate**
```
tx/mo      = 400×6 + 150×(30,000/1,000) + 8×(300/12) = 2,400 + 4,500 + 200 = 7,100
anchors/mo = 3×(300/12) + 2×6 = 75 + 12 = 87
```

**[B] Tier** — population 30,000 ⇒ floor = Growth. Compare Growth vs Enterprise:
```
Growth:     9,000 + tx 0 (7,100 < 25,000) + anchors (87−25=62 → 62×12×$0.10 = $74.40) = $9,074.40
Enterprise: 30,000
```
Cheapest ⇒ **Growth + overage**.

**[C]–[D] Recurring**
```
subscription       = $9,000
anchor overage     = $74.40
recurring_annual   = $9,074.40
```

**[E] Implementation** — integrations = 6 departments:
```
one_time = 7,500 + 1,200×6 = $14,700
```

**[F] Totals**
```
year_one_total  = 14,700 + 9,074.40      = $23,774.40
three_year_tco  = 23,774.40 + 2×9,074.40 = $41,923.20
cost_per_citizen (yr 1) = 23,774.40 / 30,000 ≈ $0.79
```

**[G] Margin (internal)**
```
annual_COGS (Growth, shared) = $432
recurring_gross_margin = (9,074.40 − 432) / 9,074.40 = 95.2%   → PASS (floor 60%)
implementation_COGS (med, 6 integrations) = 165 × 60 = $9,900  (revenue $14,700)
```

**[H] Competitor** (defaults $85,000/yr + $45,000 impl):
```
incumbent year-1 = $130,000   → TLaaS $23,774  → save $106,226 (82%)
incumbent 3-yr   = $300,000   → TLaaS $41,923  → save $258,077 (86%)
```

---

## 6. Where each number lives

Everything is in [`src/pricing.config.ts`](../src/pricing.config.ts):

| Concept | Config key |
|---|---|
| Tiers, included limits, population floors | `tiers[]`, `tierSelection` |
| Overage rates | `overage` |
| Estimation coefficients | `estimation` |
| Implementation fees | `implementation` |
| Recurring add-ons | `addons` |
| COGS (shared env, tenants/env, marginal, uplift, labor) | `cogs` |
| Margin floor | `guardrail.MIN_GROSS_MARGIN` |
| Competitor defaults | `competitor` |

The engine that applies them is [`src/lib/pricing.ts`](../src/lib/pricing.ts); the worked
examples and edge cases are locked in by [`src/lib/pricing.test.ts`](../src/lib/pricing.test.ts)
(22 tests, run with `npm test`).

---

## 7. What still needs your judgment

1. **Tenants-per-environment** (40 / 25 / 12) is the biggest driver of the margin view and is
   a placeholder — set it from real deployment density.
2. **Estimation coefficients**, especially `TX_PER_1000_CITIZENS=150`, are un-calibrated and
   look high for municipal procurement volume.
3. **Implementation isn't margin-checked** (§3 note above) — decide whether to add that.
4. **Population floor vs. messaging** — a ≥60,000 town is floored to Enterprise regardless of
   usage, which sits in tension with the "$0 per user" framing; confirm that's intended.
5. **Competitor defaults** ($85k / $45k) are illustrative — require a real, sourced figure
   before showing customer-facing savings.
6. **Margin floor = 60%** — confirm the target.
