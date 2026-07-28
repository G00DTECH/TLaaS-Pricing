import { useMemo, useState } from "react";
import { computeQuote, type QuoteInputs } from "./lib/pricing";
import { PRICING_CONFIG as CFG } from "./pricing.config";
import QuoteForm, { type LeadStatus } from "./components/QuoteForm";
import QuoteResults from "./components/QuoteResults";
import { submitLead, firebaseEnabled } from "./lib/leads";

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
    <div className="flex items-center gap-3">
      <img
        src={`${import.meta.env.BASE_URL}brand/civic-logo-w-text-horizontal.svg`}
        alt="CivicChain"
        className="h-7 w-auto"
        width={175}
        height={28}
      />
      <span className="hidden sm:inline-block h-6 w-px bg-border" aria-hidden />
      <p className="hidden type-body-xs text-muted sm:block">{CFG.product.longName}</p>
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

  // Lead capture (customer mode)
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("idle");
  const [leadError, setLeadError] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);

  const quote = useMemo(() => computeQuote(inputs), [inputs]);
  const patch = (p: Partial<QuoteInputs>) => {
    setInputs((prev) => ({ ...prev, ...p }));
    // Editing after a send resets the button so a fresh estimate can be sent;
    // don't disturb an in-flight request.
    setLeadStatus((s) => (s === "sending" ? s : "idle"));
  };

  const submitLeadHandler = async () => {
    setLeadStatus("sending");
    setLeadError(undefined);
    try {
      await submitLead(inputs, quote);
      setLeadStatus("sent");
    } catch (e) {
      setLeadStatus("error");
      setLeadError(e instanceof Error ? e.message : String(e));
    }
  };

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
          A blockchain-backed replacement for legacy BI dashboards and incumbent open-data portals — with{" "}
          <span className="text-blue-800 font-bold">unlimited citizen and staff access at $0 per user</span>. Enter a few
          numbers for an instant annual estimate and a 3-year comparison against legacy vendors.
        </p>
      </section>

      {/* Body */}
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <QuoteForm
            inputs={inputs}
            onChange={patch}
            mode={mode}
            lead={
              mode === "customer"
                ? {
                    enabled: firebaseEnabled,
                    status: leadStatus,
                    error: leadError,
                    consent,
                    onConsent: setConsent,
                    onSubmit: submitLeadHandler,
                  }
                : undefined
            }
          />
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
