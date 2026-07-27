/**
 * Branded PDF quote/proposal export (spec §7.2, §9.1).
 * Uses jsPDF (client-side, no server). Colors approximate the CivicChain
 * OKLCH palette in sRGB since jsPDF works in RGB.
 */
import { jsPDF } from "jspdf";
import type { Quote } from "./pricing";
import { PRICING_CONFIG as CFG } from "../pricing.config";
import { money, moneyAuto, num, pct } from "./format";

// sRGB approximations of the brand OKLCH tokens.
const INK: [number, number, number] = [26, 24, 56]; // blue-900
const INK_MID: [number, number, number] = [58, 52, 110]; // blue-700
const GOLD: [number, number, number] = [176, 137, 46]; // gold-600
const CREAM: [number, number, number] = [250, 249, 244]; // cream-50
const SLATE: [number, number, number] = [110, 104, 128]; // slate-700
const GREEN: [number, number, number] = [46, 110, 74]; // green-600
const LINE: [number, number, number] = [219, 214, 230];

export function generateQuotePdf(q: Quote, mode: "customer" | "rep") {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 48; // margin
  let y = 0;

  const town = q.inputs.municipalityName?.trim() || "Your Municipality";

  // ── Header band ──
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageW, 96, "F");
  doc.setTextColor(...CREAM);
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.text("CivicChain", M, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(`${CFG.product.name} — ${CFG.product.longName}`, M, 64);
  doc.setTextColor(...CREAM);
  doc.setFontSize(9);
  doc.text("Estimated annual cost — non-binding", pageW - M, 46, { align: "right" });
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), pageW - M, 60, { align: "right" });

  y = 128;

  // ── Prepared-for ──
  doc.setTextColor(...SLATE);
  doc.setFontSize(8);
  doc.text("PREPARED FOR", M, y);
  doc.setTextColor(...INK);
  doc.setFont("times", "normal");
  doc.setFontSize(20);
  doc.text(town, M, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  const meta = [`Population ${num(q.inputs.population)}`, `${q.inputs.departments} departments`, `${num(q.inputs.annualSolicitations)} solicitations/yr`].join("   •   ");
  doc.text(meta, M, y + 38);
  y += 66;

  // ── Headline metrics ──
  const cardW = (pageW - M * 2 - 24) / 3;
  const metrics: [string, string][] = [
    ["Year 1 total", money(q.yearOneTotal)],
    ["Recurring / yr (yr 2+)", money(q.recurringAnnual)],
    ["3-year total cost", money(q.threeYearTco)],
  ];
  metrics.forEach(([label, val], i) => {
    const x = M + i * (cardW + 12);
    doc.setFillColor(...CREAM);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, cardW, 68, 8, 8, "FD");
    doc.setTextColor(...SLATE);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 12, y + 20);
    doc.setTextColor(...INK);
    doc.setFont("times", "normal");
    doc.setFontSize(20);
    doc.text(val, x + 12, y + 48);
    doc.setFont("helvetica", "normal");
  });
  y += 92;

  // ── Selected plan + cost per citizen ──
  doc.setTextColor(...INK_MID);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Recommended plan: ${q.tier.label}`, M, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE);
  doc.setFontSize(9);
  doc.text(`Cost per citizen (year 1): ${moneyAuto(q.costPerCitizenYear1)}`, M, y + 15);
  y += 40;

  // ── Line-item breakdown ──
  y = sectionTitle(doc, "Cost breakdown", M, y);
  const rows: [string, string][] = [
    ["One-time implementation", money(q.oneTimeImplementation)],
    ...q.implementationBreakdown.map((b) => [`    ${b.label}`, moneyAuto(b.amount)] as [string, string]),
    ["Annual subscription — " + q.tier.label, money(q.annualSubscription)],
  ];
  if (q.discountAmount > 0) rows.push([`Discount applied`, `– ${money(q.discountAmount)}`]);
  if (q.projectedTxOverageYr > 0) rows.push(["Projected ingestion overage / yr", moneyAuto(q.projectedTxOverageYr)]);
  if (q.projectedAnchorOverageYr > 0) rows.push(["Projected anchoring overage / yr", moneyAuto(q.projectedAnchorOverageYr)]);
  if (q.recurringAddonsYr > 0) rows.push(["Recurring add-ons / yr", money(q.recurringAddonsYr)]);
  y = table(doc, rows, M, y, pageW);

  // total row
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(M, y, pageW - M, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.setFontSize(11);
  doc.text("Year 1 total", M, y);
  doc.text(money(q.yearOneTotal), pageW - M, y, { align: "right" });
  y += 28;

  // ── Included at no charge ──
  y = sectionTitle(doc, "Included at no charge", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK_MID);
  CFG.copy.includedCallouts.forEach((c) => {
    doc.setTextColor(...GREEN);
    doc.text("✓", M, y);
    doc.setTextColor(...INK_MID);
    doc.text(c, M + 16, y);
    y += 16;
  });
  y += 12;

  // ── Competitor comparison ──
  const c = q.competitor;
  y = sectionTitle(doc, `Savings vs. ${c.label}`, M, y);
  const compRows: [string, string][] = [
    [`${c.label} — year 1`, money(c.competitorYear1)],
    [`CivicChain TLaaS — year 1`, money(q.yearOneTotal)],
    [`You save (year 1)`, `${money(c.savingsYear1)}  (${pct(c.savingsPctYear1)})`],
    [`${c.label} — 3-year`, money(c.competitor3yr)],
    [`CivicChain TLaaS — 3-year`, money(q.threeYearTco)],
    [`You save (3-year)`, `${money(c.savings3yr)}  (${pct(c.savingsPct3yr)})`],
  ];
  y = table(doc, compRows, M, y, pageW, [2, 5]);

  // ── Rep-only margin block ──
  if (mode === "rep") {
    y += 8;
    y = sectionTitle(doc, "Internal — margin (rep only)", M, y);
    const m = q.margin;
    const repRows: [string, string][] = [
      ["Est. annual COGS", money(m.annualCogs)],
      ["Est. one-time implementation COGS", money(m.oneTimeCogs)],
      ["Recurring gross margin", pct(m.recurringMargin, 1)],
      ["Margin-floor status", m.meetsFloor ? "PASS" : m.subFloorOverrideUsed ? "OVERRIDE (logged)" : "BELOW FLOOR"],
    ];
    y = table(doc, repRows, M, y, pageW);
  }

  // ── Disclaimer footer ──
  const footY = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(M, footY - 12, pageW - M, footY - 12);
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  const disc = doc.splitTextToSize(CFG.copy.disclaimer, pageW - M * 2);
  doc.text(disc, M, footY);

  const safe = town.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`civicchain-tlaas-quote-${safe}.pdf`);
}

function sectionTitle(doc: jsPDF, title: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(title.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal");
  return y + 18;
}

function table(
  doc: jsPDF,
  rows: [string, string][],
  x: number,
  y: number,
  pageW: number,
  boldRows: number[] = [],
): number {
  const M = x;
  doc.setFontSize(9.5);
  rows.forEach((r, i) => {
    const bold = boldRows.includes(i);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? INK : INK_MID));
    doc.text(r[0], M, y);
    doc.text(r[1], pageW - M, y, { align: "right" });
    y += 16;
  });
  doc.setFont("helvetica", "normal");
  return y + 2;
}
