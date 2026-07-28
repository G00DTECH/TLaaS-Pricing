/**
 * TLaaS pricing engine — pure functions, no side effects, no DOM.
 * All tunable numbers come from pricing.config.ts (never hard-code here).
 *
 * Modeling principle (spec §2): population is a SIZING HEURISTIC and a
 * VALUE-FRAMING metric only. It never directly multiplies the price. The
 * directly-billed drivers are on-chain anchors (primary) and ingestion
 * transactions (secondary).
 */
import {
  PRICING_CONFIG as CFG,
  type Tier,
  type TierId,
  type DeploymentType,
  type SupportLevel,
} from "../pricing.config";

export interface QuoteInputs {
  // ── Customer-facing (spec §5.1) ──
  municipalityName?: string;
  population: number;
  annualSolicitations: number;
  departments: number;
  contactName?: string;
  contactEmail?: string;

  // ── Rep-only / advanced (spec §5.2) ──
  /** If provided, used directly and estimation is skipped. */
  knownMonthlyTransactions?: number;
  /** If provided alongside known tx, used directly for anchors. */
  knownMonthlyAnchors?: number;
  deployment?: DeploymentType;
  backfill?: boolean;
  backfillRecords?: number;
  extraIntegrations?: number;
  support?: SupportLevel;
  /** Force a specific tier (rep override wins over auto-selection). */
  tierOverride?: TierId | null;
  /** Discount % applied to subscription (0–100). */
  discountPct?: number;
  /** Rep-acknowledged override to push a discount below the margin floor. */
  allowSubFloorDiscount?: boolean;
  implementationComplexity?: "low" | "med" | "high";

  // ── Competitor benchmark (spec §8) ──
  competitorAnnual?: number;
  competitorImplementation?: number;
}

export interface Estimation {
  monthlyTransactions: number;
  monthlyAnchors: number;
  /** "direct" when rep supplied known volume, else "estimated". */
  source: "direct" | "estimated";
}

export interface MarginView {
  annualCogs: number;
  oneTimeCogs: number;
  /** Gross margin on recurring revenue (0–1). */
  recurringMargin: number;
  /** Minimum price that satisfies the margin floor for recurring revenue. */
  minRecurringForFloor: number;
  meetsFloor: boolean;
  /** True when a rep discount pushed recurring revenue below the floor. */
  subFloorOverrideUsed: boolean;
}

export interface CompetitorView {
  label: string;
  annual: number;
  implementation: number;
  competitorYear1: number;
  competitor3yr: number;
  savingsYear1: number;
  savings3yr: number;
  savingsPctYear1: number;
  savingsPct3yr: number;
}

export interface Quote {
  inputs: QuoteInputs;
  estimation: Estimation;
  tier: Tier;
  tierAutoSelected: TierId;
  tierWasOverridden: boolean;

  // Recurring (annual)
  annualSubscription: number;
  discountAmount: number;
  annualSubscriptionAfterDiscount: number;
  projectedTxOverageYr: number;
  projectedAnchorOverageYr: number;
  recurringAddonsYr: number;
  recurringAnnual: number; // year 2+

  // One-time
  oneTimeImplementation: number;
  implementationBreakdown: { label: string; amount: number }[];

  // Totals
  yearOneTotal: number;
  threeYearTco: number;
  costPerCitizenYear1: number;

  margin: MarginView;
  competitor: CompetitorView;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Estimation (spec §6)
// ─────────────────────────────────────────────────────────────────────────

export function estimateVolume(inputs: QuoteInputs): Estimation {
  const { population, annualSolicitations, departments } = inputs;

  // Direct path — rep supplied known volume.
  if (inputs.knownMonthlyTransactions != null && inputs.knownMonthlyTransactions >= 0) {
    const e = CFG.estimation;
    // Anchors: use known if given, else derive from solicitations/depts.
    const monthlyAnchors =
      inputs.knownMonthlyAnchors != null && inputs.knownMonthlyAnchors >= 0
        ? inputs.knownMonthlyAnchors
        : e.ANCHORS_PER_SOLICITATION * (annualSolicitations / 12) +
          e.ANCHOR_BASELINE_PER_DEPT * departments;
    return {
      monthlyTransactions: inputs.knownMonthlyTransactions,
      monthlyAnchors: Math.round(monthlyAnchors),
      source: "direct",
    };
  }

  // Estimated path (spec §6.1).
  const e = CFG.estimation;
  const monthlyTransactions =
    e.TX_BASE_PER_DEPT * departments +
    e.TX_PER_1000_CITIZENS * (population / 1000) +
    e.TX_PER_SOLICITATION * (annualSolicitations / 12);

  const monthlyAnchors =
    e.ANCHORS_PER_SOLICITATION * (annualSolicitations / 12) +
    e.ANCHOR_BASELINE_PER_DEPT * departments;

  return {
    monthlyTransactions: Math.round(monthlyTransactions),
    monthlyAnchors: Math.round(monthlyAnchors),
    source: "estimated",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Overage (spec §7.1) — shared by tier selection and the final quote.
// ─────────────────────────────────────────────────────────────────────────

export function overageForTier(tier: Tier, est: Estimation): { txOverageYr: number; anchorOverageYr: number } {
  const txOverUnits = Math.max(0, est.monthlyTransactions - tier.includedTx);
  const txOverageYr = (txOverUnits * 12 / 100) * CFG.overage.txPer100Rows;

  const anchorOverUnits =
    tier.includedAnchors === Infinity ? 0 : Math.max(0, est.monthlyAnchors - tier.includedAnchors);
  const anchorOverageYr = anchorOverUnits * 12 * CFG.overage.perAnchor;

  return { txOverageYr, anchorOverageYr };
}

/** Annual base + projected overage for a tier — the customer's cost on it. */
function annualCostOnTier(tier: Tier, est: Estimation): number {
  const o = overageForTier(tier, est);
  return tier.base * 12 + o.txOverageYr + o.anchorOverageYr;
}

// ─────────────────────────────────────────────────────────────────────────
// Tier selection (spec §6.2)
// ─────────────────────────────────────────────────────────────────────────
//
// SOFT CAP: a customer stays on their tier and pays overage for usage above
// the included allowance. We do NOT force-upgrade the moment a limit is
// exceeded (the old behavior created price cliffs — e.g. one transaction over
// Growth jumped the quote from ~$9k to $30k — and made the overage config dead
// code). Instead we pick, from the tiers at or above the population floor, the
// one that costs the CUSTOMER the least (base + projected overage). A higher
// tier only wins when its flat rate genuinely beats the lower tier + overage,
// so customers are never overcharged and overage actually fires.

export function selectTier(est: Estimation, inputs: QuoteInputs): { auto: Tier; chosen: Tier } {
  const tiers = CFG.tiers;

  // Population floor (spec §12.3): the customer's scale sets the MINIMUM tier so
  // a large municipality is never sold a tiny plan (segmentation guardrail).
  let floorIdx = 0;
  if (CFG.tierSelection.usePopulationFloor) {
    for (let i = tiers.length - 1; i >= 0; i--) {
      const mp = tiers[i].minPopulation ?? 0;
      if (mp > 0 && inputs.population >= mp) {
        floorIdx = i;
        break;
      }
    }
  }

  // Cheapest tier at or above the floor.
  const candidates = tiers.slice(floorIdx);
  let auto = candidates[0];
  let bestCost = Infinity;
  for (const t of candidates) {
    const cost = annualCostOnTier(t, est);
    if (cost < bestCost) {
      bestCost = cost;
      auto = t;
    }
  }

  const chosen =
    inputs.tierOverride != null
      ? tiers.find((t) => t.id === inputs.tierOverride) ?? auto
      : auto;

  return { auto, chosen };
}

// ─────────────────────────────────────────────────────────────────────────
// Full quote (spec §7)
// ─────────────────────────────────────────────────────────────────────────

export function computeQuote(inputs: QuoteInputs): Quote {
  const warnings: string[] = [];
  const est = estimateVolume(inputs);
  const { auto, chosen: tier } = selectTier(est, inputs);
  const isDedicated = inputs.deployment === "dedicated_govcloud";

  // ── Recurring subscription & overages ──
  const annualSubscription = tier.base * 12;
  const { txOverageYr: projectedTxOverageYr, anchorOverageYr: projectedAnchorOverageYr } =
    overageForTier(tier, est);

  // ── Recurring add-ons ──
  let recurringAddonsYr = 0;
  if (inputs.support === "priority") recurringAddonsYr += CFG.addons.prioritySupportAnnual;
  if (inputs.support === "gov_sla") recurringAddonsYr += CFG.addons.govSlaAnnual;
  if (isDedicated) recurringAddonsYr += CFG.addons.dedicatedRpcAnnual;

  // GovCloud premium: % uplift on subscription (before discount).
  const govcloudPremium = isDedicated ? annualSubscription * CFG.addons.govcloudPremiumPct : 0;
  recurringAddonsYr += govcloudPremium;

  // ── Discount (rep mode) — applied to subscription, guardrail-checked below ──
  const discountPct = Math.min(100, Math.max(0, inputs.discountPct ?? 0));
  const discountAmount = annualSubscription * (discountPct / 100);
  const annualSubscriptionAfterDiscount = annualSubscription - discountAmount;

  const recurringAnnual =
    annualSubscriptionAfterDiscount +
    projectedTxOverageYr +
    projectedAnchorOverageYr +
    recurringAddonsYr;

  // ── One-time implementation (spec §7.1) ──
  const impl = CFG.implementation;
  const integrations = inputs.extraIntegrations != null ? inputs.extraIntegrations : inputs.departments;
  const implPerIntegration = impl.IMPL_PER_INTEGRATION * Math.max(0, integrations);
  const backfillFee =
    inputs.backfill && inputs.backfillRecords
      ? (inputs.backfillRecords / 1000) * impl.BACKFILL_FEE_PER_1000
      : 0;
  const dedicatedSetup = isDedicated ? impl.DEDICATED_SETUP_FEE : 0;

  const implementationBreakdown = [
    { label: "Base onboarding", amount: impl.IMPL_BASE },
    { label: `Data-source integrations (${Math.max(0, integrations)})`, amount: implPerIntegration },
    ...(backfillFee > 0
      ? [{ label: `Historical backfill (${inputs.backfillRecords!.toLocaleString()} records)`, amount: backfillFee }]
      : []),
    ...(dedicatedSetup > 0 ? [{ label: "Dedicated / GovCloud stand-up", amount: dedicatedSetup }] : []),
  ];
  const oneTimeImplementation = implementationBreakdown.reduce((s, i) => s + i.amount, 0);

  // ── Totals ──
  const yearOneTotal = oneTimeImplementation + recurringAnnual;
  const threeYearTco = yearOneTotal + 2 * recurringAnnual;
  const costPerCitizenYear1 = inputs.population > 0 ? yearOneTotal / inputs.population : 0;

  // ── Margin view & guardrail (spec §4) ──
  const margin = computeMargin({
    tier,
    isDedicated,
    recurringAnnual,
    implementationComplexity: inputs.implementationComplexity ?? complexityFromDepartments(integrations),
    projectedTxOverageYr,
    projectedAnchorOverageYr,
    recurringAddonsYr,
    allowSubFloorDiscount: inputs.allowSubFloorDiscount ?? false,
  });

  if (!margin.meetsFloor) {
    if (margin.subFloorOverrideUsed) {
      warnings.push(
        `Discount pushes recurring gross margin to ${(margin.recurringMargin * 100).toFixed(1)}%, below the ${(CFG.guardrail.MIN_GROSS_MARGIN * 100).toFixed(0)}% floor. Override logged.`,
      );
    } else {
      warnings.push(
        `Recurring gross margin ${(margin.recurringMargin * 100).toFixed(1)}% is below the ${(CFG.guardrail.MIN_GROSS_MARGIN * 100).toFixed(0)}% floor. Reduce the discount or enable the override.`,
      );
    }
  }

  // ── Competitor comparison (spec §8) ──
  const competitor = computeCompetitor({
    inputs,
    yearOneTotal,
    threeYearTco,
  });

  return {
    inputs,
    estimation: est,
    tier,
    tierAutoSelected: auto.id,
    tierWasOverridden: inputs.tierOverride != null && inputs.tierOverride !== auto.id,
    annualSubscription,
    discountAmount,
    annualSubscriptionAfterDiscount,
    projectedTxOverageYr,
    projectedAnchorOverageYr,
    recurringAddonsYr,
    recurringAnnual,
    oneTimeImplementation,
    implementationBreakdown,
    yearOneTotal,
    threeYearTco,
    costPerCitizenYear1,
    margin,
    competitor,
    warnings,
  };
}

function complexityFromDepartments(depts: number): "low" | "med" | "high" {
  if (depts <= 2) return "low";
  if (depts <= 6) return "med";
  return "high";
}

/**
 * Per-tenant monthly infra COGS under the multi-tenant model (spec §4.1).
 * Shared deployments amortize the environment across tenants and add a marginal
 * per-tenant cost; dedicated/GovCloud is single-tenant so it bears the full
 * environment plus the dedicated uplift.
 */
export function perTenantInfraMonthly(tierId: TierId, isDedicated: boolean): number {
  const c = CFG.cogs;
  const shared = c.sharedEnvMonthlyByTier[tierId];
  const marginal = c.marginalMonthlyByTier[tierId];
  if (isDedicated) return (shared + marginal) * (1 + c.dedicatedInfraUpliftPct);
  const tenants = Math.max(1, c.tenantsPerEnvironmentByTier[tierId]);
  return shared / tenants + marginal;
}

function computeMargin(args: {
  tier: Tier;
  isDedicated: boolean;
  recurringAnnual: number;
  implementationComplexity: "low" | "med" | "high";
  projectedTxOverageYr: number;
  projectedAnchorOverageYr: number;
  recurringAddonsYr: number;
  allowSubFloorDiscount: boolean;
}): MarginView {
  const c = CFG.cogs;
  const infraMonthly = perTenantInfraMonthly(args.tier.id, args.isDedicated);
  const annualCogs = infraMonthly * 12;

  const oneTimeCogs = c.loadedHourlyRate * c.implementationHours[args.implementationComplexity];

  const recurringRevenue = args.recurringAnnual;
  const recurringMargin =
    recurringRevenue > 0 ? (recurringRevenue - annualCogs) / recurringRevenue : 0;

  const floor = CFG.guardrail.MIN_GROSS_MARGIN;
  // price >= COGS / (1 - margin)
  const minRecurringForFloor = annualCogs / (1 - floor);
  const meetsFloor = recurringRevenue >= minRecurringForFloor - 0.005;

  return {
    annualCogs,
    oneTimeCogs,
    recurringMargin,
    minRecurringForFloor,
    meetsFloor,
    subFloorOverrideUsed: !meetsFloor && args.allowSubFloorDiscount,
  };
}

function computeCompetitor(args: {
  inputs: QuoteInputs;
  yearOneTotal: number;
  threeYearTco: number;
}): CompetitorView {
  const annual = args.inputs.competitorAnnual ?? CFG.competitor.defaultAnnual;
  const implementation = args.inputs.competitorImplementation ?? CFG.competitor.defaultImplementation;

  const competitorYear1 = annual + implementation;
  const competitor3yr = implementation + annual * 3;

  const savingsYear1 = competitorYear1 - args.yearOneTotal;
  const savings3yr = competitor3yr - args.threeYearTco;

  return {
    label: CFG.competitor.label,
    annual,
    implementation,
    competitorYear1,
    competitor3yr,
    savingsYear1,
    savings3yr,
    savingsPctYear1: competitorYear1 > 0 ? savingsYear1 / competitorYear1 : 0,
    savingsPct3yr: competitor3yr > 0 ? savings3yr / competitor3yr : 0,
  };
}
