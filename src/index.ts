// Entry point — fastify bootstrap
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import lessonsRoutes from "./routes/lessons.js";
import vocabularyRoutes from "./routes/vocabulary.js";
import flashcardRoutes from "./routes/flashcard.js";
import gamesRoutes from "./routes/games.js";
import progressRoutes from "./routes/progress.js";
import meRoutes from "./routes/me.js";
import aiRoutes from "./routes/ai.js";
import adminRoutes from "./routes/admin/index.js";
import healthRoutes from "./routes/health.js";
import waitlistRoutes from "./routes/waitlist.js";
import feedbackRoutes from "./routes/feedback.js";
import ttsRoutes from "./routes/tts.js";
import * as fastifyMetrics from "fastify-metrics";
import { AppError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";

// loggerInstance (không phải `logger`) là cách Fastify 5 nhận một pino instance có sẵn.
// Dùng chung instance với code ngoài request để mọi dòng log có cùng format cho Loki.
const fastify = Fastify({ loggerInstance: logger });

const allowedOrigins = [
  process.env.FRONTEND_URL ?? "http://localhost:3000",
  process.env.ADMIN_FRONTEND_URL ?? "http://localhost:3100",
];
await fastify.register(cors, {
  origin: allowedOrigins,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
await fastify.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
await fastify.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await fastify.register(authPlugin);
// 1. Đăng ký Metrics ở cấp độ gốc
// fastify-metrics's .d.ts không khớp generic FastifyTypeProvider dưới NodeNext +
// "type":"module" (TS suy ra type của default export là cả module namespace) — lỗi
// type-level của package, hành vi runtime đúng. Suppress 1 dòng, không dùng any.
// @ts-expect-error — xem comment phía trên
await fastify.register(fastifyMetrics.default, {
  endpoint: "/metrics", // Tự động tạo route GET /metrics
  defaultMetrics: { enabled: true },
});
// Health endpoint nằm ngoài /api/v1 (giống /metrics) — hạ tầng gọi, không phải client gọi
await fastify.register(healthRoutes);
await fastify.register(
  async (instance) => {
    await instance.register(authRoutes);
    await instance.register(lessonsRoutes);
    await instance.register(vocabularyRoutes);
    await instance.register(flashcardRoutes);
    await instance.register(gamesRoutes);
    await instance.register(progressRoutes);
    await instance.register(meRoutes);
    await instance.register(aiRoutes);
    await instance.register(waitlistRoutes);
    await instance.register(feedbackRoutes);
    await instance.register(ttsRoutes);
    await instance.register(adminRoutes, { prefix: "/admin" });
  },
  { prefix: "/api/v1" },
);

fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: error.message,
      code: error.code,
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: "Validation error",
      code: "VALIDATION_ERROR",
      fields: error.flatten().fieldErrors,
    });
  }

  fastify.log.error(error);
  return reply.status(500).send({
    success: false,
    error: "Lỗi hệ thống, vui lòng thử lại sau",
    code: "INTERNAL_ERROR",
  });
});

const port = Number(process.env.PORT) || 3001;

// Node làm PID 1 không có handler SIGTERM mặc định: `docker compose up -d` sẽ chờ hết 10s
// grace period rồi SIGKILL — mỗi lần deploy đều cắt ngang request đang xử lý. Đóng chủ động
// để request đang chạy kịp hoàn tất.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    fastify.log.info(`${signal} nhận được, đang đóng server...`);
    try {
      await fastify.close();
      process.exit(0);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  });
}

try {
  await fastify.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
