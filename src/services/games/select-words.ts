// Lấy từ vựng "đã học" (có trong user_cards) để chơi game ôn tập — ưu tiên từ yếu nhất (easiness thấp)
import { eq, asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { userCards, vocabulary } from "../../db/schema.js";

export type LearnedWord = {
  cardId: string;
  vocabId: string;
  korean: string;
  romanization: string;
  vietnamese: string;
  exampleSentenceKo: string | null;
  exampleSentenceVi: string | null;
};

export const GAME_QUESTION_COUNT = 10;

export async function selectLearnedWords(
  userId: string,
  count = GAME_QUESTION_COUNT,
): Promise<LearnedWord[]> {
  const rows = await db
    .select({
      cardId: userCards.id,
      vocabId: userCards.vocabId,
      korean: vocabulary.korean,
      romanization: vocabulary.romanization,
      vietnamese: vocabulary.vietnamese,
      exampleSentenceKo: vocabulary.exampleSentenceKo,
      exampleSentenceVi: vocabulary.exampleSentenceVi,
    })
    .from(userCards)
    .innerJoin(vocabulary, eq(userCards.vocabId, vocabulary.id))
    .where(eq(userCards.userId, userId))
    .orderBy(asc(userCards.easiness))
    .limit(count);

  return rows;
}
