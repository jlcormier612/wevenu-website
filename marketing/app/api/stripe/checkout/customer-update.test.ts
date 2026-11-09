import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Checkout security + customer_update contracts.
 *
 * Public marketing Checkout must never trust a client-supplied Stripe Customer
 * ID or relationship ID as authorization to reuse an existing Customer.
 * CRM-assisted Checkout reuses PRODUCT_SYNC_API_KEY Bearer (server-to-server).
 */
describe("checkout session — CRM auth + customer_update", () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const src = readFileSync(join(dir, "route.ts"), "utf8");
  const authSrc = readFileSync(
    join(dir, "../../../../lib/stripe/crm-checkout-auth.ts"),
    "utf8",
  );
  const lifecycleSrc = readFileSync(
    join(
      dir,
      "../../../../../workspace/app/api/relationships/lifecycle/route.ts",
    ),
    "utf8",
  );

  it("gates CRM privileges behind authorizeCrmAssistedCheckout + privilege resolver", () => {
    assert.match(src, /authorizeCrmAssistedCheckout\(request\)/);
    assert.match(src, /const crmAssisted = authorizeCrmAssistedCheckout/);
    assert.match(src, /resolveCrmCheckoutPrivileges/);
  });

  it("resolves privileges via resolveCrmCheckoutPrivileges and rejects unauth Customer reuse", () => {
    assert.match(src, /resolveCrmCheckoutPrivileges\(\{/);
    assert.match(src, /rejectedUnauthCustomerReuse/);
    assert.match(
      src,
      /Existing Stripe Customer reuse requires CRM authorization/,
    );
    assert.match(src, /status:\s*403/);
  });

  it("auth helper requires PRODUCT_SYNC_API_KEY Bearer with timingSafeEqual", () => {
    assert.match(authSrc, /PRODUCT_SYNC_API_KEY/);
    assert.match(authSrc, /timingSafeEqual/);
    assert.match(authSrc, /bearer /i);
  });

  it("CRM lifecycle Send Subscription Link sends Authorization Bearer", () => {
    const sendIdx = lifecycleSrc.indexOf('case "send_subscription_link"');
    assert.ok(sendIdx > 0, "send_subscription_link missing");
    const block = lifecycleSrc.slice(sendIdx, sendIdx + 2500);
    assert.match(block, /PRODUCT_SYNC_API_KEY/);
    assert.match(block, /Authorization:\s*`Bearer \$\{syncKey\}`/);
    assert.match(block, /stripe_customer_id:\s*relationship\.stripeCustomerId/);
    assert.match(block, /relationship_id:\s*relationship\.id/);
  });

  it("enables automatic_tax and tax_id_collection", () => {
    assert.match(src, /automatic_tax:\s*\{\s*enabled:\s*true\s*\}/);
    assert.match(src, /tax_id_collection:\s*\{\s*enabled:\s*true\s*\}/);
  });

  it("sets customer_update name+address auto only on authorized Customer path", () => {
    const customerBlockStart = src.indexOf("if (stripeCustomerId)");
    assert.ok(customerBlockStart > 0, "authorized customer branch missing");
    const customerBlock = src.slice(customerBlockStart, customerBlockStart + 400);
    assert.match(customerBlock, /sessionParams\.customer\s*=\s*stripeCustomerId/);
    assert.match(customerBlock, /sessionParams\.customer_update\s*=\s*\{/);
    assert.match(customerBlock, /name:\s*"auto"/);
    assert.match(customerBlock, /address:\s*"auto"/);
  });

  it("uses customer_email path without customer_update for public checkout", () => {
    assert.match(src, /sessionParams\.customer_email\s*=\s*customerEmail/);
    const emailIdx = src.indexOf("sessionParams.customer_email");
    const afterEmail = src.slice(emailIdx, emailIdx + 200);
    assert.doesNotMatch(afterEmail, /customer_update/);
  });

  it("preserves public legal + name gates when not CRM Path 2", () => {
    assert.match(src, /Please agree to the Terms of Service and Privacy Policy/);
    assert.match(
      src,
      /Please tell us your venue's name and your name to continue/,
    );
    assert.match(src, /if \(!isPath2 && !legalAccepted\)/);
    assert.match(
      src,
      /if \(!isPath2 && \(!venueName \|\| !ownerFirstName \|\| !ownerLastName\)\)/,
    );
  });

  it("binds relationship_id into metadata only when CRM-authorized", () => {
    assert.match(src, /if \(relationshipId\) \{\s*metadata\.relationship_id/);
  });
});
