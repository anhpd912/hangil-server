// Routes: GET /lessons, GET /lessons/:id — chỉ validate input + gọi DB, không business logic phức tạp
import type { FastifyPluginAsync } from "fastify";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { lessons, vocabulary, userProgress } from "../db/schema.js";
import { lessonsQuerySchema } from "../lib/validators.js";

type LessonRow = typeof lessons.$inferSelect;
type LessonStatus = "completed" | "current" | "locked";

/** Lock logic: bài N chỉ unlock khi bài N-1 (cùng track+level) đã completed. Sort theo orderIndex trước khi gọi. */
function computeStatuses(sortedLessons: LessonRow[], completedIds: Set<string>): LessonStatus[] {
  const statuses: LessonStatus[] = [];
  let previousCompleted = true;
  for (const lesson of sortedLessons) {
    if (completedIds.has(lesson.id)) {
      statuses.push("completed");
      previousCompleted = true;
    } else if (previousCompleted) {
      statuses.push("current");
      previousCompleted = false;
    } else {
      statuses.push("locked");
    }
  }
  return statuses;
}

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

    const allLessons = await db
      .select()
      .from(lessons)
      .where(and(...conditions))
      .orderBy(asc(lessons.orderIndex));

    let completedIds = new Set<string>();
    if (request.user) {
      const completedRows = await db
        .select({ lessonId: userProgress.lessonId })
        .from(userProgress)
        .where(and(eq(userProgress.userId, request.user.id), isNotNull(userProgress.completedAt)));
      completedIds = new Set(completedRows.map((r) => r.lessonId));
    }

    // Group theo track+level để tính lock đúng phạm vi, giữ nguyên thứ tự orderIndex toàn cục khi trả về
    const groups = new Map<string, LessonRow[]>();
    for (const lesson of allLessons) {
      const key = `${lesson.track}:${lesson.level}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lesson);
    }

    const statusByLessonId = new Map<string, LessonStatus | null>();
    for (const group of groups.values()) {
      const statuses = request.user ? computeStatuses(group, completedIds) : group.map(() => null);
      group.forEach((lesson, i) => statusByLessonId.set(lesson.id, statuses[i]));
    }

    const data = allLessons.map((lesson) => ({ ...lesson, status: statusByLessonId.get(lesson.id) ?? null }));

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

    const isAdmin = request.user?.role === "admin";
    if (!lesson.isPublished && !isAdmin) {
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
