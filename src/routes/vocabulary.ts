// Route: GET /vocabulary — tìm/lọc từ vựng, cần đăng nhập (requireAuth), không cần admin
import type { FastifyPluginAsync } from "fastify";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "../db/index.js";
import { vocabulary } from "../db/schema.js";
import { requireAuth } from "../lib/require-auth.js";
import { vocabularyQuerySchema } from "../lib/validators.js";

const vocabularyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/vocabulary", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = vocabularyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Query không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const { lessonId, search } = parsed.data;
    const conditions = [];
    if (lessonId) conditions.push(eq(vocabulary.lessonId, lessonId));
    if (search) conditions.push(ilike(vocabulary.korean, `%${search}%`));

    const data = await db
      .select()
      .from(vocabulary)
      .where(conditions.length ? and(...conditions) : undefined);

    return reply.send({ success: true, data });
  });
};

export default vocabularyRoutes;
