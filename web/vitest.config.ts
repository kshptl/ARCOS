import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      include: ["components/**", "lib/**", "app/**"],
      exclude: ["**/*.stories.*", "tests/**"],
    },
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname.replace(/\/$/, ""),
    },
  },
});
