import type { Quote } from "../lib/pricing";
import { PRICING_CONFIG as CFG } from "../pricing.config";
import { money, moneyAuto, num, pct } from "../lib/format";
import { generateQuotePdf } from "../lib/pdf";

function Metric({ label, value, sub, tone = "ink" }: { label: string; value: string; sub?: string; tone?: "ink" | "gold" | "sky" }) {
  const toneCls =
    tone === "gold"
      ? "bg-gold-300 text-gold-900 border-transparent"
      : tone === "sky"
        ? "bg-blue-200 text-blue-800 border-transparent"
        : "bg-blue-800 text-cream-50 border-transparent";
  return (
    <div className={`rounded-card border p-5 ${toneCls}`}>
      <p className="type-caption opacity-80">{label}</p>
      <p className="type-metric-md mt-2">{value}</p>
      {sub && <p className="type-body-sm mt-1 opacity-80">{sub}</p>}
    </div>
  );
}

function Row({ label, value, indent, strong, positive }: { label: string; value: string; indent?: boolean; strong?: boolean; positive?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${indent ? "pl-4" : ""}`}>
      <span className={`${strong ? "type-body-bold" : "type-body-sm"} ${indent ? "text-muted" : ""}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "type-body-bold" : "type-body-sm"} ${positive ? "text-green-600" : ""}`}>{value}</span>
    </div>
  );
}

export default function QuoteResults({ quote, mode }: { quote: Quote; mode: "customer" | "rep" }) {
  const q = quote;
  const c = q.competitor;
  const est = q.estimation;

  return (
    <div className="space-y-5">
      {/* Headline metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Year 1 total" value={money(q.yearOneTotal)} sub={`${q.tier.label}`} />
        <Metric label="Recurring / yr (yr 2+)" value={money(q.recurringAnnual)} tone="sky" />
        <Metric label="3-year total cost" value={money(q.threeYearTco)} tone="gold" />
      </div>

      {/* Cost per citizen + $0 per user banner */}
      <div className="card-raised p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="type-caption text-gold-600">Value framing</p>
            <p className="type-metric-sm mt-1">{moneyAuto(q.costPerCitizenYear1)}<span className="type-body-sm text-muted"> / citizen · year 1</span></p>
          </div>
          <div className="text-right">
            <p className="type-metric-sm text-green-600">$0</p>
            <p className="type-body-sm text-muted">per user, forever</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {CFG.copy.includedCallouts.map((line) => (
            <li key={line} className="flex items-start gap-2 type-body-sm">
              <span className="mt-0.5 text-green-600" aria-hidden>✓</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Breakdown */}
      <div className="card p-5 sm:p-6">
        <h3 className="type-h4 mb-3">Cost breakdown</h3>

        <p className="type-caption text-muted mb-1">One-time</p>
        <Row label="Implementation" value={money(q.oneTimeImplementation)} strong />
        {q.implementationBreakdown.map((b) => (
          <Row key={b.label} label={b.label} value={moneyAuto(b.amount)} indent />
        ))}

        <div className="my-3 border-t" />

        <p className="type-caption text-muted mb-1">Recurring (annual)</p>
        <Row label={`Subscription — ${q.tier.label}`} value={money(q.annualSubscription)} strong />
        {q.discountAmount > 0 && <Row label="Discount applied" value={`– ${money(q.discountAmount)}`} indent />}
        {q.projectedTxOverageYr > 0 && <Row label="Projected ingestion overage" value={moneyAuto(q.projectedTxOverageYr)} indent />}
        {q.projectedAnchorOverageYr > 0 && <Row label="Projected anchoring overage" value={moneyAuto(q.projectedAnchorOverageYr)} indent />}
        {q.recurringAddonsYr > 0 && <Row label="Recurring add-ons" value={money(q.recurringAddonsYr)} indent />}

        <div className="my-3 border-t border-gold-600" />
        <Row label="Year 1 total" value={money(q.yearOneTotal)} strong />

        <p className="mt-3 type-body-xs text-muted">
          Estimated usage: {num(est.monthlyTransactions)} transactions/mo · {num(est.monthlyAnchors)} anchors/mo
          {est.source === "direct" ? " (from known volume)" : " (estimated from municipal inputs)"}.
          {q.tierWasOverridden && ` Tier manually set (auto-selected: ${q.tierAutoSelected}).`}
        </p>
      </div>

      {/* Competitor comparison */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="type-h4">Savings vs. {c.label}</h3>
          <span className="pill-verified">{pct(c.savingsPct3yr)} less over 3 yrs</span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-control bg-surface-muted p-4">
            <p className="type-caption text-muted">Year 1</p>
            <Row label={c.label} value={money(c.competitorYear1)} />
            <Row label="CivicChain TLaaS" value={money(q.yearOneTotal)} />
            <div className="my-2 border-t" />
            <Row label="You save" value={`${money(c.savingsYear1)} · ${pct(c.savingsPctYear1)}`} strong positive={c.savingsYear1 > 0} />
          </div>
          <div className="rounded-control bg-surface-muted p-4">
            <p className="type-caption text-muted">3-year TCO</p>
            <Row label={c.label} value={money(c.competitor3yr)} />
            <Row label="CivicChain TLaaS" value={money(q.threeYearTco)} />
            <div className="my-2 border-t" />
            <Row label="You save" value={`${money(c.savings3yr)} · ${pct(c.savingsPct3yr)}`} strong positive={c.savings3yr > 0} />
          </div>
        </div>
        <p className="mt-3 type-body-xs text-muted">
          Structural wins a dollar figure misses: $0 per-user vs. per-seat scaling · unlimited citizen access included ·
          cryptographic tamper-proofing vs. a trust-us database · transparent consumption billing vs. opaque enterprise quotes.
        </p>
      </div>

      {/* Rep-only margin block */}
      {mode === "rep" && (
        <div className={`card p-5 sm:p-6 border-2 ${q.margin.meetsFloor ? "border-green-300" : "border-orange-300"}`}>
          <div className="flex items-center justify-between">
            <h3 className="type-h4">Internal — margin</h3>
            {q.margin.meetsFloor ? (
              <span className="pill-verified">Margin floor: PASS</span>
            ) : q.margin.subFloorOverrideUsed ? (
              <span className="pill-warn">Override logged</span>
            ) : (
              <span className="pill-risk">Below floor</span>
            )}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Row label="Est. annual COGS" value={money(q.margin.annualCogs)} />
              <Row label="Est. one-time impl. COGS" value={money(q.margin.oneTimeCogs)} />
            </div>
            <div>
              <Row label="Recurring gross margin" value={pct(q.margin.recurringMargin, 1)} strong />
              <Row label="Min recurring for floor" value={money(q.margin.minRecurringForFloor)} />
            </div>
          </div>
          {q.warnings.map((w) => (
            <p key={w} className="mt-3 rounded-control bg-orange-300 p-3 type-body-sm text-orange-900">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-gold" onClick={() => generateQuotePdf(q, mode)}>
          ⭳ Export {mode === "rep" ? "proposal" : "estimate"} PDF
        </button>
        <p className="type-body-xs text-muted flex-1 min-w-[240px]">{CFG.copy.disclaimer}</p>
      </div>
    </div>
  );
}
