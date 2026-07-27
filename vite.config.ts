import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// Base path: root by default (custom domain / Vercel / Netlify). For GitHub
// Pages served at https://<user>.github.io/<repo>/, set VITE_BASE=/<repo>/ —
// the deploy workflow does this automatically.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    port: 5180,
    open: false,
  },
});
