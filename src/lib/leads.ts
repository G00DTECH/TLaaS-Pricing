/**
 * Lead capture — writes a lead document to Firestore (`leads` collection).
 *
 * Called only when a customer explicitly opts in ("Send me this estimate"),
 * so this is consented lead capture. No citizen PII is involved — inputs are
 * aggregate municipal metrics plus the submitter's own contact details.
 *
 * The stored shape must match the create-only Firestore rules in
 * `firestore.rules` (top-level keys: createdAt, contact, municipality, quote,
 * meta). Keep them in sync.
 */
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDb, firebaseEnabled } from "./firebase";
import type { QuoteInputs, Quote } from "./pricing";

export { firebaseEnabled };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function submitLead(inputs: QuoteInputs, quote: Quote): Promise<string> {
  const db = getDb();
  const ref = await addDoc(collection(db, "leads"), {
    createdAt: serverTimestamp(),
    contact: {
      name: (inputs.contactName ?? "").trim(),
      email: (inputs.contactEmail ?? "").trim(),
    },
    municipality: {
      name: (inputs.municipalityName ?? "").trim(),
      population: inputs.population,
      departments: inputs.departments,
      annualSolicitations: inputs.annualSolicitations,
    },
    quote: {
      tierId: quote.tier.id,
      tierLabel: quote.tier.label,
      yearOneTotal: round2(quote.yearOneTotal),
      recurringAnnual: round2(quote.recurringAnnual),
      threeYearTco: round2(quote.threeYearTco),
      costPerCitizenYear1: round2(quote.costPerCitizenYear1),
      oneTimeImplementation: round2(quote.oneTimeImplementation),
      annualSubscription: round2(quote.annualSubscription),
      projectedTxOverageYr: round2(quote.projectedTxOverageYr),
      projectedAnchorOverageYr: round2(quote.projectedAnchorOverageYr),
      recurringAddonsYr: round2(quote.recurringAddonsYr),
      estMonthlyTransactions: quote.estimation.monthlyTransactions,
      estMonthlyAnchors: quote.estimation.monthlyAnchors,
      competitorLabel: quote.competitor.label,
      competitorSavingsYear1: round2(quote.competitor.savingsYear1),
      competitorSavings3yr: round2(quote.competitor.savings3yr),
    },
    meta: {
      source: "tlaas-pricing-app",
      mode: "customer",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    },
  });
  return ref.id;
}
