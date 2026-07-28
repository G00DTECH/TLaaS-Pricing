/** Small brand-styled form/UI primitives shared across the app. */
import React, { useId } from "react";

/**
 * Accessible info tooltip. A small focusable trigger reveals an explanation on
 * hover AND keyboard focus (WCAG 2.1 AA), wired via aria-describedby. Content is
 * plain text/JSX — pass live, plugged-in numbers for calculation explanations.
 */
export function InfoTip({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Explain: ${label}`}
        aria-describedby={id}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold leading-none text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        i
      </button>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute top-full z-40 mt-1.5 w-64 rounded-control border bg-surface-base p-3 type-body-xs leading-relaxed text-foreground shadow-raised opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 type-body-xs text-muted">{hint}</p>}
    </div>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  min = 0,
  step = 1,
  placeholder,
  prefix,
  small,
}: {
  id?: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  placeholder?: string;
  prefix?: string;
  small?: boolean;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 type-body-sm text-muted">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className={`${small ? "control-sm" : "control"} ${prefix ? "pl-7" : ""}`}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      className="control"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  small,
}: {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  small?: boolean;
}) {
  return (
    <select
      id={id}
      className={small ? "control-sm" : "control"}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? "bg-gold-600" : "bg-surface-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-cream-50 shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      <span className="type-body-sm">{label}</span>
    </label>
  );
}

export function SectionCard({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {eyebrow && <p className="type-caption text-gold-600 mb-1">{eyebrow}</p>}
      {title && <h3 className="type-h4 mb-4">{title}</h3>}
      {children}
    </section>
  );
}
