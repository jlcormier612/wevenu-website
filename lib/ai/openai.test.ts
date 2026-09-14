import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import {
  isOpenAiConfigured,
  openAiChatCompletion,
  OPENAI_CHAT_COMPLETIONS_URL,
  OPENAI_MODEL_DEFAULT,
  OPENAI_MODEL_FAST,
  requireOpenAiApiKey,
} from "@/lib/ai/openai";

const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  mock.restoreAll();
});

describe("lib/ai/openai helper", () => {
  it("exports the documented model IDs", () => {
    assert.equal(OPENAI_MODEL_DEFAULT, "gpt-5.6-terra");
    assert.equal(OPENAI_MODEL_FAST, "gpt-5.6-luna");
    assert.equal(OPENAI_CHAT_COMPLETIONS_URL, "https://api.openai.com/v1/chat/completions");
  });

  it("isOpenAiConfigured reflects OPENAI_API_KEY", () => {
    delete process.env.OPENAI_API_KEY;
    assert.equal(isOpenAiConfigured(), false);
    process.env.OPENAI_API_KEY = "  sk-test  ";
    assert.equal(isOpenAiConfigured(), true);
  });

  it("requireOpenAiApiKey throws when missing", () => {
    delete process.env.OPENAI_API_KEY;
    assert.throws(() => requireOpenAiApiKey(), /OPENAI_API_KEY is not configured/);
  });

  it("posts Bearer auth, max_completion_tokens, and reasoning_effort none by default", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const fetchMock = mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), OPENAI_CHAT_COMPLETIONS_URL);
      assert.equal(init?.method, "POST");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer sk-test-key");
      assert.equal(headers["Content-Type"], "application/json");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, OPENAI_MODEL_DEFAULT);
      assert.equal(body.max_completion_tokens, 512);
      assert.equal(body.reasoning_effort, "none");
      assert.deepEqual(body.messages, [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ]);
      assert.equal(body.stream, undefined);
      assert.equal(body.tools, undefined);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "  hello world  " } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const text = await openAiChatCompletion({
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      maxCompletionTokens: 512,
    });
    assert.equal(text, "hello world");
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("uses the fast model when requested", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, OPENAI_MODEL_FAST);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "ok" } }],
      }), { status: 200 });
    });
    const text = await openAiChatCompletion({
      model: OPENAI_MODEL_FAST,
      messages: [{ role: "user", content: "x" }],
      maxCompletionTokens: 100,
    });
    assert.equal(text, "ok");
  });

  it("throws a friendly timeout error", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    mock.method(globalThis, "fetch", async () => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    });
    await assert.rejects(
      () => openAiChatCompletion({
        messages: [{ role: "user", content: "x" }],
        maxCompletionTokens: 10,
        timeoutMs: 25_000,
      }),
      /AI request timed out/,
    );
  });

  it("never logs or returns the API key on HTTP errors", async () => {
    process.env.OPENAI_API_KEY = "sk-secret-should-not-leak";
    mock.method(globalThis, "fetch", async () =>
      new Response("upstream boom", { status: 500 }),
    );
    await assert.rejects(
      () => openAiChatCompletion({
        messages: [{ role: "user", content: "x" }],
        maxCompletionTokens: 10,
      }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /OpenAI API error 500/);
        assert.doesNotMatch(err.message, /sk-secret-should-not-leak/);
        return true;
      },
    );
  });
});
