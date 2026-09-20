/**
 * Relationship couple photos — migration + surface wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261403300000_relationship_couple_photos.sql"),
  "utf8",
);

describe("relationship couple photos migration", () => {
  it("adds photo columns on enduring relationships", () => {
    assert.match(migration, /venue_customer_relationships/);
    assert.match(migration, /venue_photo_url/);
    assert.match(migration, /client_photo_url/);
    assert.match(migration, /client_photo_shared/);
    assert.match(migration, /venue_display_source/);
    assert.match(migration, /vcr_venue_display_source_check/);
  });

  it("hides unshared client URLs via venue_relationship_photos view", () => {
    assert.match(migration, /venue_relationship_photos/);
    assert.match(migration, /case when r\.client_photo_shared then r\.client_photo_url else null end/);
  });

  it("restores shared-only venue read on client_media", () => {
    assert.match(migration, /venue owner sees shared media/);
    assert.match(migration, /visibility in \('venue', 'website'\)/);
  });

  it("portal RPCs cover get/set/share + notification on first share", () => {
    assert.match(migration, /get_portal_relationship_photo/);
    assert.match(migration, /set_portal_relationship_photo/);
    assert.match(migration, /set_portal_relationship_photo_sharing/);
    assert.match(migration, /'client_photo_shared'/);
    assert.match(migration, /shared a photo with you/);
    assert.match(migration, /create_venue_notification/);
  });

  it("guards couple-owned columns from venue session writes", () => {
    assert.match(migration, /guard_relationship_client_photo_columns/);
    assert.match(migration, /trg_guard_relationship_client_photo/);
  });
});

describe("relationship couple photos app wiring", () => {
  it("venue Lead/Client edit screens mount the photo editor", () => {
    const leadEdit = readFileSync(join(root, "app/(app)/leads/[id]/edit/page.tsx"), "utf8");
    const clientEdit = readFileSync(join(root, "app/(app)/clients/[id]/edit/page.tsx"), "utf8");
    assert.match(leadEdit, /RelationshipPhotoEditor/);
    assert.match(clientEdit, /RelationshipPhotoEditor/);
  });

  it("Lead and Client headers receive displayed photo", () => {
    const leadDetail = readFileSync(join(root, "components/leads/lead-detail.tsx"), "utf8");
    const eventDetail = readFileSync(join(root, "components/events/event-detail.tsx"), "utf8");
    const leadPage = readFileSync(join(root, "app/(app)/leads/[id]/page.tsx"), "utf8");
    const clientPage = readFileSync(join(root, "app/(app)/clients/[id]/page.tsx"), "utf8");
    assert.match(leadDetail, /RelationshipPhotoAvatar/);
    assert.match(eventDetail, /RelationshipPhotoAvatar/);
    assert.match(leadPage, /getRelationshipPhotoForVenue/);
    assert.match(clientPage, /getRelationshipPhotoForVenue/);
    assert.match(clientPage, /photoUrl=\{photo\?\.displayedPhotoUrl/);
  });

  it("portal hero mounts couple photo control", () => {
    const shell = readFileSync(join(root, "components/portal/portal-shell.tsx"), "utf8");
    const control = readFileSync(join(root, "components/portal/couple-photo-hero-control.tsx"), "utf8");
    assert.match(shell, /CouplePhotoHeroControl/);
    assert.match(control, /Share with your venue/);
    assert.match(control, /Your venue can use this photo on your client profile/);
    assert.match(control, /\/api\/portal\/relationship-photo/);
  });

  it("portal API route uses client-media + portal RPCs", () => {
    const route = readFileSync(join(root, "app/api/portal/relationship-photo/route.ts"), "utf8");
    assert.match(route, /client-media/);
    assert.match(route, /get_portal_relationship_photo/);
    assert.match(route, /set_portal_relationship_photo/);
    assert.match(route, /set_portal_relationship_photo_sharing/);
    assert.match(route, /resolveImageFile/);
  });
});
