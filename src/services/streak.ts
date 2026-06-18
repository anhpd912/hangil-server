// Streak logic — day boundary tính theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/schema.js";
import type { Result } from "../lib/result.js";

const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

export function toVnDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TIMEZONE }).format(date);
}

function vnDaysBetween(a: Date, b: Date): number {
  const aKey = toVnDateKey(a);
  const bKey = toVnDateKey(b);
  const aMidnight = Date.parse(`${aKey}T00:00:00Z`);
  const bMidnight = Date.parse(`${bKey}T00:00:00Z`);
  return Math.round((bMidnight - aMidnight) / (24 * 60 * 60 * 1000));
}

export type StreakUpdate = { streak: number; isNewRecord: boolean };

export async function updateStreak(userId: string): Promise<Result<StreakUpdate>> {
  const [row] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!row) {
    return { ok: false, error: "User không tồn tại" };
  }

  const now = new Date();
  let streak: number;
  let isNewRecord: boolean;

  if (!row.lastStudiedAt) {
    streak = 1;
    isNewRecord = true;
  } else {
    const daysSince = vnDaysBetween(row.lastStudiedAt, now);
    if (daysSince === 0) {
      streak = row.streakCount ?? 1;
      isNewRecord = false;
    } else if (daysSince === 1) {
      streak = (row.streakCount ?? 0) + 1;
      isNewRecord = true;
    } else {
      streak = 1;
      isNewRecord = false;
    }
  }

  await db
    .update(user)
    .set({ streakCount: streak, lastStudiedAt: now })
    .where(eq(user.id, userId));

  return { ok: true, data: { streak, isNewRecord } };
}
