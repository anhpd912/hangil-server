// Route: POST /feedback — public, gắn userId nếu đã đăng nhập, không bắt buộc login
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { feedbackEntries } from "../db/schema.js";
import { feedbackCreateBodySchema } from "../lib/validators.js";

const feedbackRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/feedback", async (request, reply) => {
    const parsed = feedbackCreateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Nội dung góp ý không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const [created] = await db
      .insert(feedbackEntries)
      .values({
        userId: request.user?.id ?? null,
        email: parsed.data.email ?? request.user?.email ?? null,
        message: parsed.data.message,
      })
      .returning();

    return reply.status(201).send({ success: true, data: created });
  });
};

export default feedbackRoutes;
