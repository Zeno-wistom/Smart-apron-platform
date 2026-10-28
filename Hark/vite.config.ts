import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// UX worktree uses a fixed port; do not silently serve another checkout during testing.
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: "node_modules/.vite",
  plugins: [react()],
  server: { port: 5184, strictPort: true },
  preview: { port: 4174 },
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
