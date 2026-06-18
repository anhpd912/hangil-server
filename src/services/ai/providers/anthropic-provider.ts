// Adapter: Anthropic Claude (claude-haiku-4-5)
import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, ChatCompletionParams } from "../provider.js";
import type { Result } from "../../../lib/result.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const anthropicProvider: AiProvider = {
  async complete({ system, user, maxTokens }: ChatCompletionParams): Promise<Result<string>> {
    try {
      const message = await getClient().messages.create({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });

      const block = message.content[0];
      if (block.type !== "text") {
        return { ok: false, error: "Anthropic trả về kết quả không phải dạng text" };
      }
      return { ok: true, data: block.text };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Lỗi không xác định khi gọi Anthropic API",
      };
    }
  },
};
