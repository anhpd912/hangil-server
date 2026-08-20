// Health check thật cho dashboard admin: ping từng phụ thuộc và đo latency.
// Khác /health/ready (ops, trả 503): endpoint này luôn 200 và mô tả từng service
// để UI vẽ được trạng thái từng dòng thay vì chỉ ready/not-ready.
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { redis } from "../../plugins/ratelimit.js";

export type ServiceStatus = "operational" | "degraded" | "down" | "unconfigured";

export type ServiceCheck = {
  id: string;
  name: string;
  status: ServiceStatus;
  /** Mô tả ngắn hiển thị bên phải tên service */
  detail: string;
  latencyMs: number | null;
};

const PROBE_TIMEOUT_MS = 2000;
/** Trên ngưỡng này coi là chậm bất thường — vẫn chạy được nhưng cần chú ý. */
const DEGRADED_LATENCY_MS = 800;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout sau ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probe(id: string, name: string, run: () => Promise<unknown>): Promise<ServiceCheck> {
  const startedAt = Date.now();
  try {
    await withTimeout(run(), name);
    const latencyMs = Date.now() - startedAt;
    return {
      id,
      name,
      status: latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "operational",
      detail: `${latencyMs}ms`,
      latencyMs,
    };
  } catch (err) {
    return {
      id,
      name,
      status: "down",
      detail: err instanceof Error ? err.message : String(err),
      latencyMs: null,
    };
  }
}

/** AI không ping được miễn phí — chỉ xác nhận provider đang chọn đã có API key. */
function checkAiProvider(): ServiceCheck {
  const provider = process.env.AI_PROVIDER ?? "anthropic";
  const keyByProvider: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq: process.env.GROQ_API_KEY,
  };
  const modelByProvider: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_MODEL,
    groq: process.env.GROQ_MODEL,
  };
  const configured = Boolean(keyByProvider[provider]);

  return {
    id: "ai",
    name: `AI Gateway · ${provider}`,
    status: configured ? "operational" : "unconfigured",
    detail: configured ? (modelByProvider[provider] || "đã cấu hình") : "thiếu API key",
    latencyMs: null,
  };
}

function checkEmailProvider(): ServiceCheck {
  const configured = Boolean(process.env.RESEND_API_KEY);
  return {
    id: "email",
    name: "Email · Resend",
    status: configured ? "operational" : "unconfigured",
    detail: configured ? (process.env.EMAIL_FROM || "đã cấu hình") : "thiếu API key",
    latencyMs: null,
  };
}

export async function getServiceHealth(): Promise<ServiceCheck[]> {
  const [database, cache] = await Promise.all([
    probe("database", "Neon Postgres", () => db.execute(sql`select 1`)),
    probe("redis", "Upstash Redis", () => redis.ping()),
  ]);

  return [database, cache, checkAiProvider(), checkEmailProvider()];
}
