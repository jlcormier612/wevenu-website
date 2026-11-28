import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("staff Storage upload mediation contracts", () => {
  it("browser upload helpers call the authenticated venue Storage API", () => {
    const upload = read("lib/storage/upload.ts");
    assert.match(upload, /\/api\/venue\/storage\/upload/);
    assert.match(upload, /\/api\/venue\/storage\/remove/);
    assert.doesNotMatch(upload, /createClient\(\)\s*;\s*\n\s*const ext/);
    assert.doesNotMatch(upload, /\.storage\.from\(bucket\)\.upload/);
  });

  it("authorized upload uses user-scoped clients and rejects path/tenant mismatch", () => {
    const src = read("lib/storage/authorized-upload.ts");
    assert.match(src, /createClient\("venue"\)|createClient\(\)/);
    assert.match(src, /createVendorClient/);
    assert.match(src, /getCurrentVenue/);
    assert.match(src, /ownerSegment !== venue\.id/);
    assert.match(src, /ownerSegment !== vendorId/);
    assert.doesNotMatch(src, /SERVICE_ROLE|service_role|createAdminClient/);
  });

  it("venue branding and brochure paths use mediated uploadToStorage", () => {
    const venueSettings = read("components/settings/venue-settings.tsx");
    assert.match(venueSettings, /ImageUpload/);
    assert.match(venueSettings, /uploads/);
    assert.match(venueSettings, /\$\{venueId\}\/logo/);
    assert.match(venueSettings, /\$\{venueId\}\/hero/);
    const imageUpload = read("components/ui/image-upload.tsx");
    assert.match(imageUpload, /uploadToStorage\(bucket, path, file\)/);
  });

  it("document / floor-plan / catalog browser writers no longer call browser storage.upload", () => {
    const paths = [
      "components/library/library-documents-manager.tsx",
      "components/document-workspace/upload-button.tsx",
      "components/playbooks/playbook-builder.tsx",
      "components/events/timeline/timeline-attachments-field.tsx",
      "components/communication/template-attachments-field.tsx",
      "components/settings/migration-center.tsx",
      "components/settings/floor-plan-migration-import.tsx",
      "lib/floor-plans/client-background-upload.ts",
      "lib/catalog-images/upload-client.ts",
    ];
    for (const rel of paths) {
      const src = read(rel);
      assert.doesNotMatch(src, /\.storage\.from\([^\)]+\)\.upload/, rel);
      assert.match(src, /uploadFileToStorage|uploadToStorage/, rel);
    }
  });

  it("vendor logo upload passes vendor scope", () => {
    const src = read("components/vendor-app/vendor-profile-form.tsx");
    assert.match(src, /scope:\s*"vendor"/);
  });

  it("portal request uploads use token-mediated API instead of browser Storage", () => {
    const src = read("components/portal/requests-section.tsx");
    assert.match(src, /\/api\/portal\/request-upload/);
    assert.doesNotMatch(src, /request-uploads/);
  });
});
