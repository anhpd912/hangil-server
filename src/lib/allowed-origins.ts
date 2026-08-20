// Nguồn origin duy nhất cho CORS (index.ts) và trustedOrigins của Better Auth (lib/auth.ts).
// .env dev thường trỏ thẳng vào domain production, khiến frontend chạy localhost bị
// Better Auth trả 403 INVALID_ORIGIN dù mật khẩu đúng. Ngoài production thì luôn kèm
// origin localhost để dev không phải sửa .env; production giữ nguyên danh sách cấu hình.
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3100"];

export function getAllowedOrigins(): string[] {
  const configured = [
    process.env.FRONTEND_URL ?? DEV_ORIGINS[0],
    process.env.ADMIN_FRONTEND_URL ?? DEV_ORIGINS[1],
  ];

  if (process.env.NODE_ENV === "production") return configured;

  return [...new Set([...configured, ...DEV_ORIGINS])];
}
