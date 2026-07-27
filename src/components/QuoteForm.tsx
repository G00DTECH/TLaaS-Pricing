import type { QuoteInputs } from "../lib/pricing";
import { PRICING_CONFIG as CFG } from "../pricing.config";
import { Field, NumberInput, TextInput, Select, Toggle } from "./ui";

type Patch = Partial<QuoteInputs>;

export default function QuoteForm({
  inputs,
  onChange,
  mode,
}: {
  inputs: QuoteInputs;
  onChange: (p: Patch) => void;
  mode: "customer" | "rep";
}) {
  const set = (p: Patch) => onChange(p);

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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" htmlFor="cname">
              <TextInput id="cname" value={inputs.contactName ?? ""} onChange={(v) => set({ contactName: v })} placeholder="Jane Rivera" />
            </Field>
            <Field label="Work email" htmlFor="cemail">
              <TextInput id="cemail" type="email" value={inputs.contactEmail ?? ""} onChange={(v) => set({ contactEmail: v })} placeholder="jane@springfield.gov" />
            </Field>
          </div>
          <p className="mt-2 type-body-xs text-muted">We only use this to send your estimate. No citizen data is ever entered here.</p>
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
