/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // Relative base so the build works at any path (GitHub Pages project sites
  // serve from /<repo>/). All asset + data fetches use import.meta.env.BASE_URL.
  base: "./",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
  },
});
