// Routes /health, /health/ready — endpoint vận hành (ops), KHÔNG nằm dưới /api/v1 và không cần auth.
// /health: liveness, không chạm hạ tầng — dùng cho Docker HEALTHCHECK, smoke test sau deploy, alert "API còn sống".
// /health/ready: readiness, có chạm DB + Redis — dùng khi cần biết hạ tầng phụ thuộc còn ổn không.
// logLevel "warn" để Prometheus/healthcheck gọi liên tục không làm ngập log Loki.
import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { redis } from "../plugins/ratelimit.js";

const DEPENDENCY_TIMEOUT_MS = 2000;

/** Bọc timeout cho check phụ thuộc — DB/Redis treo thì readiness phải trả lời, không được chờ vô hạn. */
async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout sau ${DEPENDENCY_TIMEOUT_MS}ms`)), DEPENDENCY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkDependency(label: string, probe: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await withTimeout(probe(), label);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // rateLimit: false — Docker HEALTHCHECK + Prometheus + smoke test dùng chung quota 100 req/phút
  // theo IP với traffic thật; không tắt thì health check tự làm mình bị 429.
  fastify.get("/health", { logLevel: "warn", config: { rateLimit: false } }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        status: "ok",
        uptime: Math.floor(process.uptime()),
        // commit được nướng vào image lúc build. Smoke test sau deploy so field này với SHA vừa
        // build — nếu container cũ vẫn đang chạy (up -d thất bại) thì phát hiện được ngay,
        // thay vì thấy 200 rồi tưởng deploy thành công.
        commit: process.env.GIT_SHA ?? "unknown",
      },
    });
  });

  fastify.get("/health/ready", { logLevel: "warn", config: { rateLimit: false } }, async (_request, reply) => {
    const [database, cache] = await Promise.all([
      checkDependency("database", () => db.execute(sql`select 1`)),
      checkDependency("redis", () => redis.ping()),
    ]);

    const ready = database.ok && cache.ok;
    const checks = {
      database: database.ok ? "ok" : `error: ${database.error}`,
      redis: cache.ok ? "ok" : `error: ${cache.error}`,
    };

    // 503 để Prometheus/uptime coi là down; giữ nguyên envelope chuẩn của API
    if (!ready) {
      return reply.status(503).send({
        success: false,
        error: "Một hoặc nhiều phụ thuộc không sẵn sàng",
        code: "NOT_READY",
        checks,
      });
    }

    return reply.send({
      success: true,
      data: {
        status: "ready",
        uptime: Math.floor(process.uptime()),
        commit: process.env.GIT_SHA ?? "unknown",
        checks,
      },
    });
  });
};

export default healthRoutes;
