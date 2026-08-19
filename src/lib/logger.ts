// Logger dùng chung cho cả Fastify và code ngoài request (Better Auth callback, service...).
// Hai lựa chọn ở đây phục vụ trực tiếp việc gom log vào Loki:
//   1. level in ra dạng chữ ("error") thay vì số mặc định của pino (50) — Alloy chỉ cần
//      `stage.json` rồi gán label thẳng, không phải map số sang chữ.
//   2. redact: log đi vào hệ thống lưu trữ tập trung, không được mang theo token/mật khẩu.
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "*.password",
    "*.token",
    "*.apiKey",
  ],
});
