// Zod schemas dùng chung cho request validation
import { z } from "zod";

export const lessonsQuerySchema = z.object({
  track: z.enum(["k_culture", "topik"]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

// Cấu trúc content jsonb của lesson — thống nhất giữa BE và admin editor
export const lessonContentSchema = z.object({
  theory: z.object({
    title: z.string(),
    explanation: z.string(),
    notes: z.string().optional(),
  }),
  examples: z
    .array(
      z.object({
        korean: z.string(),
        vietnamese: z.string(),
        source: z.string().optional(),
      }),
    )
    .default([]),
  exercises: z
    .array(
      z.object({
        type: z.string(),
        prompt: z.string(),
        options: z.array(z.string()).optional(),
        answer: z.string(),
      }),
    )
    .default([]),
});

export const vocabularyQuerySchema = z.object({
  lessonId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const cardReviewBodySchema = z.object({
  grade: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(5)]),
});

export const cardInitBodySchema = z.object({
  lessonId: z.string().uuid(),
});

export const lessonCompleteBodySchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
});

export const journalCheckBodySchema = z.object({
  content: z.string().min(1).max(2000),
});

export const waitlistJoinBodySchema = z.object({
  email: z.string().email().max(255),
});

export const meUpdateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  track: z.enum(["k_culture", "topik"]).optional(),
  dailyGoalMinutes: z.number().int().min(1).max(180).optional(),
  onboardingCompleted: z.boolean().optional(),
});
