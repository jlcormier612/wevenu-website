import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("existing-user activation password UX", () => {
  const byToken = readFileSync(
    join(process.cwd(), "app/api/internal/enrollment/by-token/route.ts"),
    "utf8",
  );
  const activate = readFileSync(
    join(process.cwd(), "app/api/internal/enrollment/activate/route.ts"),
    "utf8",
  );
  const helper = readFileSync(
    join(process.cwd(), "lib/activation/existing-login.ts"),
    "utf8",
  );

  it("by-token reports alreadyHasLogin without creating an auth user", () => {
    assert.match(byToken, /purchaserAlreadyHasLogin/);
    assert.match(byToken, /alreadyHasLogin/);
    assert.doesNotMatch(byToken, /resolveUserIdForEmail/);
    assert.match(helper, /findExistingAuthUserIdByEmail/);
    assert.doesNotMatch(helper, /createUser/);
  });

  it("activate still skips password storage and only requires a password for new logins", () => {
    assert.match(activate, /if \(!alreadyHasLogin && password\.length < 8\)/);
    assert.match(activate, /if \(!alreadyHasLogin\) \{/);
    assert.match(activate, /admin\.auth\.admin\.updateUserById\(userId, \{ password \}\)/);
    const skip = activate.indexOf("if (!alreadyHasLogin) {");
    const update = activate.indexOf("updateUserById");
    assert.ok(skip > 0 && skip < update);
  });
});
