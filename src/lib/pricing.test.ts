import { describe, it, expect } from "vitest";
import { computeQuote, estimateVolume, selectTier, overageForTier, perTenantInfraMonthly } from "./pricing";
import { PRICING_CONFIG as CFG } from "../pricing.config";
import type { QuoteInputs } from "./pricing";

const base: QuoteInputs = {
  population: 5000,
  annualSolicitations: 120,
  departments: 4,
};

describe("Modeling principle: population never directly multiplies price (spec §2)", () => {
  it("doubling population does not roughly double the total", () => {
    const q1 = computeQuote({ ...base });
    const q2 = computeQuote({ ...base, population: 10_000 });
    // Some drift is fine (population feeds the tx heuristic), but the total
    // must NOT scale ~linearly with population the way a per-seat model would.
    const ratio = q2.yearOneTotal / q1.yearOneTotal;
    expect(ratio).toBeLessThan(1.3);
  });
});

describe("Worked Example A — small town (spec §11)", () => {
  const est = estimateVolume(base);

  it("estimates ~38 anchors/mo", () => {
    // 3*(120/12) + 2*4 = 30 + 8 = 38
    expect(est.monthlyAnchors).toBe(38);
  });

  it("estimates ~2,430 transactions/mo", () => {
    // 400*4 + 150*5 + 8*(120/12) = 1600 + 750 + 80 = 2430
    expect(est.monthlyTransactions).toBe(2430);
  });

  it("keeps the small town on Startup and bills anchor overage (soft cap, not force-upgrade)", () => {
    // 38 anchors/mo exceeds Startup's 5, but staying on Startup + overage
    // (~$1,840/yr) is far cheaper for the town than an upgrade, so it stays.
    const { chosen } = selectTier(est, base);
    expect(chosen.id).toBe("startup");
    const q = computeQuote(base);
    expect(q.projectedAnchorOverageYr).toBeGreaterThan(0);
  });

  it("produces a coherent quote with all outputs rendered", () => {
    const q = computeQuote(base);
    expect(q.yearOneTotal).toBeGreaterThan(0);
    expect(q.threeYearTco).toBeGreaterThan(q.yearOneTotal);
    expect(q.costPerCitizenYear1).toBeCloseTo(q.yearOneTotal / 5000, 4);
    expect(q.threeYearTco).toBeCloseTo(q.yearOneTotal + 2 * q.recurringAnnual, 2);
  });
});

describe("Worked Example B — rep supplies known volume (spec §11)", () => {
  const repInputs: QuoteInputs = {
    ...base,
    population: 40_000,
    knownMonthlyTransactions: 60_000,
    knownMonthlyAnchors: 40,
    deployment: "standard",
    support: "priority",
    discountPct: 10,
  };

  it("skips estimation and uses the known volume directly", () => {
    const q = computeQuote(repInputs);
    expect(q.estimation.source).toBe("direct");
    expect(q.estimation.monthlyTransactions).toBe(60_000);
    expect(q.estimation.monthlyAnchors).toBe(40);
  });

  it("lands on Growth + overage, not force-upgraded to Enterprise (60k tx)", () => {
    // 60k tx > Growth's 25k included, but Growth + overage (~$11.1k) beats
    // Enterprise's flat $30k, so the soft cap keeps the customer on Growth.
    const q = computeQuote(repInputs);
    expect(q.tier.id).toBe("growth");
    expect(q.projectedTxOverageYr).toBeGreaterThan(0);
  });

  it("applies the 10% discount to subscription only", () => {
    const q = computeQuote(repInputs);
    const expectedDiscount = q.annualSubscription * 0.1;
    expect(q.discountAmount).toBeCloseTo(expectedDiscount, 2);
    expect(q.annualSubscriptionAfterDiscount).toBeCloseTo(q.annualSubscription - expectedDiscount, 2);
  });

  it("exposes a margin view for the rep", () => {
    const q = computeQuote(repInputs);
    expect(q.margin.annualCogs).toBeGreaterThan(0);
    expect(q.margin.recurringMargin).toBeGreaterThan(0);
    expect(typeof q.margin.meetsFloor).toBe("boolean");
  });
});

describe("Overage math (spec §7.1)", () => {
  it("charges $0.05 per 100 rows over the included tx allowance", () => {
    // Force Startup (2,500 included) with a known volume just above it.
    const q = computeQuote({
      ...base,
      population: 1000,
      knownMonthlyTransactions: 2600, // 100 rows over
      knownMonthlyAnchors: 0,
      tierOverride: "startup",
    });
    // 100 rows/mo over * 12 / 100 * 0.05 = $0.60/yr
    expect(q.projectedTxOverageYr).toBeCloseTo(0.6, 4);
  });

  it("charges $0.10 per anchor over the included allowance", () => {
    const q = computeQuote({
      ...base,
      population: 1000,
      knownMonthlyTransactions: 1000,
      knownMonthlyAnchors: 15, // 10 over Startup's 5
      tierOverride: "startup",
    });
    // 10 anchors/mo over * 12 * 0.10 = $12/yr
    expect(q.projectedAnchorOverageYr).toBeCloseTo(12, 4);
  });

  it("never charges anchor overage on Enterprise (unlimited anchors)", () => {
    const q = computeQuote({
      ...base,
      knownMonthlyTransactions: 200_000,
      knownMonthlyAnchors: 5000,
      tierOverride: "enterprise",
    });
    expect(q.projectedAnchorOverageYr).toBe(0);
  });
});

describe("Margin guardrail (spec §4.3)", () => {
  it("flags a warning when a deep discount breaches the floor", () => {
    const q = computeQuote({
      ...base,
      population: 1000,
      tierOverride: "startup",
      discountPct: 90,
    });
    expect(q.margin.meetsFloor).toBe(false);
    expect(q.warnings.length).toBeGreaterThan(0);
  });

  it("marks the override as used when the rep acknowledges the sub-floor discount", () => {
    const q = computeQuote({
      ...base,
      population: 1000,
      tierOverride: "startup",
      discountPct: 90,
      allowSubFloorDiscount: true,
    });
    expect(q.margin.subFloorOverrideUsed).toBe(true);
  });

  it("min recurring for floor equals COGS / (1 - floor)", () => {
    const q = computeQuote({ ...base, tierOverride: "growth" });
    const infra = perTenantInfraMonthly("growth", false) * 12;
    expect(q.margin.minRecurringForFloor).toBeCloseTo(infra / (1 - CFG.guardrail.MIN_GROSS_MARGIN), 2);
  });
});

describe("Tier selection: soft cap with cost-minimizing upgrade (spec §6.2, fixed)", () => {
  it("upgrades to Enterprise only when overage would exceed its flat rate", () => {
    // Growth-floor town whose anchor burst makes Growth + overage cost more
    // than Enterprise's flat $30k → Enterprise becomes the cheaper choice.
    const q = computeQuote({
      population: 30_000, // Growth floor
      annualSolicitations: 0,
      departments: 1,
      knownMonthlyTransactions: 1000,
      knownMonthlyAnchors: 30_000, // huge anchor volume
    });
    expect(q.tier.id).toBe("enterprise");
  });

  it("never overcharges: chosen tier is the cheapest at or above the population floor", () => {
    const inputs = {
      population: 30_000,
      annualSolicitations: 300,
      departments: 5,
      knownMonthlyTransactions: 40_000,
      knownMonthlyAnchors: 30,
    };
    const q = computeQuote(inputs);
    // Tiers at or above the population floor (same rule the engine applies).
    let floorIdx = 0;
    for (let i = CFG.tiers.length - 1; i >= 0; i--) {
      const mp = CFG.tiers[i].minPopulation ?? 0;
      if (mp > 0 && inputs.population >= mp) {
        floorIdx = i;
        break;
      }
    }
    const eligible = CFG.tiers.slice(floorIdx);
    const cheapest = Math.min(
      ...eligible.map((t) => {
        const o = overageForTier(t, q.estimation);
        return t.base * 12 + o.txOverageYr + o.anchorOverageYr;
      }),
    );
    const chosenCost = q.annualSubscription + q.projectedTxOverageYr + q.projectedAnchorOverageYr;
    expect(chosenCost).toBeCloseTo(cheapest, 2);
  });

  it("no longer produces a price cliff one unit over a tier limit", () => {
    const atLimit = computeQuote({ population: 20_000, annualSolicitations: 0, departments: 1, knownMonthlyTransactions: 25_000, knownMonthlyAnchors: 0 });
    const overLimit = computeQuote({ population: 20_000, annualSolicitations: 0, departments: 1, knownMonthlyTransactions: 25_100, knownMonthlyAnchors: 0 });
    // Same tier, only a few cents of overage apart — not a 3× jump.
    expect(overLimit.tier.id).toBe(atLimit.tier.id);
    expect(overLimit.recurringAnnual - atLimit.recurringAnnual).toBeLessThan(1);
  });
});

describe("Multi-tenant COGS model (spec §4.1, fixed)", () => {
  it("shared per-tenant infra is a fraction of the full environment cost", () => {
    const perTenant = perTenantInfraMonthly("growth", false);
    expect(perTenant).toBeLessThan(CFG.cogs.sharedEnvMonthlyByTier.growth);
  });

  it("dedicated (single-tenant) bears the full unamortized environment + uplift", () => {
    const shared = perTenantInfraMonthly("growth", false);
    const dedicated = perTenantInfraMonthly("growth", true);
    expect(dedicated).toBeGreaterThan(shared * 3);
  });

  it("every tier clears the 60% margin floor at full list price", () => {
    for (const t of CFG.tiers) {
      const q = computeQuote({ ...base, population: 1000, tierOverride: t.id, discountPct: 0 });
      expect(q.margin.meetsFloor).toBe(true);
      expect(q.margin.recurringMargin).toBeGreaterThanOrEqual(CFG.guardrail.MIN_GROSS_MARGIN);
    }
  });
});

describe("Competitor savings (spec §8)", () => {
  it("computes $ and % saved vs. the configured benchmark", () => {
    const q = computeQuote({ ...base, competitorAnnual: 85_000, competitorImplementation: 45_000 });
    expect(q.competitor.competitorYear1).toBe(130_000);
    expect(q.competitor.competitor3yr).toBe(45_000 + 85_000 * 3);
    expect(q.competitor.savingsYear1).toBeCloseTo(130_000 - q.yearOneTotal, 2);
    expect(q.competitor.savingsPct3yr).toBeGreaterThan(0);
  });
});
