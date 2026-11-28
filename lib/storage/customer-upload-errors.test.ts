import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CUSTOMER_UPLOAD_FAILED_MESSAGE,
  CUSTOMER_UPLOAD_INVALID_MESSAGE,
  customerFacingUploadError,
} from "@/lib/storage/customer-upload-errors";

describe("customerFacingUploadError", () => {
  it("never surfaces raw RLS / Postgres text", () => {
    assert.equal(
      customerFacingUploadError("new row violates row-level security policy"),
      CUSTOMER_UPLOAD_FAILED_MESSAGE,
    );
    assert.equal(
      customerFacingUploadError("permission denied for table storage.objects"),
      CUSTOMER_UPLOAD_FAILED_MESSAGE,
    );
  });

  it("maps size / type failures to invalid message", () => {
    assert.equal(customerFacingUploadError("Payload too large"), CUSTOMER_UPLOAD_INVALID_MESSAGE);
    assert.equal(customerFacingUploadError("mime type not allowed"), CUSTOMER_UPLOAD_INVALID_MESSAGE);
  });
});
