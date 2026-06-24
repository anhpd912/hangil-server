// Routes: POST /games/{mode}/generate, POST /games/:mode/submit — 3 mode ôn tập: matching (không AI),
// context-fill, speed-quiz. Free: câu hỏi sinh không cần AI (deterministic). Pro: AI sinh câu hỏi,
// giới hạn PRO_AI_GAME_DAILY_LIMIT lần/ngày — hết quota hoặc AI lỗi thì fallback im lặng về bản
// deterministic, không hiện lỗi cho user. Trả lời sai = SRS grade 0 (Lại).
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { userCards } from "../db/schema.js";
import { calculateNextReview } from "../services/srs.js";
import { selectLearnedWords, GAME_QUESTION_COUNT, type LearnedWord } from "../services/games/select-words.js";
import { buildContextFillQuestions, buildSpeedQuizQuestions } from "../services/games/deterministic-questions.js";
import {
  generateContextFillQuestions,
  generateSpeedQuizQuestions,
  type ContextFillQuestion,
  type SpeedQuizQuestion,
} from "../services/ai/index.js";
import { requireAuth } from "../lib/require-auth.js";
import { checkRateLimit, redis } from "../plugins/ratelimit.js";
import { gameSubmitBodySchema } from "../lib/validators.js";
import { AppError } from "../lib/errors.js";

const GAME_SESSION_TTL_SECONDS = 30 * 60;
const PRO_AI_GAME_DAILY_LIMIT = 5;

async function getContextFillQuestions(userId: string, plan: string | undefined, words: LearnedWord[]): Promise<ContextFillQuestion[]> {
  if (plan === "pro") {
    try {
      await checkRateLimit(`ai-game:${userId}`, PRO_AI_GAME_DAILY_LIMIT, "1 d");
      const result = await generateContextFillQuestions(words);
      if (result.ok) return result.data;
    } catch {
      // hết quota AI hôm nay hoặc AI lỗi — fallback im lặng, không hiện lỗi cho user
    }
  }
  return buildContextFillQuestions(words);
}

async function getSpeedQuizQuestions(userId: string, plan: string | undefined, words: LearnedWord[]): Promise<SpeedQuizQuestion[]> {
  if (plan === "pro") {
    try {
      await checkRateLimit(`ai-game:${userId}`, PRO_AI_GAME_DAILY_LIMIT, "1 d");
      const result = await generateSpeedQuizQuestions(words);
      if (result.ok) return result.data;
    } catch {
      // hết quota AI hôm nay hoặc AI lỗi — fallback im lặng, không hiện lỗi cho user
    }
  }
  return buildSpeedQuizQuestions(words);
}

type GameQuestionEntry = { vocabId: string; cardId: string; correctIndex: number };
type GameSession =
  | { mode: "matching"; userId: string; cards: { vocabId: string; cardId: string }[] }
  | { mode: "context-fill" | "speed-quiz"; userId: string; questions: GameQuestionEntry[] };

function sessionKey(sessionId: string): string {
  return `game:${sessionId}`;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

async function ensureEnoughWords(userId: string): Promise<LearnedWord[]> {
  const words = await selectLearnedWords(userId);
  if (words.length < GAME_QUESTION_COUNT) {
    throw new AppError("Cần học thêm từ vựng để chơi trò chơi này (tối thiểu 10 từ đã học)", "NOT_ENOUGH_WORDS", 400);
  }
  return words;
}

const gamesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/games/matching/generate", { preHandler: requireAuth }, async (request, reply) => {
    const words = await ensureEnoughWords(request.user!.id);
    const sessionId = randomUUID();

    const session: GameSession = {
      mode: "matching",
      userId: request.user!.id,
      cards: words.map((w) => ({ vocabId: w.vocabId, cardId: w.cardId })),
    };
    await redis.set(sessionKey(sessionId), session, { ex: GAME_SESSION_TTL_SECONDS });

    return reply.send({
      success: true,
      data: {
        sessionId,
        koreanCards: shuffle(words.map((w) => ({ vocabId: w.vocabId, korean: w.korean }))),
        vietnameseCards: shuffle(words.map((w) => ({ vocabId: w.vocabId, vietnamese: w.vietnamese }))),
      },
    });
  });

  fastify.post("/games/context-fill/generate", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const words = await ensureEnoughWords(userId);
    const questions = await getContextFillQuestions(userId, request.user!.plan, words);

    const cardIdByVocabId = new Map(words.map((w) => [w.vocabId, w.cardId]));
    const sessionId = randomUUID();
    const session: GameSession = {
      mode: "context-fill",
      userId,
      questions: questions.map((q) => ({
        vocabId: q.vocabId,
        cardId: cardIdByVocabId.get(q.vocabId)!,
        correctIndex: q.correctIndex,
      })),
    };
    await redis.set(sessionKey(sessionId), session, { ex: GAME_SESSION_TTL_SECONDS });

    return reply.send({
      success: true,
      data: {
        sessionId,
        questions: questions.map(({ vocabId, sentenceKo, translationVi, options }) => ({
          vocabId,
          sentenceKo,
          translationVi,
          options,
        })),
      },
    });
  });

  fastify.post("/games/speed-quiz/generate", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const words = await ensureEnoughWords(userId);
    const questions = await getSpeedQuizQuestions(userId, request.user!.plan, words);

    const cardIdByVocabId = new Map(words.map((w) => [w.vocabId, w.cardId]));
    const sessionId = randomUUID();
    const session: GameSession = {
      mode: "speed-quiz",
      userId,
      questions: questions.map((q) => ({
        vocabId: q.vocabId,
        cardId: cardIdByVocabId.get(q.vocabId)!,
        correctIndex: q.correctIndex,
      })),
    };
    await redis.set(sessionKey(sessionId), session, { ex: GAME_SESSION_TTL_SECONDS });

    return reply.send({
      success: true,
      data: {
        sessionId,
        questions: questions.map(({ vocabId, korean, options }) => ({ vocabId, korean, options })),
      },
    });
  });

  fastify.post("/games/:mode/submit", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = gameSubmitBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Body không hợp lệ", code: "VALIDATION_ERROR" });
    }

    const session = await redis.get<GameSession>(sessionKey(parsed.data.sessionId));
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: "Session đã hết hạn hoặc không tồn tại",
        code: "SESSION_NOT_FOUND",
      });
    }
    await redis.del(sessionKey(parsed.data.sessionId)); // single-use — chấm xong là xoá

    if (session.userId !== request.user!.id) {
      return reply.status(403).send({ success: false, error: "Không có quyền truy cập session này", code: "FORBIDDEN" });
    }

    const results: { vocabId: string; correct: boolean }[] = [];
    const wrongCardIds: string[] = [];

    if (session.mode === "matching") {
      for (const card of session.cards) {
        const answer = parsed.data.answers.find((a) => a.vocabId === card.vocabId);
        const isCorrect = answer?.matchedVocabId === card.vocabId;
        if (!isCorrect) wrongCardIds.push(card.cardId);
        results.push({ vocabId: card.vocabId, correct: isCorrect });
      }
    } else {
      for (const q of session.questions) {
        const answer = parsed.data.answers.find((a) => a.vocabId === q.vocabId);
        const isCorrect = answer?.selectedIndex === q.correctIndex;
        if (!isCorrect) wrongCardIds.push(q.cardId);
        results.push({ vocabId: q.vocabId, correct: isCorrect });
      }
    }

    if (wrongCardIds.length > 0) {
      const wrongCards = await db.select().from(userCards).where(inArray(userCards.id, wrongCardIds));
      await Promise.all(
        wrongCards.map((card) => {
          const next = calculateNextReview(
            { easiness: card.easiness, repetitions: card.repetitions, intervalDays: card.intervalDays },
            0,
          );
          return db
            .update(userCards)
            .set({
              easiness: next.easiness,
              repetitions: next.repetitions,
              intervalDays: next.intervalDays,
              nextReviewAt: next.nextReviewAt,
              lastReviewedAt: new Date(),
            })
            .where(eq(userCards.id, card.id));
        }),
      );
    }

    const correctCount = results.filter((r) => r.correct).length;
    const total = results.length;

    return reply.send({
      success: true,
      data: {
        score: correctCount * 100,
        accuracy: total > 0 ? Math.round((correctCount / total) * 100) : 0,
        results,
      },
    });
  });
};

export default gamesRoutes;
