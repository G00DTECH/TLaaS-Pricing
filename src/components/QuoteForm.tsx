import type { QuoteInputs } from "../lib/pricing";
import { PRICING_CONFIG as CFG } from "../pricing.config";
import { Field, NumberInput, TextInput, Select, Toggle } from "./ui";

type Patch = Partial<QuoteInputs>;

export type LeadStatus = "idle" | "sending" | "sent" | "error";

export interface LeadCapture {
  /** True when Firebase is configured; otherwise the send button is disabled. */
  enabled: boolean;
  status: LeadStatus;
  error?: string;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onSubmit: () => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function QuoteForm({
  inputs,
  onChange,
  mode,
  lead,
}: {
  inputs: QuoteInputs;
  onChange: (p: Patch) => void;
  mode: "customer" | "rep";
  lead?: LeadCapture;
}) {
  const set = (p: Patch) => onChange(p);
  const emailOk = EMAIL_RE.test((inputs.contactEmail ?? "").trim());
  const firstName = (inputs.contactName ?? "").trim().split(" ")[0];

  return (
    <div className="space-y-5">
      {/* ── Municipal inputs (both modes) ── */}
      <section className="card p-5 sm:p-6">
        <p className="type-caption text-gold-600 mb-1">Your municipality</p>
        <h3 className="type-h4 mb-4">Tell us about your town</h3>
        <div className="space-y-4">
          <Field label="Municipality name" htmlFor="muni">
            <TextInput id="muni" value={inputs.municipalityName ?? ""} onChange={(v) => set({ municipalityName: v })} placeholder="City of Springfield" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Population" htmlFor="pop" hint="Sizing & value only — never billed per citizen">
              <NumberInput id="pop" value={inputs.population} onChange={(v) => set({ population: v })} step={100} />
            </Field>
            <Field label="Departments / data sources" htmlFor="dept" hint="Drives data volume & integrations">
              <NumberInput id="dept" value={inputs.departments} onChange={(v) => set({ departments: v })} />
            </Field>
          </div>
          <Field label="Annual solicitations / RFPs to anchor on-chain" htmlFor="sol" hint="Primary cost driver — records anchored per year">
            <NumberInput id="sol" value={inputs.annualSolicitations} onChange={(v) => set({ annualSolicitations: v })} step={10} />
          </Field>
        </div>
      </section>

      {/* ── Lead capture (customer mode) ── */}
      {mode === "customer" && (
        <section className="card p-5 sm:p-6">
          <p className="type-caption text-gold-600 mb-1">Get your estimate</p>
          <h3 className="type-h4 mb-4">Where should we send it?</h3>
          <p className="type-body-sm text-muted mb-4">
            Your estimate is already shown live on the right — no email required to see it. Leave your
            details if you'd like a copy sent to you.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" htmlFor="cname">
              <TextInput id="cname" value={inputs.contactName ?? ""} onChange={(v) => set({ contactName: v })} placeholder="Jane Rivera" />
            </Field>
            <Field label="Work email" htmlFor="cemail">
              <TextInput id="cemail" type="email" value={inputs.contactEmail ?? ""} onChange={(v) => set({ contactEmail: v })} placeholder="jane@springfield.gov" />
            </Field>
          </div>

          {lead && lead.status === "sent" ? (
            <div className="mt-4 rounded-control bg-green-300 p-3 type-body-sm text-green-900">
              ✓ Thanks{firstName ? `, ${firstName}` : ""}! Your request is logged and we'll send the
              estimate to <strong>{(inputs.contactEmail ?? "").trim()}</strong>.
            </div>
          ) : (
            <>
              <label className="mt-4 flex cursor-pointer select-none items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border accent-gold-600"
                  checked={lead?.consent ?? false}
                  onChange={(e) => lead?.onConsent(e.target.checked)}
                />
                <span className="type-body-xs text-muted">
                  Email me this estimate and occasional CivicChain updates. We use your details only to
                  follow up — no citizen data is entered here, and you can opt out anytime.
                </span>
              </label>

              <button
                type="button"
                className="btn-gold mt-3 w-full sm:w-auto"
                disabled={!lead?.enabled || !emailOk || !lead?.consent || lead?.status === "sending"}
                onClick={() => lead?.onSubmit()}
              >
                {lead?.status === "sending" ? "Sending…" : "Send me this estimate"}
              </button>

              {lead && !lead.enabled && (
                <p className="mt-2 type-body-xs text-muted">
                  Estimate delivery activates once Firebase is configured (see README).
                </p>
              )}
              {lead?.status === "error" && (
                <p className="mt-2 type-body-xs text-rose-700">
                  Couldn't send just now{lead.error ? `: ${lead.error}` : ""}. Please try again.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Advanced / rep-only ── */}
      {mode === "rep" && (
        <>
          <section className="card p-5 sm:p-6">
            <p className="type-caption text-gold-600 mb-1">Rep controls</p>
            <h3 className="type-h4 mb-4">Volume, deployment & add-ons</h3>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Known monthly transactions" htmlFor="ktx" hint="If set, estimation is skipped">
                  <NumberInput id="ktx" value={inputs.knownMonthlyTransactions} onChange={(v) => set({ knownMonthlyTransactions: v })} step={1000} placeholder="—" />
                </Field>
                <Field label="Known monthly anchors" htmlFor="kan" hint="Optional; else derived from solicitations">
                  <NumberInput id="kan" value={inputs.knownMonthlyAnchors} onChange={(v) => set({ knownMonthlyAnchors: v })} placeholder="—" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Deployment" htmlFor="dep">
                  <Select
                    id="dep"
                    value={inputs.deployment ?? "standard"}
                    onChange={(v) => set({ deployment: v })}
                    options={[
                      { value: "standard", label: "Standard (shared)" },
                      { value: "dedicated_govcloud", label: "Dedicated / GovCloud" },
                    ]}
                  />
                </Field>
                <Field label="Support / SLA" htmlFor="sup">
                  <Select
                    id="sup"
                    value={inputs.support ?? "standard"}
                    onChange={(v) => set({ support: v })}
                    options={[
                      { value: "standard", label: "Standard" },
                      { value: "priority", label: `Priority (+${CFG.currency.symbol}${CFG.addons.prioritySupportAnnual.toLocaleString()}/yr)` },
                      { value: "gov_sla", label: `Gov SLA (+${CFG.currency.symbol}${CFG.addons.govSlaAnnual.toLocaleString()}/yr)` },
                    ]}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Extra integrations" htmlFor="int" hint="Defaults to # of departments">
                  <NumberInput id="int" value={inputs.extraIntegrations} onChange={(v) => set({ extraIntegrations: v })} placeholder="auto" />
                </Field>
                <Field label="Implementation complexity" htmlFor="cx">
                  <Select
                    id="cx"
                    value={inputs.implementationComplexity ?? "med"}
                    onChange={(v) => set({ implementationComplexity: v })}
                    options={[
                      { value: "low", label: "Low" },
                      { value: "med", label: "Medium" },
                      { value: "high", label: "High" },
                    ]}
                  />
                </Field>
              </div>
              <div className="rounded-control bg-surface-muted p-4 space-y-3">
                <Toggle checked={!!inputs.backfill} onChange={(v) => set({ backfill: v })} label="Historical backfill" />
                {inputs.backfill && (
                  <Field label="Records to backfill" htmlFor="bf">
                    <NumberInput id="bf" small value={inputs.backfillRecords} onChange={(v) => set({ backfillRecords: v })} step={1000} />
                  </Field>
                )}
              </div>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <p className="type-caption text-gold-600 mb-1">Tier & discount</p>
            <h3 className="type-h4 mb-4">Overrides (guardrail-checked)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Manual tier override" htmlFor="tier">
                <Select
                  id="tier"
                  value={(inputs.tierOverride ?? "auto") as string}
                  onChange={(v) => set({ tierOverride: v === "auto" ? null : (v as any) })}
                  options={[
                    { value: "auto", label: "Auto-select (recommended)" },
                    ...CFG.tiers.map((t) => ({ value: t.id, label: t.label })),
                  ]}
                />
              </Field>
              <Field label="Discount %" htmlFor="disc" hint="Applied to subscription, after floor check">
                <NumberInput id="disc" value={inputs.discountPct} onChange={(v) => set({ discountPct: v })} step={1} min={0} />
              </Field>
            </div>
            <div className="mt-4">
              <Toggle
                checked={!!inputs.allowSubFloorDiscount}
                onChange={(v) => set({ allowSubFloorDiscount: v })}
                label="Allow discount below margin floor (logged override)"
              />
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <p className="type-caption text-gold-600 mb-1">Competitor benchmark</p>
            <h3 className="type-h4 mb-2">{CFG.competitor.label}</h3>
            <p className="type-body-xs text-muted mb-4">
              Gov contracts are public record — pull the incumbent vendor's actual figures from another town's procurement records for a defensible comparison.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Competitor annual ($)" htmlFor="ca">
                <NumberInput id="ca" prefix="$" value={inputs.competitorAnnual ?? CFG.competitor.defaultAnnual} onChange={(v) => set({ competitorAnnual: v })} step={1000} />
              </Field>
              <Field label="Competitor implementation ($)" htmlFor="ci">
                <NumberInput id="ci" prefix="$" value={inputs.competitorImplementation ?? CFG.competitor.defaultImplementation} onChange={(v) => set({ competitorImplementation: v })} step={1000} />
              </Field>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
