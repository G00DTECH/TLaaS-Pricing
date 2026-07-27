import { useMemo, useState } from "react";
import { computeQuote, type QuoteInputs } from "./lib/pricing";
import { PRICING_CONFIG as CFG } from "./pricing.config";
import QuoteForm from "./components/QuoteForm";
import QuoteResults from "./components/QuoteResults";

/**
 * Simple shared-login gate for rep mode (spec §9.2). For a real deployment,
 * swap this for SSO / a lightweight auth endpoint. The passphrase lives in an
 * env var (VITE_REP_PASSPHRASE) with a demo fallback so the app is usable
 * out-of-the-box.
 */
const REP_PASSPHRASE = import.meta.env.VITE_REP_PASSPHRASE ?? "civicchain";

type Mode = "customer" | "rep";

const DEFAULT_INPUTS: QuoteInputs = {
  municipalityName: "",
  population: 25000,
  annualSolicitations: 240,
  departments: 8,
  deployment: "standard",
  support: "standard",
  discountPct: 0,
  tierOverride: null,
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill="var(--blue-800)" />
        <path d="M16 6 L25 10.5 V17 C25 22 21 25.5 16 27 C11 25.5 7 22 7 17 V10.5 Z" fill="none" stroke="var(--gold-600)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 16.5 l3 3 l5.5 -6" fill="none" stroke="var(--green-300)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <p className="font-display text-lg">CivicChain</p>
        <p className="type-body-xs text-muted -mt-0.5">{CFG.product.longName}</p>
      </div>
    </div>
  );
}

function RepGate({ onUnlock, onCancel }: { onUnlock: () => void; onCancel: () => void }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const submit = () => {
    if (pass === REP_PASSPHRASE) onUnlock();
    else setError(true);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/40 p-4" onClick={onCancel}>
      <div className="card-raised w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <p className="type-caption text-gold-600">Internal access</p>
        <h2 className="type-h4 mt-1 mb-4">Sales rep sign-in</h2>
        <input
          autoFocus
          type="password"
          className="control"
          placeholder="Shared passphrase"
          value={pass}
          onChange={(e) => {
            setPass(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="mt-2 type-body-sm text-rose-700">Incorrect passphrase.</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" onClick={submit}>Unlock rep mode</button>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
        <p className="mt-3 type-body-xs text-muted">Demo passphrase: <code className="type-code-xs">civicchain</code> · set <code className="type-code-xs">VITE_REP_PASSPHRASE</code> to change.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>("customer");
  const [gateOpen, setGateOpen] = useState(false);
  const [inputs, setInputs] = useState<QuoteInputs>(DEFAULT_INPUTS);

  const quote = useMemo(() => computeQuote(inputs), [inputs]);
  const patch = (p: Partial<QuoteInputs>) => setInputs((prev) => ({ ...prev, ...p }));

  const switchMode = (m: Mode) => {
    if (m === "rep" && mode !== "rep") setGateOpen(true);
    else setMode(m);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-page/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1 rounded-full border bg-surface-base p-1" role="tablist" aria-label="Mode">
            {(["customer", "rep"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`rounded-full px-4 py-1.5 type-body-sm font-medium transition-colors ${
                  mode === m ? "bg-blue-800 text-cream-50" : "text-muted hover:text-foreground"
                }`}
              >
                {m === "customer" ? "Municipality" : "Sales rep"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-2 sm:px-6">
        <p className="type-caption text-gold-600">Trustless Ledger as a Service · pricing estimator</p>
        <h1 className="type-display mt-2 max-w-3xl">
          What would it cost your town to run a tamper-proof open-data portal?
        </h1>
        <p className="type-body-lg mt-4 max-w-2xl text-muted">
          A blockchain-backed replacement for Tableau &amp; Tyler / Socrata — with{" "}
          <span className="text-blue-800 font-bold">unlimited citizen and staff access at $0 per user</span>. Enter a few
          numbers for an instant annual estimate and a 3-year comparison against legacy vendors.
        </p>
      </section>

      {/* Body */}
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <QuoteForm inputs={inputs} onChange={patch} mode={mode} />
        </div>
        <div>
          <QuoteResults quote={quote} mode={mode} />
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="border-t pt-6 type-body-xs text-muted">
          <p>© {new Date().getFullYear()} CivicChain · {CFG.product.longName}. Estimates only — not a contract. WCAG 2.1 AA. No citizen PII is collected.</p>
        </div>
      </footer>

      {gateOpen && (
        <RepGate
          onUnlock={() => {
            setMode("rep");
            setGateOpen(false);
          }}
          onCancel={() => setGateOpen(false)}
        />
      )}
    </div>
  );
}
