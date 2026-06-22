// Admin routes: CRUD /vocabulary (body chứa lessonId), GET ?lessonId= để list theo bài
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { vocabulary } from "../../db/schema.js";
import {
  adminVocabularyCreateBodySchema,
  adminVocabularyPatchBodySchema,
  adminVocabularyBulkCreateBodySchema,
} from "../../lib/validators-admin.js";

const vocabularyQuerySchema = z.object({ lessonId: z.string().uuid().optional() });

const adminVocabularyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/vocabulary", async (request, reply) => {
    const parsed = vocabularyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Query không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const data = parsed.data.lessonId
      ? await db.select().from(vocabulary).where(eq(vocabulary.lessonId, parsed.data.lessonId))
      : await db.select().from(vocabulary);

    return reply.send({ success: true, data });
  });

  fastify.post("/vocabulary", async (request, reply) => {
    const parsed = adminVocabularyCreateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const [created] = await db.insert(vocabulary).values(parsed.data).returning();
    return reply.status(201).send({ success: true, data: created });
  });

  fastify.post("/vocabulary/bulk", async (request, reply) => {
    const parsed = adminVocabularyBulkCreateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const { lessonId, text } = parsed.data;
    const rows = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [korean, romanization, vietnamese] = line.split("|").map((s) => s?.trim() ?? "");
        return { lessonId, korean, romanization, vietnamese };
      })
      .filter((row) => row.korean && row.romanization && row.vietnamese);

    if (rows.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "Không có dòng hợp lệ (định dạng: korean|romanization|vietnamese)",
        code: "VALIDATION_ERROR",
      });
    }

    const created = await db.insert(vocabulary).values(rows).returning();
    return reply.status(201).send({ success: true, data: created });
  });

  fastify.patch<{ Params: { id: string } }>("/vocabulary/:id", async (request, reply) => {
    const parsed = adminVocabularyPatchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const [updated] = await db
      .update(vocabulary)
      .set(parsed.data)
      .where(eq(vocabulary.id, request.params.id))
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy từ vựng",
        code: "VOCAB_NOT_FOUND",
      });
    }

    return reply.send({ success: true, data: updated });
  });

  fastify.delete<{ Params: { id: string } }>("/vocabulary/:id", async (request, reply) => {
    const [deleted] = await db
      .delete(vocabulary)
      .where(eq(vocabulary.id, request.params.id))
      .returning();

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: "Không tìm thấy từ vựng",
        code: "VOCAB_NOT_FOUND",
      });
    }

    return reply.send({ success: true, data: deleted });
  });
};

export default adminVocabularyRoutes;
