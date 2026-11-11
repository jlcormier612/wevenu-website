import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { hasCapability } from "@/lib/authorization/resolve";
import { presetHas } from "@/lib/authorization/presets";
import type { MembershipAccessInput } from "@/lib/authorization/types";
import {
  isSealedQuickBooksToken,
  openQuickBooksToken,
  QuickBooksTokenDecryptError,
  sealQuickBooksToken,
} from "@/lib/quickbooks/token-crypto";

const SYNTHETIC_ACCESS = "synthetic-access-token-not-a-real-credential";
const SYNTHETIC_REFRESH = "synthetic-refresh-token-not-a-real-credential";

function member(partial: Partial<MembershipAccessInput> & Pick<MembershipAccessInput, "accessTitle">): MembershipAccessInput {
  return {
    isActive: true,
    isOwner: false,
    titleBasis: partial.accessTitle === "custom" ? "staff" : partial.accessTitle,
    overrides: {},
    ...partial,
  };
}

describe("QuickBooks token sealing", () => {
  it("round-trips a synthetic token and does not persist the plaintext form", () => {
    const sealed = sealQuickBooksToken(SYNTHETIC_ACCESS);
    assert.equal(isSealedQuickBooksToken(sealed), true);
    assert.equal(sealed.includes(SYNTHETIC_ACCESS), false);
    assert.equal(openQuickBooksToken(sealed), SYNTHETIC_ACCESS);
    assert.notEqual(sealQuickBooksToken(SYNTHETIC_REFRESH), SYNTHETIC_REFRESH);
  });

  it("reads a legacy plaintext row without rewriting it", () => {
    const legacy = "legacy-plaintext-refresh-token";
    assert.equal(isSealedQuickBooksToken(legacy), false);
    assert.equal(openQuickBooksToken(legacy), legacy);
  });

  it("refuses to seal an empty token", () => {
    assert.throws(() => sealQuickBooksToken("   "), /empty QuickBooks token/);
  });

  it("fails closed on malformed ciphertext without echoing it or looking like expiry", () => {
    const malformed = "v1:not-valid:also-not:nope";
    assert.throws(
      () => openQuickBooksToken(malformed),
      (err: unknown) => {
        assert.ok(err instanceof QuickBooksTokenDecryptError);
        assert.equal(err.code, "quickbooks_token_decrypt_failed");
        assert.equal(err.message.includes(malformed), false);
        assert.equal(/expired|refresh token/i.test(err.message), false);
        return true;
      },
    );
  });

  it("does not treat a tampered sealed token as plaintext", () => {
    const sealed = sealQuickBooksToken(SYNTHETIC_ACCESS);
    const tampered = `${sealed.slice(0, -2)}aa`;
    assert.throws(() => openQuickBooksToken(tampered), QuickBooksTokenDecryptError);
  });
});

describe("QuickBooks connection authorization and storage wiring", () => {
  const service = readFileSync("lib/quickbooks/service.ts", "utf8");
  const repository = readFileSync("lib/quickbooks/repository.ts", "utf8");
  const client = readFileSync("lib/quickbooks/client.ts", "utf8");
  const callback = readFileSync("app/api/quickbooks/callback/route.ts", "utf8");

  function body(source: string, name: string): string {
    const start = source.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, name);
    const next = source.indexOf("\nexport ", start + 1);
    return source.slice(start, next === -1 ? undefined : next);
  }

  it("connection-management actions require settings.integrations before any write", () => {
    for (const name of [
      "selectQuickBooksIncomeAccount",
      "connectQuickBooksAccount",
      "disconnectQuickBooksAccount",
      "retryQuickBooksSync",
    ]) {
      const fn = body(service, name);
      const gate = fn.indexOf("denyWithoutIntegrationsAccess");
      assert.ok(gate > -1, `${name} missing capability gate`);
      assert.match(fn, /getCurrentVenue\(\)/);
      assert.equal(fn.includes("venueId:"), false);
    }
    assert.match(service, /requireCapability\(\s*"settings\.integrations"/);
  });

  it("does not grant settings.integrations to manager, coordinator, staff, or view-only presets", () => {
    assert.equal(presetHas("administrator", "settings.integrations"), true);
    assert.equal(presetHas("manager", "settings.integrations"), false);
    assert.equal(presetHas("coordinator", "settings.integrations"), false);
    assert.equal(presetHas("staff", "settings.integrations"), false);
    assert.equal(presetHas("view_only", "settings.integrations"), false);

    assert.equal(
      hasCapability(member({ accessTitle: "administrator", isOwner: true }), "settings.integrations"),
      true,
    );
    assert.equal(hasCapability(member({ accessTitle: "manager" }), "settings.integrations"), false);
    assert.equal(hasCapability(member({ accessTitle: "staff" }), "settings.integrations"), false);
    assert.equal(
      hasCapability(
        member({
          accessTitle: "custom",
          titleBasis: "staff",
          overrides: { "settings.integrations": true },
        }),
        "settings.integrations",
      ),
      false,
    );
    assert.equal(
      hasCapability(
        member({
          accessTitle: "administrator",
          overrides: { "settings.integrations": false },
        }),
        "settings.integrations",
      ),
      false,
    );
  });

  it("seals tokens on write and opens them only on the token-bearing read", () => {
    assert.match(repository, /sealQuickBooksToken\(input\.accessToken\)/);
    assert.match(repository, /sealQuickBooksToken\(input\.refreshToken\)/);
    const withTokens = repository.slice(repository.indexOf("function mapConnectionWithTokens"));
    assert.match(withTokens, /openQuickBooksToken\(r\.access_token\)/);
    assert.match(withTokens, /openQuickBooksToken\(r\.refresh_token\)/);
    const publicMap = repository.slice(
      repository.indexOf("function mapConnection"),
      repository.indexOf("function mapConnectionWithTokens"),
    );
    assert.equal(publicMap.includes("openQuickBooksToken"), false);
    assert.equal(publicMap.includes("accessToken"), false);
  });

  it("a decrypt failure does not mark the refresh token dead or clear stored credentials", () => {
    const tokenFn = client.slice(client.indexOf("export async function getValidAccessToken"));
    assert.match(tokenFn, /QuickBooksTokenDecryptError/);
    assert.match(tokenFn, /credentialUnreadable: true/);
    assert.match(tokenFn, /refreshTokenDead: false/);
    const fetchFn = client.slice(client.indexOf("export async function quickBooksFetch"));
    assert.match(fetchFn, /credentialUnreadable \? false/);
    const disconnect = body(service, "disconnectQuickBooksAccount");
    const decryptGuard = disconnect.indexOf("QuickBooksTokenDecryptError");
    const localClear = disconnect.indexOf("disconnectConnection");
    assert.ok(decryptGuard > -1 && localClear > decryptGuard);
    assert.equal(disconnect.includes("access_token: \"\""), false);
    assert.equal(disconnect.includes("refresh_token: \"\""), false);
  });

  it("the OAuth callback does not report success when connect is denied", () => {
    assert.match(callback, /if \(!connected\.ok\)/);
    assert.match(callback, /quickbooks_error/);
    const success = callback.indexOf('quickbooks_success');
    const denied = callback.indexOf("if (!connected.ok)");
    assert.ok(denied > -1 && success > denied);
  });
});
