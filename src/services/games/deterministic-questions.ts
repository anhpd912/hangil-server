// Sinh câu hỏi Context-Fill/Speed-Quiz hoàn toàn không cần AI (dành cho user Free) —
// dùng dữ liệu vocabulary có sẵn (example sentence, nghĩa) + xáo trộn distractor từ các từ khác.
import type { LearnedWord } from "./select-words.js";
import type { ContextFillQuestion, SpeedQuizQuestion } from "../ai/index.js";

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function pickDistractors(words: LearnedWord[], excludeVocabId: string, count: number): LearnedWord[] {
  return shuffle(words.filter((w) => w.vocabId !== excludeVocabId)).slice(0, count);
}

export function buildContextFillQuestions(words: LearnedWord[]): ContextFillQuestion[] {
  return words.map((word) => {
    const distractors = pickDistractors(words, word.vocabId, 3);
    const optionsWords = shuffle([word, ...distractors]);
    const correctIndex = optionsWords.findIndex((w) => w.vocabId === word.vocabId);

    const hasExample = word.exampleSentenceKo?.includes(word.korean);
    const sentenceKo = hasExample
      ? word.exampleSentenceKo!.replace(word.korean, "[...]")
      : `[...] — ${word.vietnamese}`;
    const translationVi = word.exampleSentenceVi ?? word.vietnamese;

    return {
      vocabId: word.vocabId,
      sentenceKo,
      translationVi,
      options: optionsWords.map((w) => w.korean),
      correctIndex,
    };
  });
}

export function buildSpeedQuizQuestions(words: LearnedWord[]): SpeedQuizQuestion[] {
  return words.map((word) => {
    const distractors = pickDistractors(words, word.vocabId, 3);
    const optionsWords = shuffle([word, ...distractors]);
    const correctIndex = optionsWords.findIndex((w) => w.vocabId === word.vocabId);

    return {
      vocabId: word.vocabId,
      korean: word.korean,
      options: optionsWords.map((w) => w.vietnamese),
      correctIndex,
    };
  });
}
