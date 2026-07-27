const USD0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const USD2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("en-US");

/** Whole-dollar currency, e.g. $85,000 */
export const money = (n: number) => USD0.format(Math.round(n));

/** Cent-precision currency for small figures, e.g. $12.40 */
export const money2 = (n: number) => USD2.format(n);

/** Auto: cents for values under $100, whole dollars above. */
export const moneyAuto = (n: number) => (Math.abs(n) < 100 ? USD2.format(n) : USD0.format(Math.round(n)));

export const num = (n: number) => NUM.format(Math.round(n));

export const pct = (fraction: number, digits = 0) => `${(fraction * 100).toFixed(digits)}%`;
