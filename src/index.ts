// Entry point — fastify bootstrap
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import lessonsRoutes from "./routes/lessons.js";
import flashcardRoutes from "./routes/flashcard.js";
import progressRoutes from "./routes/progress.js";
import aiRoutes from "./routes/ai.js";
import adminRoutes from "./routes/admin/index.js";
import waitlistRoutes from "./routes/waitlist.js";
import { AppError } from "./lib/errors.js";

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: process.env.FRONTEND_URL ?? true });
await fastify.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
await fastify.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await fastify.register(authPlugin);

await fastify.register(
  async (instance) => {
    await instance.register(authRoutes);
    await instance.register(lessonsRoutes);
    await instance.register(flashcardRoutes);
    await instance.register(progressRoutes);
    await instance.register(aiRoutes);
    await instance.register(waitlistRoutes);
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

try {
  await fastify.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
