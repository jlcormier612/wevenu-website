/**
 * Shared vertical rhythm — SEND 2
 *
 * Cadence (top → bottom):
 *   HERO shell  → major SECTION → (optional editorial BREAK) → SECTION → …
 *
 * Prefer these tokens over one-off py-* so scrolling stays musical.
 */
/** Major content sections — primary beat */
export const SECTION_Y = "py-28 md:py-36";
export const SECTION = `px-6 ${SECTION_Y}`;
export const SECTION_SCROLL = `scroll-mt-28 px-6 ${SECTION_Y}`;
/** Bottom padding only (hero → next, or image band → next) */
export const SECTION_PB = "pb-28 md:pb-36";

/**
 * Editorial photography — SEND 8
 * One art-directed collection: identical radius, border, shadow, warmth.
 * Contained stills use FRAME; edge-to-edge bands use BLEED (no radius/shadow).
 * Visual treatment lives in globals.css (.editorial-frame / .editorial-photo).
 */
export const EDITORIAL_FRAME = "editorial-frame overflow-hidden";
/** Full-bleed photography — flush to edges, same warmth on the image */
export const EDITORIAL_BLEED = "editorial-bleed overflow-hidden";
/** Lifestyle photography treatment */
export const EDITORIAL_IMAGE = "editorial-photo";
/** Product UI / screenshots — same crop language, no photo warmth */
export const EDITORIAL_IMAGE_UI = "object-cover object-top";
/** Spacing above/below a contained editorial still in flowing content */
export const EDITORIAL_SPACE_Y = "my-14 md:my-16";
/** Mid-page image-only break — tighter than SECTION, still even */
export const EDITORIAL_BREAK_Y = "py-14 md:py-16";

/**
 * Typographic rhythm — SEND 1
 * Eyebrows quieter; primary headlines ~12% larger; tighter title→body grouping.
 */
/** Section / hero eyebrow labels — quieter guide, not competitor */
export const TYPE_LABEL =
  "text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82";
/** Gap from eyebrow → section heading (+~8px vs prior mt-5) */
export const HEADING_AFTER_EYEBROW = "mt-7";
/** Gap from eyebrow → hero / page title (+~8px vs prior mt-6) */
export const TYPE_LABEL_TO_TITLE = "mt-8";
/** Primary page hero title (~12% up; leading ~5% opener) */
export const TYPE_HERO_TITLE =
  "font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]";
/** Gap from hero title → supporting body (−~8px vs prior mt-10) */
export const TYPE_TITLE_TO_BODY = "mt-8";
/** Body copy — consistent line height */
export const TYPE_BODY =
  "text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg";
/** Comfortable reading measure (~55–70 characters) */
export const TYPE_MEASURE = "max-w-[65ch]";
/** Page hero under sticky header — matches SECTION bottom beat */
export const TYPE_HERO_SHELL = "px-6 pt-[140px] pb-28 md:pb-36";
/** Home centered hero (no 140px offset) — same bottom beat */
export const HOME_HERO_SHELL = "px-6 pt-24 pb-28 text-center md:pt-28 md:pb-36";

/**
 * Motion — SEND 4
 * Two motions only (220ms ease-out): page opacity fade, editorial reveal (opacity + 6px Y).
 * Prefer Reveal for storytelling; keep hover on opacity/color.
 */
export const MOTION_HOVER = "duration-200 ease-out";
export const MOTION_TRANSITION = `transition ${MOTION_HOVER}`;
export const MOTION_TRANSITION_OPACITY = `transition-opacity ${MOTION_HOVER}`;
export const MOTION_TRANSITION_COLORS = `transition-colors ${MOTION_HOVER}`;

/**
 * Hover — SEND 9
 * Respond quietly: ~2–4% brightness/opacity, underline reveal, soft elevation.
 * No fills, no dramatic color jumps, no playful scale.
 */
/** Filled primary control — slight dim, not a flash */
export const HOVER_FILL = "hover:opacity-[0.96]";
/** Outline control — border whisper + soft lift, no background fill */
export const HOVER_OUTLINE =
  "hover:border-[var(--heritage-sage)]/42 hover:shadow-[0_12px_28px_-22px_rgba(47,55,47,0.2)]";
/** Text / ghost peer — underline reveal + tiny opacity */
export const HOVER_GHOST =
  "underline-offset-4 hover:underline hover:opacity-[0.97]";
/** Muted nav / chrome links — small opacity step, not full color */
export const HOVER_NAV = "hover:text-[var(--forest-sage)]/78";
/** Inline / footer links — underline only, color stays */
export const HOVER_LINK = "underline-offset-4 hover:underline";
/** Card / list group titles — whisper opacity, not a dim */
export const HOVER_WHISPER = "hover:opacity-[0.96]";
/** Inactive tab / chip — gentle step toward readable */
export const HOVER_TAB = "hover:text-[var(--forest-sage)]/58";

/**
 * Brand value accents — Hospitality · Trust · Celebration
 * Components: HospitalityHeart, TrustRule, CelebrationWhisper
 * CSS: .hospitality-heart · .trust-rule · .celebration-whisper
 */
export const BRAND_ACCENTS = {
  hospitality: "Dusty Rose heart",
  trust: "Sage fine rule",
  celebration: "Gold whisper on imagery only",
} as const;
