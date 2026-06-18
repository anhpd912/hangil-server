// Service AI duy nhất — route/service khác chỉ gọi checkJournal(), không biết provider nào đang chạy.
// Đổi nhà cung cấp: sửa AI_PROVIDER trong .env, không cần sửa code.
import type { AiProvider } from "./provider.js";
import { anthropicProvider } from "./providers/anthropic-provider.js";
import { groqProvider } from "./providers/groq-provider.js";
import type { Result } from "../../lib/result.js";

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
