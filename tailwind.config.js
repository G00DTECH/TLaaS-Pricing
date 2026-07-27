/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // CivicChain brand type roles
        display: ['"DM Serif Text"', "Georgia", "serif"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Mapped to CSS custom properties (OKLCH) declared in index.css.
        // Semantic tokens first — prefer these at call sites.
        page: "var(--page-bg)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        ring: "var(--ring)",
        "surface-base": "var(--surface-base)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-muted": "var(--surface-muted)",
        "surface-raised": "var(--surface-raised)",
        "control-bg": "var(--control-bg)",
        muted: "var(--muted-foreground)",
        // Brand families (each exposed as CSS vars for composability)
        blue: {
          50: "var(--blue-50)",
          100: "var(--blue-100)",
          200: "var(--blue-200)",
          300: "var(--blue-300)",
          600: "var(--blue-600)",
          700: "var(--blue-700)",
          800: "var(--blue-800)",
          900: "var(--blue-900)",
        },
        gold: {
          50: "var(--gold-50)",
          300: "var(--gold-300)",
          600: "var(--gold-600)",
          900: "var(--gold-900)",
        },
        green: {
          300: "var(--green-300)",
          600: "var(--green-600)",
          900: "var(--green-900)",
        },
        rose: {
          300: "var(--rose-300)",
          700: "var(--rose-700)",
          900: "var(--rose-900)",
        },
        orange: {
          300: "var(--orange-300)",
          900: "var(--orange-900)",
        },
        cream: {
          50: "var(--cream-50)",
          100: "var(--cream-100)",
          200: "var(--cream-200)",
        },
        slate: {
          400: "var(--slate-400)",
          700: "var(--slate-700)",
        },
      },
      borderRadius: {
        card: "1rem",
        control: "0.625rem",
      },
      boxShadow: {
        raised: "0 1px 2px oklch(0.2 0.12 280 / 0.06), 0 8px 24px oklch(0.2 0.12 280 / 0.08)",
        control: "inset 0 1px 2px oklch(0.2 0.12 280 / 0.05)",
      },
    },
  },
  plugins: [],
};
