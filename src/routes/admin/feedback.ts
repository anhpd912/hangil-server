// Admin route: GET /feedback — danh sách góp ý người dùng gửi
import type { FastifyPluginAsync } from "fastify";
import { count, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { feedbackEntries } from "../../db/schema.js";
import { adminFeedbackListQuerySchema } from "../../lib/validators-admin.js";

const adminFeedbackRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/feedback", async (request, reply) => {
    const parsed = adminFeedbackListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Query không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const { page, pageSize } = parsed.data;

    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(feedbackEntries)
        .orderBy(desc(feedbackEntries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() }).from(feedbackEntries),
    ]);

    return reply.send({
      success: true,
      data: { entries: rows, page, pageSize, total: total?.value ?? 0 },
    });
  });
};

export default adminFeedbackRoutes;
