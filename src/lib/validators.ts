// Zod schemas dùng chung cho request validation
import { z } from "zod";

export const lessonsQuerySchema = z.object({
  track: z.enum(["k_culture", "topik"]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
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
