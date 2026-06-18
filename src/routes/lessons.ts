// Routes: GET /lessons, GET /lessons/:id — chỉ validate input + gọi DB, không business logic phức tạp
import type { FastifyPluginAsync } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { lessons, vocabulary } from "../db/schema.js";
import { lessonsQuerySchema } from "../lib/validators.js";

const lessonsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/lessons", async (request, reply) => {
    const parsed = lessonsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Query không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const { track, level } = parsed.data;
    const conditions = [eq(lessons.isPublished, true)];
    if (track) conditions.push(eq(lessons.track, track));
    if (level) conditions.push(eq(lessons.level, level));

    const data = await db
      .select()
      .from(lessons)
      .where(and(...conditions));

    return reply.send({ success: true, data });
  });

  fastify.get<{ Params: { id: string } }>("/lessons/:id", async (request, reply) => {
    const { id } = request.params;

    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
    if (!lesson) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy bài học",
        code: "LESSON_NOT_FOUND",
      });
    }

    const vocabList = await db
      .select()
      .from(vocabulary)
      .where(eq(vocabulary.lessonId, id));

    return reply.send({ success: true, data: { ...lesson, vocabulary: vocabList } });
  });
};

export default lessonsRoutes;
