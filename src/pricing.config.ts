/**
 * ─────────────────────────────────────────────────────────────────────────
 *  CivicChain TLaaS — SINGLE SOURCE OF TRUTH for all pricing constants.
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  ARCHITECTURAL RULE (from build spec §9.1):
 *  Treat pricing as DATA, not code. Non-engineers can tune every number in
 *  this file and the whole app updates with no code change. Do not move any
 *  of these constants into components or the engine.
 *
 *  Values marked  ⚑ CALIBRATE  are seed/placeholder guesses from the spec and
 *  MUST be replaced with real pilot/onboarding data before launch (spec §12).
 *
 *  v1 = TLaaS only. The shape is intentionally module-friendly so a second
 *  product (payments, card issuing, full CivicChain stack) can be added later
 *  as another entry without reworking the engine (spec §14).
 */

export type TierId = "startup" | "growth" | "enterprise";
export type DeploymentType = "standard" | "dedicated_govcloud";
export type SupportLevel = "standard" | "priority" | "gov_sla";

export interface Tier {
  id: TierId;
  /** Customer-facing label */
  label: string;
  /** Sub-label / target segment */
  target: string;
  /** Monthly base price ($) */
  base: number;
  /** Included data ingestion rows / month */
  includedTx: number;
  /** Included on-chain anchor writes / month (Infinity = unlimited) */
  includedAnchors: number;
  /**
   * Optional minimum population this tier is intended for. Used only if
   * tierSelection.usePopulationFloor is true, to stop a big town landing on
   * Startup purely because its known volume happens to be low.
   */
  minPopulation?: number;
}

export const PRICING_CONFIG = {
  /** Product identity — TLaaS. Future modules slot in alongside this. */
  product: {
    id: "tlaas",
    name: "TLaaS",
    longName: "Trustless Ledger as a Service",
    tagline: "A blockchain-backed open-data & citizen-portal platform with $0 per-user pricing.",
  },

  currency: { code: "USD", symbol: "$" },

  /** §3.1 Tiers */
  tiers: [
    {
      id: "startup",
      label: "Startup / Single Facility",
      target: "Small orgs, single site",
      base: 150,
      includedTx: 2_500,
      includedAnchors: 5,
      minPopulation: 0,
    },
    {
      id: "growth",
      label: "Growth / Public Utility",
      target: "Mid-size / regional utilities",
      base: 750,
      includedTx: 25_000,
      includedAnchors: 25,
      minPopulation: 15_000,
    },
    {
      id: "enterprise",
      label: "Enterprise / Municipality",
      target: "Cities, full municipalities",
      base: 2_500,
      includedTx: 150_000,
      includedAnchors: Infinity,
      minPopulation: 60_000,
    },
  ] as Tier[],

  /** §3.2 Overages */
  overage: {
    /** $ per 100 ingestion rows above included */
    txPer100Rows: 0.05,
    /** $ per anchor write above included */
    perAnchor: 0.1,
  },

  /** §6.1 Estimation coefficients — ⚑ CALIBRATE with pilot data (spec §12.1) */
  estimation: {
    TX_BASE_PER_DEPT: 400,
    TX_PER_1000_CITIZENS: 150,
    TX_PER_SOLICITATION: 8,
    ANCHORS_PER_SOLICITATION: 3,
    ANCHOR_BASELINE_PER_DEPT: 2,
  },

  /** §6.2 Tier selection behavior */
  tierSelection: {
    /** If true, a town's population can force a minimum tier (spec §12.3). */
    usePopulationFloor: true,
  },

  /** §4.2 / §7.1 One-time implementation — ⚑ CALIBRATE (spec §12.2) */
  implementation: {
    IMPL_BASE: 7_500, // base onboarding: Soroban contract deploy + config + training
    IMPL_PER_INTEGRATION: 1_200, // per data-source adapter
    BACKFILL_FEE_PER_1000: 40, // per 1,000 historical records
    DEDICATED_SETUP_FEE: 6_000, // dedicated / GovCloud stand-up
  },

  /** §5.2 Recurring add-ons ($/yr) — ⚑ CALIBRATE */
  addons: {
    prioritySupportAnnual: 4_800,
    govSlaAnnual: 12_000,
    dedicatedRpcAnnual: 3_600,
    /** GovCloud premium as a % uplift on subscription + infra */
    govcloudPremiumPct: 0.2,
  },

  /**
   * §4.1 Internal COGS — rep-mode margin view & guardrails.
   *
   * MULTI-TENANT MODEL: TLaaS is multi-tenant, so a tier's shared environment
   * cost is AMORTIZED across every tenant on it, plus a true marginal per-tenant
   * cost. Treating a whole environment as one tenant's COGS (the old model)
   * massively understates margin at scale and makes the margin floor fire on
   * nearly every quote. Per-tenant monthly infra is computed in the engine as:
   *
   *   shared deployment:  sharedEnvMonthly / tenantsPerEnvironment + marginalMonthly
   *   dedicated/GovCloud: (sharedEnvMonthly + marginalMonthly) × (1 + upliftPct)
   *     — single-tenant, so it bears the FULL unamortized environment.
   *
   * ⚑ CALIBRATE every value with real infrastructure + tenant-count data.
   */
  cogs: {
    /** Full monthly cost of a tier's shared environment (spec §4.1 midpoints) */
    sharedEnvMonthlyByTier: { startup: 100, growth: 400, enterprise: 750 } as Record<TierId, number>,
    /** Expected tenants sharing one environment — the amortization denominator */
    tenantsPerEnvironmentByTier: { startup: 40, growth: 25, enterprise: 12 } as Record<TierId, number>,
    /** True marginal per-tenant monthly cost (per-tenant storage, DB, support share) */
    marginalMonthlyByTier: { startup: 8, growth: 20, enterprise: 45 } as Record<TierId, number>,
    /** Dedicated / GovCloud (single-tenant) adds this % on top of the full env */
    dedicatedInfraUpliftPct: 0.2,
    /** Loaded blended hourly rate for implementation labor */
    loadedHourlyRate: 165,
    /** Onboarding hours by complexity (drives implementation COGS) */
    implementationHours: { low: 30, med: 60, high: 110 } as Record<"low" | "med" | "high", number>,
  },

  /** §4.3 Margin guardrail */
  guardrail: {
    /** Minimum acceptable gross margin on recurring revenue (0–1) */
    MIN_GROSS_MARGIN: 0.6,
  },

  /** §8 Competitor benchmark — configurable, editable per deal (spec §12.5) */
  competitor: {
    label: "Incumbent Data & Citizen Portal",
    /** ⚑ Populate from public procurement records per deal */
    defaultAnnual: 85_000,
    defaultImplementation: 45_000,
  },

  /** §7.2 / §9.3 Copy & framing */
  copy: {
    includedCallouts: [
      "Unlimited citizen & public viewer access — $0 per user, forever",
      "Unlimited internal staff seats — no per-seat scaling",
      "Cryptographic, tamper-proof on-chain audit trail",
      "Transparent consumption billing — no opaque enterprise quotes",
    ],
    disclaimer:
      "This is a non-binding estimate for planning purposes only, not a contract or offer. Final pricing is confirmed in the Statement of Work (SOW).",
  },
} as const;

export type PricingConfig = typeof PRICING_CONFIG;
