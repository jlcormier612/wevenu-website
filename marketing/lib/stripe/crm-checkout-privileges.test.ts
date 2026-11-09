import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCrmCheckoutPrivileges } from "./crm-checkout-privileges";

describe("resolveCrmCheckoutPrivileges", () => {
  it("anonymous public checkout gets no Customer reuse and no Path 2", () => {
    const result = resolveCrmCheckoutPrivileges({
      crmAssisted: false,
      relationshipId: null,
      stripeCustomerId: null,
    });
    assert.deepEqual(result, {
      relationshipId: "",
      stripeCustomerId: "",
      isPath2: false,
      rejectedUnauthCustomerReuse: false,
    });
  });

  it("anonymous callers cannot force reuse of an arbitrary Stripe Customer", () => {
    const result = resolveCrmCheckoutPrivileges({
      crmAssisted: false,
      stripeCustomerId: "cus_attacker_owned",
      relationshipId: "rel_ignored",
    });
    assert.equal(result.stripeCustomerId, "");
    assert.equal(result.relationshipId, "");
    assert.equal(result.isPath2, false);
    assert.equal(result.rejectedUnauthCustomerReuse, true);
  });

  it("supplying an arbitrary relationship ID does not authorize Customer reuse", () => {
    const result = resolveCrmCheckoutPrivileges({
      crmAssisted: false,
      relationshipId: "rel_arbitrary",
      stripeCustomerId: "cus_from_crm_row",
    });
    assert.equal(result.isPath2, false);
    assert.equal(result.stripeCustomerId, "");
    assert.equal(result.rejectedUnauthCustomerReuse, true);
  });

  it("authorized CRM checkout uses the server-resolved Customer + relationship", () => {
    const result = resolveCrmCheckoutPrivileges({
      crmAssisted: true,
      relationshipId: "rel_trusted",
      stripeCustomerId: "cus_trusted",
    });
    assert.deepEqual(result, {
      relationshipId: "rel_trusted",
      stripeCustomerId: "cus_trusted",
      isPath2: true,
      rejectedUnauthCustomerReuse: false,
    });
  });

  it("authorized CRM without existing Customer still binds relationship (Path 2)", () => {
    const result = resolveCrmCheckoutPrivileges({
      crmAssisted: true,
      relationshipId: "rel_new_customer",
      stripeCustomerId: "",
    });
    assert.equal(result.isPath2, true);
    assert.equal(result.relationshipId, "rel_new_customer");
    assert.equal(result.stripeCustomerId, "");
    assert.equal(result.rejectedUnauthCustomerReuse, false);
  });

  it("trims whitespace on authorized ids", () => {
    const result = resolveCrmCheckoutPrivileges({
      crmAssisted: true,
      relationshipId: "  rel_pad  ",
      stripeCustomerId: "  cus_pad  ",
    });
    assert.equal(result.relationshipId, "rel_pad");
    assert.equal(result.stripeCustomerId, "cus_pad");
  });
});
