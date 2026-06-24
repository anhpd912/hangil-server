// Service AI duy nhất — route/service khác chỉ gọi checkJournal()/generateContextFillQuestions()/
// generateSpeedQuizQuestions(), không biết provider nào đang chạy.
// Đổi nhà cung cấp: sửa AI_PROVIDER trong .env, không cần sửa code.
import type { z } from "zod";
import type { AiProvider } from "./provider.js";
import { anthropicProvider } from "./providers/anthropic-provider.js";
import { groqProvider } from "./providers/groq-provider.js";
import type { Result } from "../../lib/result.js";
import type { LearnedWord } from "../games/select-words.js";
import {
  contextFillQuestionsSchema,
  speedQuizQuestionsSchema,
  type contextFillQuestionSchema,
  type speedQuizQuestionSchema,
} from "../../lib/validators.js";

export type JournalCorrection = {
  original: string;
  corrected: string;
  explanation_vi: string;
};

export type JournalFeedback = {
  corrections: JournalCorrection[];
  suggestions: string[];
  score: number;
};

const SYSTEM_PROMPT = `Bạn là giáo viên tiếng Hàn người Việt.
Chấm bài tiếng Hàn, trả về JSON với:
corrections: [{original, corrected, explanation_vi}]
suggestions: string[]
score: number (0-100)`;

const providers: Record<string, AiProvider> = {
  anthropic: anthropicProvider,
  groq: groqProvider,
};

function getProvider(): AiProvider {
  const name = process.env.AI_PROVIDER ?? "anthropic";
  const provider = providers[name];
  if (!provider) {
    throw new Error(`AI_PROVIDER không hợp lệ: "${name}". Chọn 1 trong: ${Object.keys(providers).join(", ")}`);
  }
  return provider;
}

export async function checkJournal(text: string): Promise<Result<JournalFeedback>> {
  const result = await getProvider().complete({
    system: SYSTEM_PROMPT,
    user: text,
    maxTokens: 1000,
  });

  if (!result.ok) {
    return result;
  }

  try {
    const feedback = JSON.parse(result.data) as JournalFeedback;
    return { ok: true, data: feedback };
  } catch {
    return { ok: false, error: "Không parse được JSON trả về từ AI provider" };
  }
}

export type ContextFillQuestion = z.infer<typeof contextFillQuestionSchema>;
export type SpeedQuizQuestion = z.infer<typeof speedQuizQuestionSchema>;

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
}

function buildWordList(words: LearnedWord[]): string {
  return JSON.stringify(words.map((w) => ({ vocabId: w.vocabId, korean: w.korean, vietnamese: w.vietnamese })));
}

async function generateValidatedQuestions<T extends { vocabId: string }>(params: {
  system: string;
  userContent: string;
  schema: z.ZodType<T[]>;
  validVocabIds: Set<string>;
  expectedCount: number;
}): Promise<Result<T[]>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await getProvider().complete({
      system: params.system,
      user: params.userContent,
      maxTokens: 2500,
    });
    if (!result.ok) continue;

    try {
      const parsed = JSON.parse(stripJsonFences(result.data));
      const validated = params.schema.parse(parsed);
      if (validated.length !== params.expectedCount) continue;
      if (!validated.every((q) => params.validVocabIds.has(q.vocabId))) continue;
      return { ok: true, data: validated };
    } catch {
      continue;
    }
  }
  return { ok: false, error: "AI không trả về câu hỏi hợp lệ sau khi retry" };
}

const CONTEXT_FILL_SYSTEM = (count: number) => `Bạn là giáo viên tiếng Hàn cho người Việt. Với danh sách từ vựng cho sẵn (JSON: [{vocabId, korean, vietnamese}]), tạo CHÍNH XÁC ${count} câu hỏi điền từ — mỗi câu hỏi dùng đúng 1 từ trong danh sách.

Yêu cầu mỗi câu hỏi:
- Đặt từ mục tiêu trong 1 câu tiếng Hàn tự nhiên, đời thường, đúng ngữ pháp, phù hợp người mới học (sơ-trung cấp).
- Thay từ mục tiêu bằng chuỗi "[...]" trong câu.
- Đưa ra 4 lựa chọn tiếng Hàn (gồm đúng 1 đáp án đúng là từ mục tiêu). 3 lựa chọn sai phải là từ/cụm từ THẬT trong tiếng Hàn, dễ nhầm về nghĩa hoặc ngữ pháp với đáp án đúng — không dùng từ vô nghĩa hoặc quá khác biệt khiến đoán được ngay.
- CHỈ dùng từ trong danh sách được cho làm đáp án đúng — không tự thêm từ vựng mới ngoài danh sách.
- Giữ đúng "vocabId" tương ứng với từ mục tiêu, copy nguyên văn từ input.

Trả về JSON THUẦN, không markdown, không giải thích, không text thừa. Đúng format mảng:
[{"vocabId":"...","sentenceKo":"... [...] ...","translationVi":"...","options":["...","...","...","..."],"correctIndex":0}]`;

const SPEED_QUIZ_SYSTEM = (count: number) => `Bạn là giáo viên tiếng Hàn cho người Việt. Với danh sách từ vựng cho sẵn (JSON: [{vocabId, korean, vietnamese}]), tạo CHÍNH XÁC ${count} câu hỏi trắc nghiệm tốc độ — mỗi câu hỏi dùng đúng 1 từ trong danh sách.

Yêu cầu mỗi câu hỏi:
- Cho từ tiếng Hàn của 1 mục trong danh sách, người học chọn nghĩa tiếng Việt đúng trong 4 lựa chọn.
- 1 lựa chọn đúng là nghĩa tiếng Việt thật của từ đó (lấy từ field "vietnamese" trong input).
- 3 lựa chọn sai phải là nghĩa THẬT của các từ tiếng Hàn khác (không bịa nghĩa giả), cùng chủ đề hoặc sắc thái gần với đáp án đúng để có độ khó vừa phải — tránh quá dễ đoán bằng loại trừ.
- Giữ đúng "vocabId" tương ứng với từ đang hỏi, copy nguyên văn từ input.

Trả về JSON THUẦN, không markdown, không giải thích, không text thừa. Đúng format mảng:
[{"vocabId":"...","korean":"...","options":["...","...","...","..."],"correctIndex":0}]`;

export async function generateContextFillQuestions(words: LearnedWord[]): Promise<Result<ContextFillQuestion[]>> {
  return generateValidatedQuestions({
    system: CONTEXT_FILL_SYSTEM(words.length),
    userContent: buildWordList(words),
    schema: contextFillQuestionsSchema,
    validVocabIds: new Set(words.map((w) => w.vocabId)),
    expectedCount: words.length,
  });
}

export async function generateSpeedQuizQuestions(words: LearnedWord[]): Promise<Result<SpeedQuizQuestion[]>> {
  return generateValidatedQuestions({
    system: SPEED_QUIZ_SYSTEM(words.length),
    userContent: buildWordList(words),
    schema: speedQuizQuestionsSchema,
    validVocabIds: new Set(words.map((w) => w.vocabId)),
    expectedCount: words.length,
  });
}
