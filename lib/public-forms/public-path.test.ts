import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Public Forms path allowlist", () => {
  it("adds /forms as a public prefix distinct from /form", () => {
    const proxy = readFileSync(join(process.cwd(), "integrations/supabase/proxy.ts"), "utf8");
    assert.match(proxy, /"\/forms"/);
    assert.match(proxy, /"\/form"/);
    assert.match(proxy, /purpose-specific Public Forms/);
    // Exact entries — /forms is not accidentally folded into /form.
    assert.match(proxy, /\/form",\s*\/\/ public venue inquiry/);
    assert.match(proxy, /\/forms",\s*\/\/ purpose-specific/);
  });
});
