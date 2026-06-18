// Admin route: GET /stats — số liệu tổng quan hệ thống
import type { FastifyPluginAsync } from "fastify";
import { and, count, gte, isNotNull, lt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { user, userProgress, journalEntries } from "../../db/schema.js";
import { toVnDateKey } from "../../services/streak.js";

const adminStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stats", async (_request, reply) => {
    const now = new Date();
    const todayKey = toVnDateKey(now);
    const todayStartUtc = new Date(`${todayKey}T00:00:00+07:00`);
    const tomorrowStartUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    const [[totalUsers], [activeToday], [lessonsCompleted], [journalCalls]] = await Promise.all([
      db.select({ value: count() }).from(user),
      db
        .select({ value: count() })
        .from(user)
        .where(and(gte(user.lastStudiedAt, todayStartUtc), lt(user.lastStudiedAt, tomorrowStartUtc))),
      db.select({ value: count() }).from(userProgress).where(isNotNull(userProgress.completedAt)),
      db.select({ value: count() }).from(journalEntries),
    ]);

    return reply.send({
      success: true,
      data: {
        totalUsers: totalUsers?.value ?? 0,
        activeToday: activeToday?.value ?? 0,
        lessonsCompleted: lessonsCompleted?.value ?? 0,
        journalCheckCalls: journalCalls?.value ?? 0,
      },
    });
  });
};

export default adminStatsRoutes;
