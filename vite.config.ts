import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the site works under a GitHub Pages sub-path.
  base: "./",
  plugins: [tailwindcss()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
