/**
 * Phase 2C analytics foundation — consent, GA4 loader, anon id, first-touch, privacy.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertAnalyticsParamsHaveNoPii,
  captureFirstTouchAttribution,
  clearOpaqueAnonId,
  ensureGa4,
  getOrCreateOpaqueAnonId,
  isGa4Initialized,
  isValidGa4MeasurementId,
  mergeAttributionForSubmit,
  readFirstTouchAttribution,
  readMarketingAnalyticsConsent,
  readOpaqueAnonId,
  readVenueFormAnalyticsConsent,
  shutdownGa4,
  trackGenerateLead,
  trackPageView,
  trackTourRequest,
  writeMarketingAnalyticsConsent,
  writeVenueFormAnalyticsConsent,
  MARKETING_COOKIE_PREFS_KEY,
  venueFormConsentStorageKey,
} from "@shared/analytics";
import { UNKNOWN_SOURCE_KEY, reportingSourceGroupKey } from "@/lib/attribution/source";

type Store = Map<string, string>;

function installWebStorage() {
  const local: Store = new Map();
  const session: Store = new Map();
  const make = (store: Store) => ({
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  });

  const scripts: { src: string; attrs: Record<string, string> }[] = [];
  const head = {
    appendChild(el: { src?: string; getAttribute?: (n: string) => string | null; setAttribute?: (n: string, v: string) => void }) {
      if (el.src) scripts.push({ src: el.src, attrs: {} });
      return el;
    },
  };

  const gtagCalls: unknown[][] = [];

  // Minimal DOM for GA4 loader tests.
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { document: unknown }).document = {
    head,
    referrer: "https://referrer.example/path",
    querySelectorAll(sel: string) {
      if (sel.includes("data-htc-ga4")) {
        return {
          forEach() {
            scripts.length = 0;
          },
        };
      }
      return { forEach() {} };
    },
    querySelector(sel: string) {
      if (sel.includes("data-htc-ga4")) return scripts.length ? {} : null;
      return null;
    },
    createElement(tag: string) {
      if (tag !== "script") return {};
      const el: {
        async?: boolean;
        src?: string;
        setAttribute: (n: string, v: string) => void;
        getAttribute: (n: string) => string | null;
        attrs: Record<string, string>;
      } = {
        attrs: {},
        setAttribute(n, v) {
          this.attrs[n] = v;
        },
        getAttribute(n) {
          return this.attrs[n] ?? null;
        },
      };
      return el;
    },
  };
  (globalThis as unknown as { localStorage: ReturnType<typeof make> }).localStorage = make(local);
  (globalThis as unknown as { sessionStorage: ReturnType<typeof make> }).sessionStorage = make(session);
  (globalThis as unknown as { location: { pathname: string; search: string; href: string } }).location = {
    pathname: "/form/demo",
    search: "",
    href: "https://venue.example/form/demo",
  };
  // Node provides crypto.randomUUID — do not overwrite global crypto.
  (globalThis as unknown as { addEventListener: () => void; removeEventListener: () => void; dispatchEvent: () => boolean }).addEventListener =
    () => {};
  (globalThis as unknown as { removeEventListener: () => void }).removeEventListener = () => {};
  (globalThis as unknown as { dispatchEvent: (e: unknown) => boolean }).dispatchEvent = () => true;

  return { local, session, scripts, gtagCalls, resetGtag() {
    gtagCalls.length = 0;
    (globalThis as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }).dataLayer = [];
    (globalThis as unknown as { gtag?: (...a: unknown[]) => void }).gtag = (...args: unknown[]) => {
      gtagCalls.push(args);
      (globalThis as unknown as { dataLayer: unknown[] }).dataLayer.push(args);
    };
  }};
}

let harness: ReturnType<typeof installWebStorage>;

beforeEach(() => {
  harness = installWebStorage();
  shutdownGa4();
  harness.resetGtag();
});

afterEach(() => {
  shutdownGa4();
  harness.local.clear();
  harness.session.clear();
});

describe("Phase 2C measurement ID", () => {
  it("accepts valid G- ids and rejects empty/invalid", () => {
    assert.equal(isValidGa4MeasurementId("G-ABC123"), true);
    assert.equal(isValidGa4MeasurementId("g-abc123"), true);
    assert.equal(isValidGa4MeasurementId(""), false);
    assert.equal(isValidGa4MeasurementId(null), false);
    assert.equal(isValidGa4MeasurementId("UA-123"), false);
  });
});

describe("Phase 2C consent defaults OFF", () => {
  it("marketing consent is false when prefs missing", () => {
    assert.equal(readMarketingAnalyticsConsent(), false);
  });

  it("venue form consent is false by default", () => {
    assert.equal(readVenueFormAnalyticsConsent("venue-1"), false);
  });

  it("consent OFF → GA4 does not initialize even with measurement ID", () => {
    const ok = ensureGa4({
      measurementId: "G-TESTONLY1",
      consented: false,
      surface: "venue_public_form",
    });
    assert.equal(ok, false);
    assert.equal(isGa4Initialized(), false);
    assert.equal(harness.scripts.length, 0);
  });

  it("consent OFF → page_view and generate_lead do not fire", () => {
    ensureGa4({ measurementId: "G-TESTONLY1", consented: false, surface: "htc_marketing" });
    assert.equal(trackPageView(), false);
    assert.equal(trackGenerateLead({ funnel_surface: "htc_marketing", form_mode: "contact" }), false);
    assert.equal(harness.gtagCalls.length, 0);
  });

  it("missing measurement ID → no-op even when consented", () => {
    const ok = ensureGa4({
      measurementId: "",
      consented: true,
      surface: "venue_public_form",
    });
    assert.equal(ok, false);
    assert.equal(isGa4Initialized(), false);
  });
});

describe("Phase 2C consent ON", () => {
  it("consent ON + valid ID → GA4 initializes and page_view fires", () => {
    harness.resetGtag();
    const ok = ensureGa4({
      measurementId: "G-TESTONLY1",
      consented: true,
      surface: "venue_public_form",
      anonId: "anon-abc",
    });
    assert.equal(ok, true);
    assert.equal(isGa4Initialized(), true);
    assert.equal(harness.scripts.length, 1);
    assert.match(harness.scripts[0].src, /googletagmanager\.com\/gtag\/js\?id=G-TESTONLY1/);

    harness.gtagCalls.length = 0;
    assert.equal(trackPageView("/form/demo"), true);
    assert.ok(harness.gtagCalls.some((c) => c[0] === "event" && c[1] === "page_view"));
  });

  it("generate_lead fires with non-PII params and funnel_surface", () => {
    ensureGa4({ measurementId: "G-TESTONLY1", consented: true, surface: "venue_public_form", anonId: "anon-1" });
    harness.gtagCalls.length = 0;
    assert.equal(
      trackGenerateLead({
        funnel_surface: "venue_public_form",
        form_mode: "request_information",
        has_utm: true,
        venue_key: "embed-key",
      }),
      true,
    );
    const lead = harness.gtagCalls.find((c) => c[0] === "event" && c[1] === "generate_lead");
    assert.ok(lead);
    const params = lead![2] as Record<string, unknown>;
    assert.equal(params.funnel_surface, "venue_public_form");
    assert.equal(params.form_mode, "request_information");
    assert.equal(params.has_utm, true);
    assert.equal(params.htc_anon_id, "anon-1");
    assert.equal(params.email, undefined);
    assert.equal(params.name, undefined);
    assert.equal(params.phone, undefined);
  });

  it("request_tour fires for tour submissions", () => {
    ensureGa4({ measurementId: "G-TESTONLY1", consented: true, surface: "venue_public_form" });
    harness.gtagCalls.length = 0;
    assert.equal(
      trackTourRequest({
        funnel_surface: "venue_public_form",
        form_mode: "schedule_tour",
        has_utm: false,
        venue_key: "embed-key",
      }),
      true,
    );
    assert.ok(harness.gtagCalls.some((c) => c[0] === "event" && c[1] === "request_tour"));
  });

  it("marketing generate_lead uses htc_marketing surface (separate from venue)", () => {
    ensureGa4({ measurementId: "G-MKTTEST1", consented: true, surface: "htc_marketing", anonId: "mkt-1" });
    harness.gtagCalls.length = 0;
    trackGenerateLead({ funnel_surface: "htc_marketing", form_mode: "contact", has_utm: false });
    const lead = harness.gtagCalls.find((c) => c[0] === "event" && c[1] === "generate_lead");
    assert.equal((lead![2] as Record<string, unknown>).funnel_surface, "htc_marketing");
  });

  it("OFF → ON initializes; ON → OFF stops future events", () => {
    assert.equal(ensureGa4({ measurementId: "G-TESTONLY1", consented: false, surface: "htc_marketing" }), false);
    assert.equal(ensureGa4({ measurementId: "G-TESTONLY1", consented: true, surface: "htc_marketing" }), true);
    assert.equal(trackPageView(), true);
    shutdownGa4();
    harness.gtagCalls.length = 0;
    assert.equal(trackPageView(), false);
    assert.equal(trackGenerateLead({ funnel_surface: "htc_marketing" }), false);
    assert.equal(harness.gtagCalls.length, 0);
  });
});

describe("Phase 2C opaque anon id", () => {
  it("is opaque, stable, and not created until getOrCreate", () => {
    assert.equal(readOpaqueAnonId("venue:v1"), null);
    const a = getOrCreateOpaqueAnonId("venue:v1");
    const b = getOrCreateOpaqueAnonId("venue:v1");
    assert.equal(a, b);
    assert.ok(a);
    assert.doesNotMatch(a!, /@|email|phone/i);
    clearOpaqueAnonId("venue:v1");
    assert.equal(readOpaqueAnonId("venue:v1"), null);
  });

  it("anon id is not sent to GA4 when consent/init is OFF", () => {
    const id = getOrCreateOpaqueAnonId("venue:v2");
    assert.ok(id);
    ensureGa4({ measurementId: "G-TESTONLY1", consented: false, surface: "venue_public_form", anonId: id });
    harness.gtagCalls.length = 0;
    trackGenerateLead({ funnel_surface: "venue_public_form" });
    assert.equal(harness.gtagCalls.length, 0);
  });

  it("marketing and venue scopes are separate", () => {
    const m = getOrCreateOpaqueAnonId("marketing");
    const v = getOrCreateOpaqueAnonId("venue:abc");
    assert.notEqual(m, v);
  });
});

describe("Phase 2C first-touch UTM merge", () => {
  it("preserves UTMs and fills gaps from first-touch", () => {
    (globalThis as unknown as { location: { pathname: string; search: string; href: string } }).location = {
      pathname: "/form/demo",
      search: "?utm_source=google&utm_medium=cpc&utm_campaign=spring",
      href: "https://venue.example/form/demo?utm_source=google&utm_medium=cpc&utm_campaign=spring",
    };
    const snap = captureFirstTouchAttribution("demo-key");
    assert.equal(snap?.utm_source, "google");
    assert.equal(readFirstTouchAttribution("demo-key")?.utm_campaign, "spring");

    const merged = mergeAttributionForSubmit(
      { utm_source: undefined, landing_page: "https://venue.example/form/demo" },
      snap,
    );
    assert.equal(merged.utm_source, "google");
    assert.equal(merged.utm_medium, "cpc");
    assert.equal(merged.landing_page, "https://venue.example/form/demo");
  });

  it("missing UTMs stay undefined (no invention)", () => {
    const merged = mergeAttributionForSubmit(
      { landing_page: "https://venue.example/form/demo", referrer: "https://ref.example" },
      null,
    );
    assert.equal(merged.utm_source, undefined);
    assert.equal(merged.referrer, "https://ref.example");
  });
});

describe("Phase 2C privacy + attribution boundary", () => {
  it("rejects PII keys in analytics payloads", () => {
    assert.throws(() => assertAnalyticsParamsHaveNoPii({ email: "a@b.c" }));
    assert.throws(() => assertAnalyticsParamsHaveNoPii({ phone: "555" }));
    assert.doesNotThrow(() =>
      assertAnalyticsParamsHaveNoPii({ funnel_surface: "venue_public_form", has_utm: true }),
    );
  });

  it("GA4 module never mutates acquisition_source", () => {
    const ga4Src = readFileSync(resolve("shared/analytics/ga4.ts"), "utf8");
    assert.doesNotMatch(ga4Src, /acquisition_source/);
    assert.doesNotMatch(ga4Src, /\.from\(["']leads["']\)/);
    assert.doesNotMatch(ga4Src, /update\(/);
  });

  it("Unknown remains valid when top-of-funnel evidence is absent", () => {
    assert.equal(reportingSourceGroupKey(null), UNKNOWN_SOURCE_KEY);
    assert.equal(reportingSourceGroupKey(""), UNKNOWN_SOURCE_KEY);
  });

  it("marketing cookie prefs key stays hellotocheers-cookie-prefs", () => {
    assert.equal(MARKETING_COOKIE_PREFS_KEY, "hellotocheers-cookie-prefs");
    writeMarketingAnalyticsConsent(true);
    assert.equal(readMarketingAnalyticsConsent(), true);
    writeMarketingAnalyticsConsent(false);
    assert.equal(readMarketingAnalyticsConsent(), false);
  });

  it("venue consent storage is separate from marketing prefs", () => {
    writeMarketingAnalyticsConsent(true);
    writeVenueFormAnalyticsConsent("v1", true);
    assert.equal(readMarketingAnalyticsConsent(), true);
    assert.equal(readVenueFormAnalyticsConsent("v1"), true);
    writeVenueFormAnalyticsConsent("v1", false);
    assert.equal(readVenueFormAnalyticsConsent("v1"), false);
    assert.equal(readMarketingAnalyticsConsent(), true);
  });

  it("ignores pre-configuration (v1) venue consent prefs when GA4 later becomes available", () => {
    // Legacy key written when checkbox was shown without a Measurement ID.
    harness.local.set("htc-venue-form-analytics-consent:venue-later", "1");
    assert.equal(readVenueFormAnalyticsConsent("venue-later"), false);
    assert.equal(
      venueFormConsentStorageKey("venue-later"),
      "htc-venue-form-analytics-consent:v2:venue-later",
    );
    // Explicit opt-in after analytics is configured uses the v2 key only.
    writeVenueFormAnalyticsConsent("venue-later", true);
    assert.equal(readVenueFormAnalyticsConsent("venue-later"), true);
    assert.equal(harness.local.get("htc-venue-form-analytics-consent:v2:venue-later"), "1");
  });
});
