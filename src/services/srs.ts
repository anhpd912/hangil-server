// SM-2 spaced repetition algorithm — thuần TypeScript, không thư viện ngoài
export type SrsCardState = {
  easiness: number;
  repetitions: number;
  intervalDays: number;
};

export type NextReview = {
  easiness: number;
  repetitions: number;
  intervalDays: number;
  nextReviewAt: Date;
};

const MIN_EASINESS = 1.3;

export function calculateNextReview(
  card: SrsCardState,
  grade: 0 | 3 | 4 | 5,
): NextReview {
  const easinessDelta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  const easiness = Math.max(MIN_EASINESS, card.easiness + easinessDelta);

  let repetitions: number;
  let intervalDays: number;

  if (grade < 3) {
    // Trả lời sai/khó nhớ -> reset chuỗi lặp lại
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = card.repetitions + 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(card.intervalDays * easiness);
    }
  }

  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

  return { easiness, repetitions, intervalDays, nextReviewAt };
}
