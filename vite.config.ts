import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  esbuild: { jsxImportSource: "@/i18n" },
  // These are local source modules, not dependencies: prebundling them duplicates
  // the language context and disconnects development renders from the provider.
  optimizeDeps: {
    exclude: ["@/i18n/jsx-runtime", "@/i18n/jsx-dev-runtime"],
  },
  server: {
    watch: {
      ignored: [
        "**/playwright-report/**",
        "**/test-results/**",
        "**/artifacts/**",
      ],
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
