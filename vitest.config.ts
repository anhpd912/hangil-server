import { defineConfig } from "vitest/config";

// Chỉ chạy test trong src/. Không có file này, vitest quét cả dist/ và chạy lại bản .js
// đã biên dịch — test bị nhân đôi và có thể chạy nhầm code cũ còn sót trong dist.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
