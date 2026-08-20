// Số liệu tổng quan cho dashboard admin: tổng tích luỹ + xu hướng 7 ngày so với 7 ngày liền trước.
import { and, count, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  user,
  userProgress,
  journalEntries,
  lessons,
  vocabulary,
  waitlistEntries,
  feedbackEntries,
} from "../../db/schema.js";
import { toVnDateKey } from "../streak.js";

/** So sánh cửa sổ 7 ngày hiện tại với 7 ngày liền trước — FE tự tính % thay đổi. */
export type MetricTrend = { current: number; previous: number };

export type AdminStats = {
  totalUsers: number;
  activeToday: number;
  lessonsCompleted: number;
  journalCheckCalls: number;
  proUsers: number;
  newUsers: MetricTrend;
  completions: MetricTrend;
  journalChecks: MetricTrend;
  activeLearners: MetricTrend;
  content: {
    lessonsTotal: number;
    lessonsPublished: number;
    vocabularyTotal: number;
    waitlistTotal: number;
    feedbackNew: number;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

function vnDayBounds(now: Date): { start: Date; end: Date } {
  const key = toVnDateKey(now);
  const start = new Date(`${key}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

async function scalar(query: Promise<{ value: number }[]>): Promise<number> {
  const [row] = await query;
  return row?.value ?? 0;
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const { start: todayStart, end: tomorrowStart } = vnDayBounds(now);
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const prevWindowStart = new Date(now.getTime() - 2 * WINDOW_DAYS * DAY_MS);

  const [
    totalUsers,
    activeToday,
    lessonsCompleted,
    journalCheckCalls,
    proUsers,
    newUsersCurrent,
    newUsersPrevious,
    completionsCurrent,
    completionsPrevious,
    journalCurrent,
    journalPrevious,
    activeCurrent,
    activePrevious,
    lessonsTotal,
    lessonsPublished,
    vocabularyTotal,
    waitlistTotal,
    feedbackNew,
  ] = await Promise.all([
    scalar(db.select({ value: count() }).from(user)),
    scalar(
      db
        .select({ value: count() })
        .from(user)
        .where(and(gte(user.lastStudiedAt, todayStart), lt(user.lastStudiedAt, tomorrowStart))),
    ),
    scalar(db.select({ value: count() }).from(userProgress).where(isNotNull(userProgress.completedAt))),
    scalar(db.select({ value: count() }).from(journalEntries)),
    scalar(db.select({ value: count() }).from(user).where(eq(user.plan, "pro"))),
    scalar(db.select({ value: count() }).from(user).where(gte(user.createdAt, windowStart))),
    scalar(
      db
        .select({ value: count() })
        .from(user)
        .where(and(gte(user.createdAt, prevWindowStart), lt(user.createdAt, windowStart))),
    ),
    scalar(db.select({ value: count() }).from(userProgress).where(gte(userProgress.completedAt, windowStart))),
    scalar(
      db
        .select({ value: count() })
        .from(userProgress)
        .where(and(gte(userProgress.completedAt, prevWindowStart), lt(userProgress.completedAt, windowStart))),
    ),
    scalar(db.select({ value: count() }).from(journalEntries).where(gte(journalEntries.createdAt, windowStart))),
    scalar(
      db
        .select({ value: count() })
        .from(journalEntries)
        .where(and(gte(journalEntries.createdAt, prevWindowStart), lt(journalEntries.createdAt, windowStart))),
    ),
    scalar(
      db
        .select({ value: sql<number>`count(distinct ${userProgress.userId})::int` })
        .from(userProgress)
        .where(gte(userProgress.completedAt, windowStart)),
    ),
    scalar(
      db
        .select({ value: sql<number>`count(distinct ${userProgress.userId})::int` })
        .from(userProgress)
        .where(and(gte(userProgress.completedAt, prevWindowStart), lt(userProgress.completedAt, windowStart))),
    ),
    scalar(db.select({ value: count() }).from(lessons)),
    scalar(db.select({ value: count() }).from(lessons).where(eq(lessons.isPublished, true))),
    scalar(db.select({ value: count() }).from(vocabulary)),
    scalar(db.select({ value: count() }).from(waitlistEntries)),
    scalar(db.select({ value: count() }).from(feedbackEntries).where(eq(feedbackEntries.status, "new"))),
  ]);

  return {
    totalUsers,
    activeToday,
    lessonsCompleted,
    journalCheckCalls,
    proUsers,
    newUsers: { current: newUsersCurrent, previous: newUsersPrevious },
    completions: { current: completionsCurrent, previous: completionsPrevious },
    journalChecks: { current: journalCurrent, previous: journalPrevious },
    activeLearners: { current: activeCurrent, previous: activePrevious },
    content: { lessonsTotal, lessonsPublished, vocabularyTotal, waitlistTotal, feedbackNew },
  };
}
