/**
 * Workspace login password show/hide toggle — source contract (UI-only).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  activatePasswordInputType,
  activatePasswordToggleLabel,
} from "./activate-account-form";

const here = dirname(fileURLToPath(import.meta.url));
const formSrc = readFileSync(join(here, "../../components/team/login-form.tsx"), "utf8");

describe("workspace login password toggle", () => {
  it("defaults to hidden and toggles input type", () => {
    assert.equal(activatePasswordInputType(false), "password");
    assert.equal(activatePasswordInputType(true), "text");
  });

  it("exposes accessible show/hide labels", () => {
    assert.equal(activatePasswordToggleLabel(false, "password"), "Show password");
    assert.equal(activatePasswordToggleLabel(true, "password"), "Hide password");
  });

  it("uses Lucide Eye/EyeOff, type=button, and does not remove from tab order", () => {
    assert.match(formSrc, /from "lucide-react"/);
    assert.match(formSrc, /\bEye\b/);
    assert.match(formSrc, /\bEyeOff\b/);
    assert.match(formSrc, /type="button"/);
    assert.match(formSrc, /aria-label=\{activatePasswordToggleLabel\(showPassword, "password"\)\}/);
    assert.doesNotMatch(formSrc, /tabIndex=\{-1\}/);
    assert.match(formSrc, /const \[showPassword, setShowPassword\] = useState\(false\)/);
    assert.match(formSrc, /pr-10/);
    assert.match(formSrc, /right-2\.5/);
  });

  it("does not alter loginAction / auth wiring", () => {
    assert.match(formSrc, /loginAction/);
    assert.match(formSrc, /useActionState\(loginAction/);
    assert.doesNotMatch(formSrc, /signInWithPassword/);
    assert.doesNotMatch(formSrc, /DEMO_LOGIN/);
  });
});
