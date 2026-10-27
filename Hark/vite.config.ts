import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Hark 版本独立运行：默认 5174 端口，避免与根目录项目（5173）冲突。
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: "node_modules/.vite",
  plugins: [react()],
  server: { port: 5174, strictPort: false },
  preview: { port: 4174 },
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
