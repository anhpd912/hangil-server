// Interface chung cho mọi AI provider — đổi nhà cung cấp chỉ cần thêm 1 adapter mới ở đây
import type { Result } from "../../lib/result.js";

export type ChatCompletionParams = {
  system: string;
  user: string;
  maxTokens: number;
};

export interface AiProvider {
  complete(params: ChatCompletionParams): Promise<Result<string>>;
}
