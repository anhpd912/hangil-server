// Adapter: Groq (host Llama 3) — OpenAI-compatible API
import OpenAI from "openai";
import type { AiProvider, ChatCompletionParams } from "../provider.js";
import type { Result } from "../../../lib/result.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return client;
}

export const groqProvider: AiProvider = {
  async complete({ system, user, maxTokens }: ChatCompletionParams): Promise<Result<string>> {
    try {
      const completion = await getClient().chat.completions.create({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        return { ok: false, error: "Groq trả về kết quả rỗng" };
      }
      return { ok: true, data: text };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Lỗi không xác định khi gọi Groq API",
      };
    }
  },
};
