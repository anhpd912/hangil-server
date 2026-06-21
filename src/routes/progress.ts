// Routes: GET /progress, POST /progress/lesson/:id/complete
import type { FastifyPluginAsync } from "fastify";
import { and, eq, count, gt, isNotNull, isNull, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { userCards, userProgress, user, lessons } from "../db/schema.js";
import { updateStreak } from "../services/streak.js";
import { requireAuth } from "../lib/require-auth.js";
import { lessonCompleteBodySchema } from "../lib/validators.js";

const progressRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/progress", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const userTrack = request.user!.track;

    const [[userRow], [cardsTotal], [lessonsDone], [wordsMasteredRow], nextLessonRows] = await Promise.all([
      db.select({ streakCount: user.streakCount }).from(user).where(eq(user.id, userId)).limit(1),
      db.select({ value: count() }).from(userCards).where(eq(userCards.userId, userId)),
      db
        .select({ value: count() })
        .from(userProgress)
        .where(and(eq(userProgress.userId, userId), isNotNull(userProgress.completedAt))),
      db
        .select({ value: count() })
        .from(userCards)
        .where(and(eq(userCards.userId, userId), gt(userCards.repetitions, 0))),
      userTrack
        ? db
            .select({
              id: lessons.id,
              titleVi: lessons.titleVi,
              titleKo: lessons.titleKo,
              track: lessons.track,
              level: lessons.level,
            })
            .from(lessons)
            .leftJoin(
              userProgress,
              and(eq(userProgress.lessonId, lessons.id), eq(userProgress.userId, userId)),
            )
            .where(
              and(
                eq(lessons.track, userTrack as "k_culture" | "topik"),
                eq(lessons.isPublished, true),
                isNull(userProgress.completedAt),
              ),
            )
            .orderBy(asc(lessons.orderIndex))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return reply.send({
      success: true,
      data: {
        streak: userRow?.streakCount ?? 0,
        totalCards: cardsTotal?.value ?? 0,
        lessonsDone: lessonsDone?.value ?? 0,
        wordsMastered: wordsMasteredRow?.value ?? 0,
        nextLesson: nextLessonRows[0] ?? null,
      },
    });
  });

  fastify.post<{ Params: { id: string } }>(
    "/progress/lesson/:id/complete",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = lessonCompleteBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: "Body không hợp lệ",
          code: "VALIDATION_ERROR",
        });
      }

      const userId = request.user!.id;
      const lessonId = request.params.id;

      const [existing] = await db
        .select()
        .from(userProgress)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.lessonId, lessonId)))
        .limit(1);

      const completedAt = new Date();
      const progressRow = existing
        ? (
            await db
              .update(userProgress)
              .set({ completedAt, score: parsed.data.score })
              .where(eq(userProgress.id, existing.id))
              .returning()
          )[0]
        : (
            await db
              .insert(userProgress)
              .values({ userId, lessonId, completedAt, score: parsed.data.score })
              .returning()
          )[0];

      const streakResult = await updateStreak(userId);

      return reply.send({
        success: true,
        data: {
          progress: progressRow,
          streak: streakResult.ok ? streakResult.data : null,
        },
      });
    },
  );
};

export default progressRoutes;
