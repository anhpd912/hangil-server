// Gom sự kiện gần đây từ nhiều bảng thành 1 dòng thời gian cho dashboard admin.
// Không có bảng audit log riêng, nên mỗi nguồn được query top-N rồi merge + sort trong JS:
// N nhỏ (<= 50) nên chi phí thấp hơn nhiều so với UNION ALL trên 5 bảng khác schema.
import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { user, userProgress, lessons, journalEntries, feedbackEntries, waitlistEntries } from "../../db/schema.js";

export type ActivityKind = "signup" | "lesson_completed" | "journal" | "feedback" | "waitlist";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  /** ISO string, UTC — FE tự format theo giờ VN */
  at: string;
  /** Email/định danh người gây ra sự kiện */
  actor: string;
  /** Mô tả ngắn gọn tiếng Việt */
  detail: string;
};

const ANONYMOUS = "khách vãng lai";

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function fetchSignups(limit: number): Promise<ActivityItem[]> {
  const rows = await db
    .select({ id: user.id, email: user.email, plan: user.plan, createdAt: user.createdAt })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: `signup:${row.id}`,
    kind: "signup" as const,
    at: row.createdAt.toISOString(),
    actor: row.email,
    detail: row.plan === "pro" ? "Tài khoản mới (Pro)" : "Tài khoản mới",
  }));
}

async function fetchCompletions(limit: number): Promise<ActivityItem[]> {
  const rows = await db
    .select({
      id: userProgress.id,
      completedAt: userProgress.completedAt,
      score: userProgress.score,
      email: user.email,
      lessonTitle: lessons.titleVi,
    })
    .from(userProgress)
    .innerJoin(user, eq(userProgress.userId, user.id))
    .innerJoin(lessons, eq(userProgress.lessonId, lessons.id))
    .where(isNotNull(userProgress.completedAt))
    .orderBy(desc(userProgress.completedAt))
    .limit(limit);

  return rows.flatMap((row) => {
    const at = toIso(row.completedAt);
    if (!at) return [];
    const score = row.score === null ? "" : ` · ${row.score} điểm`;
    return [
      {
        id: `lesson:${row.id}`,
        kind: "lesson_completed" as const,
        at,
        actor: row.email,
        detail: `Hoàn thành "${row.lessonTitle}"${score}`,
      },
    ];
  });
}

async function fetchJournals(limit: number): Promise<ActivityItem[]> {
  const rows = await db
    .select({ id: journalEntries.id, createdAt: journalEntries.createdAt, email: user.email })
    .from(journalEntries)
    .innerJoin(user, eq(journalEntries.userId, user.id))
    .orderBy(desc(journalEntries.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: `journal:${row.id}`,
    kind: "journal" as const,
    at: row.createdAt.toISOString(),
    actor: row.email,
    detail: "Gửi nhật ký cho AI chấm",
  }));
}

async function fetchFeedback(limit: number): Promise<ActivityItem[]> {
  const rows = await db
    .select({
      id: feedbackEntries.id,
      createdAt: feedbackEntries.createdAt,
      email: feedbackEntries.email,
      status: feedbackEntries.status,
      userEmail: user.email,
    })
    .from(feedbackEntries)
    .leftJoin(user, eq(feedbackEntries.userId, user.id))
    .orderBy(desc(feedbackEntries.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: `feedback:${row.id}`,
    kind: "feedback" as const,
    at: row.createdAt.toISOString(),
    actor: row.userEmail ?? row.email ?? ANONYMOUS,
    detail: `Góp ý mới (${row.status})`,
  }));
}

async function fetchWaitlist(limit: number): Promise<ActivityItem[]> {
  const rows = await db
    .select({ id: waitlistEntries.id, email: waitlistEntries.email, createdAt: waitlistEntries.createdAt })
    .from(waitlistEntries)
    .orderBy(desc(waitlistEntries.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: `waitlist:${row.id}`,
    kind: "waitlist" as const,
    at: row.createdAt.toISOString(),
    actor: row.email,
    detail: "Đăng ký waitlist",
  }));
}

/** Trả về `limit` sự kiện mới nhất trên toàn hệ thống, đã sort giảm dần theo thời gian. */
export async function getRecentActivity(limit: number): Promise<ActivityItem[]> {
  const perSource = Math.min(limit, 25);
  const batches = await Promise.all([
    fetchSignups(perSource),
    fetchCompletions(perSource),
    fetchJournals(perSource),
    fetchFeedback(perSource),
    fetchWaitlist(perSource),
  ]);

  return batches
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
