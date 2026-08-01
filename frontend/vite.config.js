import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // GitHub Pages needs the repository path.
  // Hostinger root domain needs "/".
  base:
    process.env.GITHUB_ACTIONS === "true"
      ? "/Valencia-RMS/"
      : "/",

  server: {
    host: "0.0.0.0",
    port: 5173,
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});