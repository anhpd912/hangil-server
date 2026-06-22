// Zod schemas cho /api/v1/admin/* routes
import { z } from "zod";
import { lessonContentSchema } from "./validators.js";

const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const adminUsersListQuerySchema = z.object({
  search: z.string().optional(),
  ...paginationSchema,
});

export const adminWaitlistListQuerySchema = z.object(paginationSchema);

export const adminUserPatchBodySchema = z.object({
  plan: z.enum(["free", "pro"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export const adminLessonCreateBodySchema = z.object({
  titleVi: z.string().min(1),
  titleKo: z.string().min(1),
  track: z.enum(["k_culture", "topik"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  orderIndex: z.number().int().min(0).default(0),
  content: lessonContentSchema.optional(),
});

export const adminLessonPatchBodySchema = adminLessonCreateBodySchema.partial();

export const adminLessonPublishBodySchema = z.object({
  isPublished: z.boolean(),
});

export const adminVocabularyCreateBodySchema = z.object({
  lessonId: z.string().uuid(),
  korean: z.string().min(1),
  romanization: z.string().min(1),
  vietnamese: z.string().min(1),
  exampleSentenceKo: z.string().optional(),
  exampleSentenceVi: z.string().optional(),
  audioUrl: z.string().url().optional(),
});

export const adminVocabularyPatchBodySchema = adminVocabularyCreateBodySchema
  .omit({ lessonId: true })
  .partial();

export const adminVocabularyBulkCreateBodySchema = z.object({
  lessonId: z.string().uuid(),
  // Mỗi dòng: korean|romanization|vietnamese (pipe-separated), parse từ 1 text block
  text: z.string().min(1),
});
