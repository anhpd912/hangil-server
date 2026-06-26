// Routes: GET /cards/due, POST /cards/:id/review, POST /cards/init
import type { FastifyPluginAsync } from "fastify";
import { and, eq, lte, asc, sql, notInArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { userCards, vocabulary, lessons, user } from "../db/schema.js";
import { calculateNextReview } from "../services/srs.js";
import { toVnDateKey } from "../services/streak.js";
import { initLessonCards } from "../services/lesson-cards.js";
import { requireAuth } from "../lib/require-auth.js";
import { redis } from "../plugins/ratelimit.js";
import { cardReviewBodySchema, cardInitBodySchema } from "../lib/validators.js";

const REVIEW_CAP = 30;
const NEW_CARDS_PER_DAY = 20;

function newCardsRedisKey(userId: string): string {
  return `new:${userId}:${toVnDateKey(new Date())}`;
}

// TTL tới nửa đêm giờ VN (UTC+7, không DST) — key tự hết hạn khi qua ngày mới
function secondsUntilVnMidnight(): number {
  const now = new Date();
  const todayKey = toVnDateKey(now);
  const todayMidnightUtcMs = Date.parse(`${todayKey}T00:00:00+07:00`);
  const nextMidnightUtcMs = todayMidnightUtcMs + 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((nextMidnightUtcMs - now.getTime()) / 1000));
}

function xpForGrade(grade: 0 | 3 | 4 | 5): number {
  if (grade >= 4) return 10;
  if (grade === 3) return 5;
  return 2;
}

const flashcardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/cards/due", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;

    const reviewRows = await db
      .select({
        id: userCards.id,
        vocabId: userCards.vocabId,
        korean: vocabulary.korean,
        romanization: vocabulary.romanization,
        vietnamese: vocabulary.vietnamese,
        exampleKo: vocabulary.exampleSentenceKo,
        exampleVi: vocabulary.exampleSentenceVi,
        source: lessons.titleVi,
      })
      .from(userCards)
      .innerJoin(vocabulary, eq(userCards.vocabId, vocabulary.id))
      .innerJoin(lessons, eq(vocabulary.lessonId, lessons.id))
      .where(and(eq(userCards.userId, userId), lte(userCards.nextReviewAt, new Date())))
      .orderBy(asc(userCards.nextReviewAt))
      .limit(REVIEW_CAP);

    const newCardsKey = newCardsRedisKey(userId);
    const shownToday = Number((await redis.get<number>(newCardsKey)) ?? 0);
    const newCap = Math.max(0, NEW_CARDS_PER_DAY - shownToday);

    const existingVocabRows = await db
      .select({ vocabId: userCards.vocabId })
      .from(userCards)
      .where(eq(userCards.userId, userId));
    const existingVocabIds = existingVocabRows.map((row) => row.vocabId);

    const newRows =
      newCap === 0
        ? []
        : await db
            .select({
              vocabId: vocabulary.id,
              korean: vocabulary.korean,
              romanization: vocabulary.romanization,
              vietnamese: vocabulary.vietnamese,
              exampleKo: vocabulary.exampleSentenceKo,
              exampleVi: vocabulary.exampleSentenceVi,
              source: lessons.titleVi,
            })
            .from(vocabulary)
            .innerJoin(lessons, eq(vocabulary.lessonId, lessons.id))
            .where(
              existingVocabIds.length > 0
                ? and(eq(lessons.isPublished, true), notInArray(vocabulary.id, existingVocabIds))
                : eq(lessons.isPublished, true),
            )
            .orderBy(asc(lessons.orderIndex))
            .limit(newCap);

    if (newRows.length > 0) {
      await redis.incrby(newCardsKey, newRows.length);
      await redis.expire(newCardsKey, secondsUntilVnMidnight());
    }

    const cards = [
      ...reviewRows.map((row) => ({ ...row, type: "review" as const })),
      ...newRows.map((row) => ({ ...row, id: null, type: "new" as const })),
    ];

    return reply.send({
      success: true,
      data: {
        reviewCount: reviewRows.length,
        newCount: newRows.length,
        total: cards.length,
        cards,
      },
    });
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

      const xpEarned = xpForGrade(parsed.data.grade);

      const [[updatedCard], [updatedUser]] = await Promise.all([
        db
          .update(userCards)
          .set({
            easiness: next.easiness,
            repetitions: next.repetitions,
            intervalDays: next.intervalDays,
            nextReviewAt: next.nextReviewAt,
            lastReviewedAt: new Date(),
          })
          .where(eq(userCards.id, card.id))
          .returning(),
        db
          .update(user)
          .set({ xp: sql`coalesce(${user.xp}, 0) + ${xpEarned}` })
          .where(eq(user.id, request.user!.id))
          .returning({ streakCount: user.streakCount }),
      ]);

      return reply.send({
        success: true,
        data: {
          nextReviewAt: updatedCard.nextReviewAt,
          interval: updatedCard.intervalDays,
          xpEarned,
          streak: updatedUser?.streakCount ?? 0,
        },
      });
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

    const addedCount = await initLessonCards(request.user!.id, parsed.data.lessonId);
    return reply.send({ success: true, data: { addedCount } });
  });
};

export default flashcardRoutes;
