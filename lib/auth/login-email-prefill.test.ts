import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { safeLoginEmailPrefill } from "./login-email-prefill";

describe("safeLoginEmailPrefill", () => {
  it("accepts a normal invited email and rejects unsafe values", () => {
    assert.equal(safeLoginEmailPrefill("jyagnesak@yahoo.com"), "jyagnesak@yahoo.com");
    assert.equal(safeLoginEmailPrefill("  Jen@Venue.COM "), "jen@venue.com");
    assert.equal(safeLoginEmailPrefill("not-an-email"), undefined);
    assert.equal(safeLoginEmailPrefill("javascript:alert(1)"), undefined);
    assert.equal(safeLoginEmailPrefill(""), undefined);
  });

  it("login page and form only prefill, they do not change identity checks", () => {
    const loginPage = readFileSync(join(process.cwd(), "app/(auth)/login/page.tsx"), "utf8");
    const loginForm = readFileSync(join(process.cwd(), "components/auth/login-form.tsx"), "utf8");
    assert.match(loginPage, /safeLoginEmailPrefill/);
    assert.match(loginPage, /defaultEmail/);
    assert.match(loginForm, /defaultEmail/);
    assert.match(loginForm, /defaultValue=\{defaultEmail\}/);
  });
});
