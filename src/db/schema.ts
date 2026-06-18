// Drizzle schema — source of truth. Better Auth tables (user/session/account/verification)
// live in auth-schema.ts (generated via `npx @better-auth/cli generate`); app tables below.
import {
  pgTable,
  text,
  uuid,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

export { user, session, account, verification } from "./auth-schema.js";

export const trackEnum = pgEnum("track", ["k_culture", "topik"]);
export const levelEnum = pgEnum("level", ["beginner", "intermediate", "advanced"]);

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  titleVi: text("title_vi").notNull(),
  titleKo: text("title_ko").notNull(),
  track: trackEnum("track").notNull(),
  level: levelEnum("level").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  content: jsonb("content"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vocabulary = pgTable("vocabulary", {
  id: uuid("id").primaryKey().defaultRandom(),
  korean: text("korean").notNull(),
  romanization: text("romanization").notNull(),
  vietnamese: text("vietnamese").notNull(),
  exampleSentenceKo: text("example_sentence_ko"),
  exampleSentenceVi: text("example_sentence_vi"),
  audioUrl: text("audio_url"),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userCards = pgTable("user_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  vocabId: uuid("vocab_id")
    .notNull()
    .references(() => vocabulary.id, { onDelete: "cascade" }),
  easiness: real("easiness").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(1),
  nextReviewAt: timestamp("next_review_at").notNull().defaultNow(),
  lastReviewedAt: timestamp("last_reviewed_at"),
});

export const userProgress = pgTable("user_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at"),
  score: integer("score"),
});

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  contentKo: text("content_ko").notNull(),
  aiFeedback: jsonb("ai_feedback"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const waitlistEntries = pgTable("waitlist_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
