import { describe, it, expect } from "vitest";
import { calculateNextReview, type SrsCardState } from "./srs.js";

const newCard: SrsCardState = { easiness: 2.5, repetitions: 0, intervalDays: 1 };

describe("calculateNextReview (SM-2)", () => {
  it("new card, grade 5 (Dễ) -> repetitions 1, interval 1 day", () => {
    const result = calculateNextReview(newCard, 5);
    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.easiness).toBeCloseTo(2.6, 5);
  });

  it("grade 4 (Tốt) on 1st repetition -> interval 1 day, repetitions 1", () => {
    const result = calculateNextReview(newCard, 4);
    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.easiness).toBeCloseTo(2.5, 5);
  });

  it("grade 3 (Khó) on 2nd repetition -> interval 6 days", () => {
    const card: SrsCardState = { easiness: 2.5, repetitions: 1, intervalDays: 1 };
    const result = calculateNextReview(card, 3);
    expect(result.repetitions).toBe(2);
    expect(result.intervalDays).toBe(6);
    expect(result.easiness).toBeLessThan(2.5);
  });

  it("grade 0 (Lại) resets repetitions to 0 and interval to 1", () => {
    const card: SrsCardState = { easiness: 2.0, repetitions: 5, intervalDays: 30 };
    const result = calculateNextReview(card, 0);
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
  });

  it("3rd+ repetition multiplies interval by easiness", () => {
    const card: SrsCardState = { easiness: 2.5, repetitions: 2, intervalDays: 6 };
    const result = calculateNextReview(card, 5);
    expect(result.repetitions).toBe(3);
    expect(result.intervalDays).toBe(Math.round(6 * result.easiness));
  });

  it("easiness never drops below 1.3", () => {
    const card: SrsCardState = { easiness: 1.3, repetitions: 3, intervalDays: 10 };
    const result = calculateNextReview(card, 0);
    expect(result.easiness).toBeGreaterThanOrEqual(1.3);
  });
});
