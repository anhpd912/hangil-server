// Admin routes: CRUD /lessons (không lọc isPublished như public route), PATCH /lessons/:id/publish
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { lessons } from "../../db/schema.js";
import {
  adminLessonCreateBodySchema,
  adminLessonPatchBodySchema,
  adminLessonPublishBodySchema,
} from "../../lib/validators-admin.js";

const adminLessonsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/lessons", async (_request, reply) => {
    const data = await db.select().from(lessons);
    return reply.send({ success: true, data });
  });

  fastify.post("/lessons", async (request, reply) => {
    const parsed = adminLessonCreateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const [created] = await db.insert(lessons).values(parsed.data).returning();
    return reply.status(201).send({ success: true, data: created });
  });

  fastify.patch<{ Params: { id: string } }>("/lessons/:id", async (request, reply) => {
    const parsed = adminLessonPatchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const [updated] = await db
      .update(lessons)
      .set(parsed.data)
      .where(eq(lessons.id, request.params.id))
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy bài học",
        code: "LESSON_NOT_FOUND",
      });
    }

    return reply.send({ success: true, data: updated });
  });

  fastify.patch<{ Params: { id: string } }>("/lessons/:id/publish", async (request, reply) => {
    const parsed = adminLessonPublishBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const [updated] = await db
      .update(lessons)
      .set({ isPublished: parsed.data.isPublished })
      .where(eq(lessons.id, request.params.id))
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy bài học",
        code: "LESSON_NOT_FOUND",
      });
    }

    return reply.send({ success: true, data: updated });
  });

  fastify.delete<{ Params: { id: string } }>("/lessons/:id", async (request, reply) => {
    const [deleted] = await db
      .delete(lessons)
      .where(eq(lessons.id, request.params.id))
      .returning();

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy bài học",
        code: "LESSON_NOT_FOUND",
      });
    }

    return reply.send({ success: true, data: deleted });
  });
};

export default adminLessonsRoutes;
