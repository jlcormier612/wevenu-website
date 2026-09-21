/**
 * Couple portal photo hero control — size, transient controls, locked share copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const control = readFileSync(join(root, "components/portal/couple-photo-hero-control.tsx"), "utf8");
const shell = readFileSync(join(root, "components/portal/portal-shell.tsx"), "utf8");
const venueEditor = readFileSync(
  join(root, "components/relationship-photos/relationship-photo-editor.tsx"),
  "utf8",
);

describe("couple photo hero control UX", () => {
  it("uses a substantially larger circular photo on desktop and mobile", () => {
    assert.match(control, /h-40 w-40/);
    assert.match(control, /sm:h-52 sm:w-52/);
    // Desktop only: 228px, inside 220–235, down from 16rem (272px at a 17px root).
    // Mobile (h-40) and tablet (h-52) stay on the same steps.
    assert.match(control, /lg:h-\[228px\] lg:w-\[228px\]/);
    assert.doesNotMatch(control, /lg:h-64 lg:w-64/);
    assert.doesNotMatch(control, /13\.5rem/);
    assert.match(control, /dataset\.couplePhoto = "shown"/);
    assert.match(shell, /data-portal-hero/);
    assert.match(shell, /group\/hero/);
    assert.match(shell, /group-data-\[couple-photo=shown\]\/hero:pt-\[calc\(1rem\+10rem\+1\.25rem\)\]!/);
    assert.match(shell, /sm:group-data-\[couple-photo=shown\]\/hero:pt-\[calc\(1\.5rem\+13rem\+1\.25rem\)\]!/);
    assert.match(shell, /lg:group-data-\[couple-photo=shown\]\/hero:pt-\[calc\(1\.5rem\+228px\+1\.25rem\)\]!/);
    assert.match(control, /rounded-full/);
    assert.match(control, /border-2 border-white\/90/);
    assert.match(control, /object-cover/);
    assert.doesNotMatch(control, /h-28 w-28/);
    assert.doesNotMatch(control, /sm:h-36 sm:w-36/);
    assert.doesNotMatch(control, /lg:h-40 lg:w-40/);
    assert.doesNotMatch(control, /h-16 w-16/);
    assert.doesNotMatch(control, /sm:h-20 sm:w-20/);
  });

  it("opens on click/tap and dismisses on outside interaction", () => {
    assert.match(control, /\(hover: hover\) and \(pointer: fine\)/);
    assert.match(control, /onPointerEnter/);
    assert.match(control, /onPointerLeave/);
    assert.match(control, /setPanelOpen/);
    assert.match(control, /controlsVisible/);
    assert.match(control, /pointerdown/);
    assert.match(control, /root\.contains/);
    assert.match(control, /Dismiss photo options/);
    assert.match(control, /fixed inset-0/);
    assert.match(control, /dismissControls/);
  });

  it("uses the locked share copy", () => {
    assert.match(control, /Share with your venue/);
    assert.match(
      control,
      /Your venue can use this photo on your internal client record\./,
    );
    assert.doesNotMatch(control, /client profile/);
    assert.doesNotMatch(control, /venue_display_source/);
  });

  it("does not render controls in the default closed markup path", () => {
    // Controls render only when controlsVisible is true.
    assert.match(control, /\{controlsVisible \? \(/);
    assert.match(control, /Replace photo/);
    assert.match(control, /Remove photo/);
  });
});

describe("venue relationship photo editor UX", () => {
  it("uses a substantially larger photo preview frame", () => {
    assert.match(venueEditor, /max-w-\[16rem\]/);
    assert.doesNotMatch(venueEditor, /max-w-\[10rem\]/);
  });

  it("uses the locked shared-photo copy", () => {
    assert.match(
      venueEditor,
      /Showing the photo this couple shared\. Upload above to replace it with your own client photo version on this record instead\./,
    );
    assert.doesNotMatch(
      venueEditor,
      /Upload above to put a venue photo on this record instead/,
    );
  });
});
