/**
 * Shared OpenAI Chat Completions helper for the Venue app.
 *
 * Direct HTTPS to api.openai.com — no SDK, no Cursor/ChatGPT runtime dependency.
 * Callers keep their own prompts and parsers; this only owns auth + request shape.
 */

export const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions" as const;

/** Default model — replaces prior Claude Sonnet usage across Luv / intake / imports. */
export const OPENAI_MODEL_DEFAULT = "gpt-5.6-terra" as const;

/** Lower-cost model — replaces prior Claude Haiku usage on /api/luv/draft. */
export const OPENAI_MODEL_FAST = "gpt-5.6-luna" as const;

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenAiChatOptions = {
  /** Defaults to OPENAI_MODEL_DEFAULT. */
  model?: string;
  messages: OpenAiChatMessage[];
  /** Maps from former Anthropic max_tokens; sent as max_completion_tokens. */
  maxCompletionTokens: number;
  /**
   * Abort after this many ms. Pass the same values callers used before
   * (typically 25_000). Omit for no AbortSignal (matches older call sites).
   */
  timeoutMs?: number;
  /**
   * GPT-5.6 family supports none|low|medium|high|xhigh|max.
   * Default "none" keeps latency close to prior non-reasoning Claude calls.
   */
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
};

type OpenAiChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function requireOpenAiApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

/**
 * Chat Completions request. Returns the assistant message text (trimmed).
 * Throws on missing key, non-OK HTTP, timeout, or empty content.
 */
export async function openAiChatCompletion(options: OpenAiChatOptions): Promise<string> {
  const apiKey = requireOpenAiApiKey();
  const model = options.model ?? OPENAI_MODEL_DEFAULT;
  const reasoningEffort = options.reasoningEffort ?? "none";

  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      max_completion_tokens: options.maxCompletionTokens,
      reasoning_effort: reasoningEffort,
    }),
  };
  if (options.timeoutMs != null) {
    init.signal = AbortSignal.timeout(options.timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, init);
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("AI request timed out.");
    }
    throw err;
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as OpenAiChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("OpenAI API returned an empty completion.");
  }
  return text;
}
