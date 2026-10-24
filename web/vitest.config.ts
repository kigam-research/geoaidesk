import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    css: false,
    include: ["src/**/*.test.{ts,tsx}"],
    // GeoAIDesk (gaid-check-speed): 20 s per test instead of 5 s, for the same load reason as the 5 s
    // asyncUtilTimeout in vitest.setup.ts.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/components/**"],
      exclude: [
        "src/lib/use-*.ts",
        "src/components/ai-elements/**",
        "src/components/pdf-viewer/**",
        "src/components/ui/**",
        "**/*.d.ts",
      ],
    },
  },
});
