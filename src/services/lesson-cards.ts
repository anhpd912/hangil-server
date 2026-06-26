// Thêm toàn bộ từ vựng của 1 bài học vào user_cards (SRS) — dùng chung cho POST /cards/init
// và POST /progress/lesson/:id/complete. ON CONFLICT DO NOTHING tránh duplicate khi gọi lại.
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { userCards, vocabulary } from "../db/schema.js";

export async function initLessonCards(userId: string, lessonId: string): Promise<number> {
  const vocabList = await db.select({ id: vocabulary.id }).from(vocabulary).where(eq(vocabulary.lessonId, lessonId));
  if (vocabList.length === 0) return 0;

  const toInsert = vocabList.map((vocab) => ({ userId, vocabId: vocab.id }));
  const inserted = await db.insert(userCards).values(toInsert).onConflictDoNothing().returning({ id: userCards.id });
  return inserted.length;
}
