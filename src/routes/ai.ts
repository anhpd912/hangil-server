// Routes: POST /ai/journal-check (rate-limited 5/ngày Free, unlimited Pro), POST /ai/chat (phase 2 scaffold)
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { journalEntries } from "../db/schema.js";
import { checkJournal } from "../services/ai/index.js";
import { checkRateLimit } from "../plugins/ratelimit.js";
import { requireAuth } from "../lib/require-auth.js";
import { journalCheckBodySchema } from "../lib/validators.js";
import { AppError } from "../lib/errors.js";

const FREE_DAILY_LIMIT = 5;

const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/ai/journal-check", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = journalCheckBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const userId = request.user!.id;
    if (request.user!.plan !== "pro") {
      await checkRateLimit(`journal-check:${userId}`, FREE_DAILY_LIMIT, "1 d");
    }

    const result = await checkJournal(parsed.data.content);
    if (!result.ok) {
      throw new AppError(result.error, "AI_CHECK_FAILED", 502);
    }

    const [entry] = await db
      .insert(journalEntries)
      .values({
        userId,
        contentKo: parsed.data.content,
        aiFeedback: result.data,
      })
      .returning();

    return reply.send({ success: true, data: { entry, feedback: result.data } });
  });

  // Phase 2 — scaffold trống
  fastify.post("/ai/chat", { preHandler: requireAuth }, async (_request, reply) => {
    return reply.status(501).send({
      success: false,
      error: "Chưa hỗ trợ — sẽ triển khai ở phase 2",
      code: "NOT_IMPLEMENTED",
    });
  });
};

export default aiRoutes;
