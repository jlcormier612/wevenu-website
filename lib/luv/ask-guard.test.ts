import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  checkLuvAskRateLimit,
  isLuvAskQuestionTooLong,
  LUV_ASK_MAX_PER_IP,
  LUV_ASK_MAX_PER_TOKEN,
  LUV_ASK_MAX_QUESTION_CHARS,
  LUV_ASK_WINDOW_MS,
  luvAskClientIp,
  resetLuvAskRateLimitForTests,
} from "@/lib/luv/ask-guard";

afterEach(() => {
  resetLuvAskRateLimitForTests();
});

describe("isLuvAskQuestionTooLong", () => {
  it("allows questions at the cap and rejects longer ones", () => {
    assert.equal(isLuvAskQuestionTooLong("a".repeat(LUV_ASK_MAX_QUESTION_CHARS)), false);
    assert.equal(isLuvAskQuestionTooLong("a".repeat(LUV_ASK_MAX_QUESTION_CHARS + 1)), true);
    assert.equal(isLuvAskQuestionTooLong(`  ${"a".repeat(LUV_ASK_MAX_QUESTION_CHARS)}  `), false);
  });
});

describe("checkLuvAskRateLimit", () => {
  it("allows a normal couple burst then blocks the same token", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < LUV_ASK_MAX_PER_TOKEN; i++) {
      const result = checkLuvAskRateLimit({ token: "portal-token-a", ip: "1.1.1.1", now: now + i });
      assert.equal(result.allowed, true);
    }
    const blocked = checkLuvAskRateLimit({
      token: "portal-token-a",
      ip: "1.1.1.1",
      now: now + LUV_ASK_MAX_PER_TOKEN,
    });
    assert.equal(blocked.allowed, false);
  });

  it("does not block a different portal token", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < LUV_ASK_MAX_PER_TOKEN; i++) {
      checkLuvAskRateLimit({ token: "token-a", ip: "9.9.9.9", now: now + i });
    }
    const other = checkLuvAskRateLimit({ token: "token-b", ip: "8.8.8.8", now: now + 50 });
    assert.equal(other.allowed, true);
  });

  it("blocks an IP that exceeds the window even across tokens", () => {
    const now = 1_700_000_000_000;
    const ip = "203.0.113.10";
    for (let i = 0; i < LUV_ASK_MAX_PER_IP; i++) {
      const result = checkLuvAskRateLimit({ token: `t-${i}`, ip, now: now + i });
      assert.equal(result.allowed, true);
    }
    const blocked = checkLuvAskRateLimit({ token: "t-overflow", ip, now: now + LUV_ASK_MAX_PER_IP });
    assert.equal(blocked.allowed, false);
  });

  it("allows the same token again after the window slides", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < LUV_ASK_MAX_PER_TOKEN; i++) {
      checkLuvAskRateLimit({ token: "slide", ip: null, now: now + i });
    }
    const stillBlocked = checkLuvAskRateLimit({ token: "slide", ip: null, now: now + 100 });
    assert.equal(stillBlocked.allowed, false);
    const afterWindow = checkLuvAskRateLimit({
      token: "slide",
      ip: null,
      now: now + LUV_ASK_WINDOW_MS + 1,
    });
    assert.equal(afterWindow.allowed, true);
  });
});

describe("luvAskClientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    const request = new Request("https://example.com/api/portal/luv-ask", {
      headers: {
        "x-forwarded-for": "203.0.113.1, 10.0.0.1",
        "x-real-ip": "10.0.0.1",
      },
    });
    assert.equal(luvAskClientIp(request), "203.0.113.1");
  });
});
