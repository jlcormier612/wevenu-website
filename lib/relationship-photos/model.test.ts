import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  afterClientPhotoRemove,
  afterClientPhotoUpload,
  afterClientRevokesShare,
  afterClientSharesPhoto,
  afterVenueChoosesClientPhoto,
  afterVenueChoosesVenuePhoto,
  afterVenuePhotoRemove,
  afterVenuePhotoUpload,
  resolveVenueFacingPhoto,
  shouldNotifyClientPhotoShared,
  type RelationshipPhotoState,
} from "./model";

const empty: RelationshipPhotoState = {
  venuePhotoUrl: null,
  clientPhotoUrl: null,
  clientPhotoShared: false,
  venueDisplaySource: "none",
};

describe("relationship photo precedence", () => {
  it("A. no photos → default (null display)", () => {
    const v = resolveVenueFacingPhoto(empty);
    assert.equal(v.displayedPhotoUrl, null);
    assert.equal(v.effectiveDisplaySource, "none");
    assert.equal(v.clientPhotoAvailable, false);
  });

  it("B. venue photo upload becomes displayed", () => {
    const next = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    const v = resolveVenueFacingPhoto(next);
    assert.equal(v.displayedPhotoUrl, "https://cdn/venue.jpg");
    assert.equal(v.effectiveDisplaySource, "venue");
    assert.equal(next.venueDisplaySource, "venue");
  });

  it("C. private client photo is invisible to venue facing resolve", () => {
    const withPrivate = afterClientPhotoUpload(empty, "https://cdn/private.jpg");
    assert.equal(withPrivate.clientPhotoShared, false);
    const v = resolveVenueFacingPhoto(withPrivate);
    assert.equal(v.clientPhotoUrl, null);
    assert.equal(v.displayedPhotoUrl, null);
    assert.equal(v.clientPhotoAvailable, false);
  });

  it("D. shared client photo, no venue photo → auto display client", () => {
    const uploaded = afterClientPhotoUpload(empty, "https://cdn/client.jpg");
    const shared = afterClientSharesPhoto(uploaded);
    assert.equal(shared.venueDisplaySource, "client");
    const v = resolveVenueFacingPhoto(shared);
    assert.equal(v.displayedPhotoUrl, "https://cdn/client.jpg");
    assert.equal(v.effectiveDisplaySource, "client");
  });

  it("E. shared client photo with existing venue photo → venue stays; client available", () => {
    const withVenue = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    const uploaded = afterClientPhotoUpload(withVenue, "https://cdn/client.jpg");
    const shared = afterClientSharesPhoto(uploaded);
    assert.equal(shared.venueDisplaySource, "venue");
    const v = resolveVenueFacingPhoto(shared);
    assert.equal(v.displayedPhotoUrl, "https://cdn/venue.jpg");
    assert.equal(v.clientPhotoAvailable, true);
    assert.equal(v.clientPhotoUrl, "https://cdn/client.jpg");
  });

  it("F. venue chooses client photo → source persists", () => {
    const withVenue = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    const uploaded = afterClientPhotoUpload(withVenue, "https://cdn/client.jpg");
    const shared = afterClientSharesPhoto(uploaded);
    const chosen = afterVenueChoosesClientPhoto(shared);
    assert.ok(chosen);
    assert.equal(chosen!.venueDisplaySource, "client");
    const v = resolveVenueFacingPhoto(chosen!);
    assert.equal(v.displayedPhotoUrl, "https://cdn/client.jpg");
    assert.equal(v.effectiveDisplaySource, "client");
  });

  it("G. client replaces shared photo while source=client → new URL displays", () => {
    let state = afterClientSharesPhoto(afterClientPhotoUpload(empty, "https://cdn/a.jpg"));
    assert.equal(state.venueDisplaySource, "client");
    state = afterClientPhotoUpload(state, "https://cdn/b.jpg");
    const v = resolveVenueFacingPhoto(state);
    assert.equal(v.displayedPhotoUrl, "https://cdn/b.jpg");
    assert.equal(v.effectiveDisplaySource, "client");
  });

  it("H. revoke sharing while source=client → fall back to venue or none", () => {
    const withVenue = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    let state = afterVenueChoosesClientPhoto(
      afterClientSharesPhoto(afterClientPhotoUpload(withVenue, "https://cdn/client.jpg")),
    )!;
    state = afterClientRevokesShare(state);
    assert.equal(state.clientPhotoShared, false);
    assert.equal(state.venueDisplaySource, "venue");
    const v = resolveVenueFacingPhoto(state);
    assert.equal(v.displayedPhotoUrl, "https://cdn/venue.jpg");
    assert.equal(v.clientPhotoUrl, null);

    let noVenue = afterClientSharesPhoto(afterClientPhotoUpload(empty, "https://cdn/client.jpg"));
    noVenue = afterClientRevokesShare(noVenue);
    assert.equal(noVenue.venueDisplaySource, "none");
    assert.equal(resolveVenueFacingPhoto(noVenue).displayedPhotoUrl, null);
  });

  it("I. client deletes photo while source=client → fall back", () => {
    const withVenue = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    let state = afterVenueChoosesClientPhoto(
      afterClientSharesPhoto(afterClientPhotoUpload(withVenue, "https://cdn/client.jpg")),
    )!;
    state = afterClientPhotoRemove(state);
    assert.equal(state.clientPhotoUrl, null);
    assert.equal(state.clientPhotoShared, false);
    assert.equal(state.venueDisplaySource, "venue");
    assert.equal(resolveVenueFacingPhoto(state).displayedPhotoUrl, "https://cdn/venue.jpg");
  });

  it("J. venue uploads while showing client photo → venue takes over", () => {
    let state = afterClientSharesPhoto(afterClientPhotoUpload(empty, "https://cdn/client.jpg"));
    assert.equal(state.venueDisplaySource, "client");
    state = afterVenuePhotoUpload(state, "https://cdn/venue-new.jpg");
    assert.equal(state.venueDisplaySource, "venue");
    assert.equal(resolveVenueFacingPhoto(state).displayedPhotoUrl, "https://cdn/venue-new.jpg");
  });

  it("venue remove does not silently adopt client photo", () => {
    const withVenue = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    const shared = afterClientSharesPhoto(afterClientPhotoUpload(withVenue, "https://cdn/client.jpg"));
    const removed = afterVenuePhotoRemove(shared);
    assert.equal(removed.venueDisplaySource, "none");
    const v = resolveVenueFacingPhoto(removed);
    assert.equal(v.displayedPhotoUrl, null);
    assert.equal(v.clientPhotoAvailable, true);
  });

  it("use venue photo requires a venue photo", () => {
    assert.equal(afterVenueChoosesVenuePhoto(empty), null);
    const withVenue = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    assert.equal(afterVenueChoosesVenuePhoto(withVenue)?.venueDisplaySource, "venue");
  });

  it("L. notify only on OFF → ON with a photo", () => {
    assert.equal(shouldNotifyClientPhotoShared(false, true, "https://cdn/x.jpg"), true);
    assert.equal(shouldNotifyClientPhotoShared(true, true, "https://cdn/x.jpg"), false);
    assert.equal(shouldNotifyClientPhotoShared(false, false, "https://cdn/x.jpg"), false);
    assert.equal(shouldNotifyClientPhotoShared(false, true, null), false);
    assert.equal(shouldNotifyClientPhotoShared(true, false, "https://cdn/x.jpg"), false);
  });

  it("M. OFF → ON again after revoke may notify again", () => {
    assert.equal(shouldNotifyClientPhotoShared(false, true, "https://cdn/x.jpg"), true);
  });

  it("N. venue photo available without couple sharing", () => {
    const next = afterVenuePhotoUpload(empty, "https://cdn/venue.jpg");
    const v = resolveVenueFacingPhoto(next);
    assert.equal(v.displayedPhotoUrl, "https://cdn/venue.jpg");
    assert.equal(v.clientPhotoShared, false);
    assert.equal(v.clientPhotoAvailable, false);
  });

  it("O. venue replace keeps source venue", () => {
    let state = afterVenuePhotoUpload(empty, "https://cdn/a.jpg");
    state = afterVenuePhotoUpload(state, "https://cdn/b.jpg");
    assert.equal(state.venuePhotoUrl, "https://cdn/b.jpg");
    assert.equal(state.venueDisplaySource, "venue");
    assert.equal(resolveVenueFacingPhoto(state).displayedPhotoUrl, "https://cdn/b.jpg");
  });

  it("P. revoke does not clear underlying client_photo_url in state helpers", () => {
    let state = afterClientSharesPhoto(afterClientPhotoUpload(empty, "https://cdn/client.jpg"));
    assert.equal(state.clientPhotoUrl, "https://cdn/client.jpg");
    state = afterClientRevokesShare(state);
    assert.equal(state.clientPhotoShared, false);
    assert.equal(state.clientPhotoUrl, "https://cdn/client.jpg");
    assert.equal(resolveVenueFacingPhoto(state).clientPhotoUrl, null);
  });
});
