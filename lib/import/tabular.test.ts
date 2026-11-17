import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { looksTabular } from "@/lib/import/tabular";

const header = "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD)";

describe("looksTabular", () => {
  it("treats a consistent CSV as tabular", () => {
    const text = `${header}\nClaire,Nodate,claire@test,\nFiona,Future,fiona@test,2027-05-20`;
    assert.equal(looksTabular(text), true);
  });

  it("still treats a ragged extra-comma row as a spreadsheet", () => {
    const text = `${header}\nClaire,Nodate,claire@test,\nFiona,Future,fiona@test,2027-05-20,\nNora,Exact,nora@test,`;
    assert.equal(looksTabular(text), true);
  });

  it("does not treat a prose paragraph as tabular", () => {
    assert.equal(
      looksTabular("Claire Nodate called about a spring wedding.\nPlease add her to the list."),
      false,
    );
  });
});
