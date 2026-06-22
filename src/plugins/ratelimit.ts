// Rate limiting theo key (user/route) dùng Upstash — cho các route giới hạn theo ngày (AI, auth)
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { AppError } from "../lib/errors.js";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL ?? "",
  token: process.env.UPSTASH_REDIS_TOKEN ?? "",
});

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, window: `${number} ${"s" | "m" | "h" | "d"}`): Ratelimit {
  const cacheKey = `${limit}:${window}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
): Promise<void> {
  const limiter = getLimiter(limit, window);
  const result = await limiter.limit(key);
  if (!result.success) {
    throw new AppError("Bạn đã vượt quá giới hạn sử dụng hôm nay", "RATE_LIMIT_EXCEEDED", 429);
  }
}
