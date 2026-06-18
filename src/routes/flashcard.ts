// Routes: GET /cards/due, POST /cards/:id/review, POST /cards/init
import type { FastifyPluginAsync } from "fastify";
import { and, eq, lte, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { userCards, vocabulary } from "../db/schema.js";
import { calculateNextReview } from "../services/srs.js";
import { requireAuth } from "../lib/require-auth.js";
import { cardReviewBodySchema, cardInitBodySchema } from "../lib/validators.js";

const FREE_DUE_LIMIT = 20;
const PRO_DUE_LIMIT = 1000;

const flashcardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/cards/due", { preHandler: requireAuth }, async (request, reply) => {
    const limit = request.user!.plan === "pro" ? PRO_DUE_LIMIT : FREE_DUE_LIMIT;

    const data = await db
      .select()
      .from(userCards)
      .where(and(eq(userCards.userId, request.user!.id), lte(userCards.nextReviewAt, new Date())))
      .orderBy(asc(userCards.nextReviewAt))
      .limit(limit);

    return reply.send({ success: true, data });
  });

  fastify.post<{ Params: { id: string } }>(
    "/cards/:id/review",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = cardReviewBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: "Body không hợp lệ",
          code: "VALIDATION_ERROR",
        });
      }

      const [card] = await db
        .select()
        .from(userCards)
        .where(and(eq(userCards.id, request.params.id), eq(userCards.userId, request.user!.id)))
        .limit(1);

      if (!card) {
        return reply.status(404).send({
          success: false,
          error: "Không tìm thấy thẻ",
          code: "CARD_NOT_FOUND",
        });
      }

      const next = calculateNextReview(
        {
          easiness: card.easiness,
          repetitions: card.repetitions,
          intervalDays: card.intervalDays,
        },
        parsed.data.grade,
      );

      const [updated] = await db
        .update(userCards)
        .set({
          easiness: next.easiness,
          repetitions: next.repetitions,
          intervalDays: next.intervalDays,
          nextReviewAt: next.nextReviewAt,
          lastReviewedAt: new Date(),
        })
        .where(eq(userCards.id, card.id))
        .returning();

      return reply.send({ success: true, data: updated });
    },
  );

  fastify.post("/cards/init", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = cardInitBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Body không hợp lệ",
        code: "VALIDATION_ERROR",
      });
    }

    const vocabList = await db
      .select()
      .from(vocabulary)
      .where(eq(vocabulary.lessonId, parsed.data.lessonId));

    if (vocabList.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const existing = await db
      .select({ vocabId: userCards.vocabId })
      .from(userCards)
      .where(eq(userCards.userId, request.user!.id));
    const existingVocabIds = new Set(existing.map((row) => row.vocabId));

    const toInsert = vocabList
      .filter((vocab) => !existingVocabIds.has(vocab.id))
      .map((vocab) => ({ userId: request.user!.id, vocabId: vocab.id }));

    if (toInsert.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const inserted = await db.insert(userCards).values(toInsert).returning();
    return reply.send({ success: true, data: inserted });
  });
};

export default flashcardRoutes;
