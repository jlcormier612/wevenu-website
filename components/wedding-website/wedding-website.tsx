"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { PublicWebsite, WebsiteTheme } from "@/lib/wedding-website/types";
import { hostedHeroOccasionLabel, resolveExperienceProfile } from "@/lib/event-experience";
import {
  midnightSupportGridColumn,
  pickMidnightSupportColumns,
} from "@/lib/wedding-website/midnight-gallery-pack";
import {
  chunkFilmContactRows,
  filmContactRowWidthPercent,
  pickFilmContactColumns,
} from "@/lib/wedding-website/film-gallery-pack";
import { RsvpPage } from "@/components/wedding-website/rsvp-page";
import { GuestConciergeWidget } from "@/components/wedding-website/guest-concierge";
import type { RsvpContext } from "@/app/rsvp/[token]/page";
import {
  SectionComposition, ContentBlock, WeddingPartyComposition, edgeWidthClass,
  SectionCanvas, contrastText, ScheduleTimeline, ScheduleDateMoment, EditorialOpening, PairedPassage, DestinationFeature, CompactInterlude,
  PORTRAIT_FACE_FOCAL, GALLERY_SPLIT_FACE_FOCAL, PAPER_CHAMBER,
  type CompositionItem, type CompositionRecipe, type PartyMember, type SectionRole, type SectionScale, type DestinationItem,
} from "@/components/wedding-website/composition-primitives";

// ── Theme system: Collection (aesthetic DNA) + Palette (color expression) ────
//
// A "collection" is a complete wedding aesthetic: typography, layout, photo
// treatment, decorative elements. A "palette" is a color variation within that
// aesthetic. Couples choose their identity first, then the mood.
//
// Collections: Wildflower · Midnight · Garden Party · Linen · Rosé · Coastal
//              Champagne · Velvet · European Estate · Rustic · Industrial
// Each has 3 palettes (Estate/Rustic/Industrial carry authored DNA here so
// resolveTheme never silently inherits Wildflower fonts/filters).

type CollectionConfig = {
  headingFont: string;
  bodyFont: string;
  headingItalic: boolean;
  fontUrl: string | null;
  heroType: "full-bleed" | "invitation" | "inset";
  heroMinHeight: string;
  heroAlign: "center" | "left" | "offset";
  /** Coastal Hero Crop Fix (2026-08-06) — optional, undefined for every
   * Collection but Coastal (byte-identical elsewhere). `background-size:
   * cover` + a flat `heroMinHeight` decouples the hero box's height from
   * its width, so on a full-bleed hero the required cover-scale (and thus
   * how much of the source photo gets cropped off top/bottom) keeps
   * growing as the viewport gets wider — a real photo with its subjects
   * above center starts losing heads at wide desktop widths even though
   * nothing about the photo changed. `heroAspectCap` bounds the box's own
   * width:height ratio (via CSS `aspect-ratio`, with heroMinHeight/
   * heroMaxHeight as the floor/ceiling) so height grows with width instead
   * of staying flat — the crop fraction stays roughly constant across
   * viewport widths instead of worsening. Still `cover`, still full-bleed,
   * no letterboxing, no per-photo data. Also used by Midnight cinematic. */
  heroAspectCap?: string;
  heroMaxHeight?: string;
  /** Shared inset/framed/matted hero params — see heroType `"inset"`. */
  heroInsetPadding?: string;
  heroInsetRadius?: string;
  heroInsetBorderWidth?: string;
  heroInsetOffsetX?: string;
  heroInsetOffsetY?: string;
  headerStyle: "romantic" | "formal" | "editorial" | "minimal" | "coastal";
  storyStyle: "quote" | "prose" | "editorial" | "minimal";
  divider: "botanical" | "rule" | "dots" | "ornament" | "none" | "deco";
  cardRadius: string;
  buttonRadius: string;
  photoRadius: string;
  photoFilter: string; // CSS filter applied to all gallery images
  // Four independent dimensions (2026-07-24) — these last five belong to
  // Layout Collection specifically (Part 1: gallery layout, RSVP
  // placement, animation style, scrolling behavior, section spacing);
  // photoFilter/photoRadius above are overridden by Photo Style tokens
  // when a couple has chosen one, independent of Collection (Part 4).
  galleryLayout: "grid" | "masonry" | "film-strip";
  rsvpPlacement: "inline" | "banner";
  animationStyle: "none" | "fade" | "rise";
  scrollBehavior: "normal" | "snap";
  sectionSpacing: "compact" | "cozy" | "spacious";
  frameStyle: "none" | "border" | "polaroid"; // Photo Style
  captionStyle: "none" | "minimal" | "handwritten"; // Photo Style (dormant — see resolveTheme)
  imageScale: "normal" | "large"; // Photo Style
  // Photo Style — Wedding Website Visual Expression Pass (2026-08-03) +
  // Composition Phase B (2026-08-09): sparse / gallery-wall arrangements.
  // gallery-arrangement/per-image treatment, independent of Collection.
  arrangement: "uniform" | "collage" | "scrapbook" | "sparse" | "gallery-wall";
  scalePattern: "uniform" | "alternating" | "hero-emphasis";
  rotation: "none" | "subtle" | "scattered";
  shadow: "none" | "soft" | "lifted";
  photoSpacing: "tight" | "normal" | "generous";
} & CompositionRecipe; // Collection composition recipe — see composition-primitives.tsx

type PaletteConfig = {
  name: string;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  heroGradient: string;
  heroOverlayColor: string;
  heroOverlayOpacity: number;
  heroTextColor: string; // heading + hero text color, chosen to complement each gradient
  dark: boolean;
};

// ThemeConfig is what the renderer works with: collection DNA + resolved
// palette. primary/secondary (2026-07-24) are the couple's own Color Story
// primary/secondary — always populated (falling back to accent) so callers
// never need an extra null-check beyond what tc.accent already required.
export type ThemeConfig = CollectionConfig & PaletteConfig & { primary: string; secondary: string };

// Baseline for the layout/composition/photo-style fields — every current
// Collection/Photo Style row in the DB now sets all of these explicitly
// (see supabase/migrations/20261173000000_wedding_website_visual_expression.sql),
// so this only matters as a defensive fallback (an offline render, a
// malformed row, a future Collection added without full config).
// "framed" is the closest fallback family to the pre-this-pass look.
const LAYOUT_DEFAULTS: Pick<CollectionConfig,
  "galleryLayout" | "rsvpPlacement" | "animationStyle" | "scrollBehavior" | "sectionSpacing" |
  "frameStyle" | "captionStyle" | "imageScale" | "arrangement" | "scalePattern" | "rotation" | "shadow" | "photoSpacing" |
  "sectionComposition" | "contentWidth" | "itemAlign" | "alternate" | "featuredItem" | "sectionFrame" |
  "sectionBand" | "itemSeparator" | "density" | "asymmetry" | "edgeTreatment" | "portraitShape"
> = {
  galleryLayout: "grid", rsvpPlacement: "inline", animationStyle: "none",
  scrollBehavior: "normal", sectionSpacing: "cozy",
  frameStyle: "none", captionStyle: "none", imageScale: "normal",
  arrangement: "uniform", scalePattern: "uniform", rotation: "none", shadow: "none", photoSpacing: "normal",
  sectionComposition: "framed", contentWidth: "standard", itemAlign: "center", alternate: "none",
  featuredItem: "none", sectionFrame: "card", sectionBand: "none", itemSeparator: "gap",
  density: "cozy", asymmetry: "none", edgeTreatment: "contained", portraitShape: "circle",
};

// Vertical rhythm between sections, keyed by the Layout Collection's own
// sectionSpacing (Part 1) — real per-collection variance now lives in
// layout_config, this is just the CSS translation of the three buckets.
const SECTION_SPACING: Record<CollectionConfig["sectionSpacing"], string> = {
  compact: "3rem",
  cozy: "5rem",
  spacious: "7.5rem",
};

// Mirrors composition-primitives.tsx's own SCALE_MARGIN — RSVP doesn't run
// through SectionCanvas (it has its own bespoke banner/gradient treatment),
// but still participates in the same scale-driven rhythm when a Collection
// has sectionRoles (Coastal only, 2026-08-03).
const SCALE_MARGIN_RSVP: Record<SectionScale, string> = {
  feature: "7rem", standard: "4.5rem", interlude: "2rem",
};

/** Closest overflow scrollport — Studio phone frame nests the site in
 * `.ww-phone-frame-scroll`; viewport-rooted IntersectionObserver never sees
 * those sections as intersecting while you scroll the phone. */
function closestScrollRoot(el: Element | null): Element | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// Scroll-reveal for animationStyle (Part 1) — a couple's Collection choice,
// not per-section. Respects prefers-reduced-motion (architecture spec §11):
// the observer still fires so content always ends visible, it just skips
// straight to the resting state instead of animating into it.
function useScrollReveal(style: CollectionConfig["animationStyle"]) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = React.useState(style === "none");
  React.useEffect(() => {
    if (style === "none") {
      setRevealed(true);
      return;
    }
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    setRevealed(false);
    const root = closestScrollRoot(el);
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); io.unobserve(el); }
    }, { root, threshold: 0.08, rootMargin: "24px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [style]);
  return { ref, revealed };
}

function ScrollReveal({ style, scrollSnap, children }: { style: CollectionConfig["animationStyle"]; scrollSnap: boolean; children: React.ReactNode }) {
  const { ref, revealed } = useScrollReveal(style);
  const hidden: React.CSSProperties = style === "fade"
    ? { opacity: 0 }
    : style === "rise"
    ? { opacity: 0, transform: "translateY(28px)" }
    : {};
  return (
    <div
      ref={ref}
      style={{
        ...(revealed ? { opacity: 1, transform: "none" } : hidden),
        transition: style === "none" ? undefined : "opacity 0.7s ease, transform 0.7s ease",
        scrollSnapAlign: scrollSnap ? "start" : undefined,
      }}
    >
      {children}
    </div>
  );
}

// ── Collections ───────────────────────────────────────────────────────────────
const COLLECTIONS: Record<string, Omit<CollectionConfig, keyof typeof LAYOUT_DEFAULTS>> = {

  // Wildflower — organic asymmetry, offset type, botanical romantic (≠ Garden)
  classic: {
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;600&display=swap",
    heroType: "full-bleed", heroMinHeight: "65vh", heroAlign: "offset",
    headerStyle: "romantic", storyStyle: "prose",
    divider: "botanical", cardRadius: "1rem", buttonRadius: "0.75rem", photoRadius: "0.75rem",
    photoFilter: "saturate(0.85) brightness(1.05)",
  },

  // Midnight — wide cinematic hero + light paper story chamber (≠ Velvet dark)
  modern: {
    headingFont: "'DM Sans', system-ui, sans-serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap",
    heroType: "full-bleed", heroMinHeight: "42vh", heroAlign: "left",
    heroAspectCap: "2.2 / 1", heroMaxHeight: "58vh",
    headerStyle: "editorial", storyStyle: "editorial",
    divider: "rule", cardRadius: "0.25rem", buttonRadius: "0", photoRadius: "0",
    photoFilter: "grayscale(0.5) contrast(1.1) brightness(0.9)",
  },

  // Garden Party — immersive breathing center hero + airy conversational story
  garden: {
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: false,
    fontUrl: null,
    heroType: "full-bleed", heroMinHeight: "72vh", heroAlign: "center",
    headerStyle: "romantic", storyStyle: "prose",
    divider: "dots", cardRadius: "1.5rem", buttonRadius: "99px", photoRadius: "1.5rem",
    photoFilter: "saturate(0.9) brightness(1.08)",
  },

  // Linen — luxury stationery, letterpress, deckled edges, quiet invitation suite.
  // No hero gradient. Like opening a fine invitation suite.
  // photoFilter is a legacy fallback only — Photo Style owns filters on live
  // sites; CollectionPreview strips it so cards never invent a B&W mood.
  minimal: {
    headingFont: "Georgia, serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: false,
    fontUrl: null,
    heroType: "invitation", heroMinHeight: "auto", heroAlign: "center",
    headerStyle: "minimal", storyStyle: "minimal",
    divider: "none", cardRadius: "0.25rem", buttonRadius: "0.25rem", photoRadius: "0",
    photoFilter: "grayscale(1) contrast(0.88) brightness(1.08)",
  },

  // Rosé — garden rose watercolor, Cormorant Garamond italic, ribbon frames
  romance: {
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: true,
    fontUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap",
    heroType: "full-bleed", heroMinHeight: "65vh", heroAlign: "center",
    headerStyle: "romantic", storyStyle: "quote",
    divider: "ornament", cardRadius: "1rem", buttonRadius: "99px", photoRadius: "1rem",
    photoFilter: "saturate(0.7) brightness(1.08) sepia(0.12)",
  },

  // Coastal — wide open geometry + offset editorial Story (EditorialOpening)
  coastal: {
    headingFont: "'Plus Jakarta Sans', system-ui, sans-serif",
    bodyFont: "'Plus Jakarta Sans', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap",
    heroType: "full-bleed", heroMinHeight: "65vh", heroAlign: "center",
    heroAspectCap: "2 / 1", heroMaxHeight: "85vh",
    headerStyle: "coastal", storyStyle: "prose",
    divider: "deco", cardRadius: "0.75rem", buttonRadius: "0.75rem", photoRadius: "0.5rem",
    photoFilter: "saturate(0.75) brightness(1.12) contrast(0.95)",
  },

  // Champagne — formal symmetry + framed Story + ✦ (no EditorialOpening)
  champagne: {
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700&family=Lato:wght@300;400;600&display=swap",
    heroType: "full-bleed", heroMinHeight: "65vh", heroAlign: "center",
    headerStyle: "formal", storyStyle: "prose",
    divider: "deco", cardRadius: "0.25rem", buttonRadius: "0.5rem", photoRadius: "0.125rem",
    photoFilter: "sepia(0.2) contrast(1.05) brightness(1.0)",
  },

  // Velvet — Met Gala black-tie, Cormorant Garamond, candlelit drama, warm sepia
  // Phase B: LEAVE unchanged (baseline for Midnight divergence).
  velvet: {
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&display=swap",
    heroType: "full-bleed", heroMinHeight: "80vh", heroAlign: "left",
    headerStyle: "editorial", storyStyle: "editorial",
    divider: "rule", cardRadius: "0.25rem", buttonRadius: "0.375rem", photoRadius: "0.25rem",
    photoFilter: "sepia(0.35) contrast(1.1) brightness(0.9) saturate(0.8)",
  },

  // European Estate — architectural inset hero + unmasked formal Story
  estate: {
    headingFont: "'EB Garamond', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400;600&display=swap",
    heroType: "inset", heroMinHeight: "68vh", heroAlign: "center",
    heroInsetPadding: "1.75rem", heroInsetRadius: "0.125rem",
    heroInsetBorderWidth: "1px", heroInsetOffsetX: "0", heroInsetOffsetY: "0",
    headerStyle: "formal", storyStyle: "prose",
    divider: "ornament", cardRadius: "0.125rem", buttonRadius: "0.25rem", photoRadius: "0.125rem",
    photoFilter: "saturate(0.82) contrast(1.06) brightness(1.02)",
  },

  // Rustic — tactile inset/mat hero (same primitive, irregular params) + left Story
  rustic: {
    headingFont: "'Source Serif 4', Georgia, serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap",
    heroType: "inset", heroMinHeight: "58vh", heroAlign: "left",
    heroInsetPadding: "0.85rem 0.85rem 1.45rem 0.85rem", heroInsetRadius: "0.4rem",
    heroInsetBorderWidth: "0px", heroInsetOffsetX: "-0.65rem", heroInsetOffsetY: "0.45rem",
    headerStyle: "romantic", storyStyle: "prose",
    divider: "botanical", cardRadius: "0.5rem", buttonRadius: "0.375rem", photoRadius: "0.5rem",
    photoFilter: "saturate(1.05) contrast(0.96) brightness(1.04) sepia(0.08)",
  },

  // Industrial — warehouse steel, Space Grotesk, bold & compact
  industrial: {
    headingFont: "'Space Grotesk', system-ui, sans-serif",
    bodyFont: "'Space Grotesk', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&display=swap",
    heroType: "full-bleed", heroMinHeight: "75vh", heroAlign: "left",
    headerStyle: "editorial", storyStyle: "minimal",
    divider: "rule", cardRadius: "0", buttonRadius: "0", photoRadius: "0",
    photoFilter: "grayscale(0.85) contrast(1.2) brightness(0.92)",
  },
};

// ── Palettes — 3 per collection ───────────────────────────────────────────────
const PALETTES: Record<string, PaletteConfig[]> = {

  // Wildflower
  classic: [
    { name: "Sage",
      bg: "#FAF8F4", surface: "#FFFFFF", text: "#2E2A24", textMuted: "#7A7268", border: "#E8E0D2", accent: "#97AC9E",
      heroGradient: "linear-gradient(160deg, #6A8A78 0%, #97AC9E 50%, #C8D5C8 100%)",
      heroOverlayColor: "#2A3A2A", heroOverlayOpacity: 0.3, heroTextColor: "#FFFFFF", dark: false },
    { name: "Mauve",
      bg: "#FAF5F7", surface: "#FFFFFF", text: "#2E2430", textMuted: "#7A6875", border: "#ECD8E4", accent: "#B89AAC",
      heroGradient: "linear-gradient(160deg, #8A7080 0%, #B898AC 50%, #DCC8D4 100%)",
      heroOverlayColor: "#2A1028", heroOverlayOpacity: 0.3, heroTextColor: "#FFF6FA", dark: false },
    { name: "Terracotta",
      bg: "#FAF6F2", surface: "#FFFFFF", text: "#30241A", textMuted: "#7A6858", border: "#E8D8C8", accent: "#B49480",
      heroGradient: "linear-gradient(160deg, #907060 0%, #B49480 50%, #D4B8A0 100%)",
      heroOverlayColor: "#2A1808", heroOverlayOpacity: 0.3, heroTextColor: "#FFF6EE", dark: false },
  ],

  // Midnight
  modern: [
    { name: "Indigo",
      bg: "#1A1525", surface: "#231E30", text: "#EDE8E2", textMuted: "#8A8598", border: "#352E48", accent: "#BFB8CE",
      heroGradient: "linear-gradient(160deg, #120F1A 0%, #1E1828 40%, #2E2545 100%)",
      heroOverlayColor: "#000000", heroOverlayOpacity: 0.5, heroTextColor: "#EDE8E2", dark: true },
    { name: "Onyx",
      bg: "#141414", surface: "#1E1E1E", text: "#EEEAE5", textMuted: "#888078", border: "#2A2A28", accent: "#C0B8A8",
      heroGradient: "linear-gradient(160deg, #0A0A0A 0%, #181818 50%, #252520 100%)",
      heroOverlayColor: "#000000", heroOverlayOpacity: 0.6, heroTextColor: "#EEEAE5", dark: true },
    { name: "Plum",
      bg: "#1A1020", surface: "#221830", text: "#EDE5F0", textMuted: "#8A80A0", border: "#342848", accent: "#C0A8CC",
      heroGradient: "linear-gradient(160deg, #120818 0%, #1E1030 40%, #2E1848 100%)",
      heroOverlayColor: "#080010", heroOverlayOpacity: 0.5, heroTextColor: "#EDE5F0", dark: true },
  ],

  // Garden Party
  garden: [
    { name: "Eucalyptus",
      bg: "#FAF8F2", surface: "#FFFEF9", text: "#2A2820", textMuted: "#706A58", border: "#DED6C5", accent: "#9DC4A8",
      heroGradient: "linear-gradient(160deg, #5A8A70 0%, #7AAE8C 50%, #B0CEBC 100%)",
      heroOverlayColor: "#1A2010", heroOverlayOpacity: 0.2, heroTextColor: "#FFFFFF", dark: false },
    { name: "Peony",
      bg: "#FAF5F6", surface: "#FFFAFA", text: "#2E2428", textMuted: "#7A6068", border: "#EDD8DC", accent: "#D4A0AC",
      heroGradient: "linear-gradient(160deg, #B07088 0%, #D4A0AC 50%, #EECCD4 100%)",
      heroOverlayColor: "#2A0818", heroOverlayOpacity: 0.2, heroTextColor: "#FFF2F5", dark: false },
    { name: "Wisteria",
      bg: "#F8F5FA", surface: "#FDF9FF", text: "#28243C", textMuted: "#6860A0", border: "#DCCCE8", accent: "#A898C0",
      heroGradient: "linear-gradient(160deg, #685898 0%, #A898C0 50%, #CCC0D8 100%)",
      heroOverlayColor: "#180828", heroOverlayOpacity: 0.25, heroTextColor: "#F8F3FF", dark: false },
  ],

  // Linen — invitation layout; heroTextColor only applies if cover photo set
  minimal: [
    { name: "Ivory",
      bg: "#FCFAF6", surface: "#FEFDF9", text: "#5B534D", textMuted: "#8A8078", border: "#EBE5DB", accent: "#C8B898",
      heroGradient: "none",
      heroOverlayColor: "#1A1818", heroOverlayOpacity: 0, heroTextColor: "#FFFFFF", dark: false },
    { name: "Blush",
      bg: "#FAF6F5", surface: "#FEFAFA", text: "#5B4D4C", textMuted: "#8A7878", border: "#EBD8D5", accent: "#D4B8B0",
      heroGradient: "none",
      heroOverlayColor: "#1A1010", heroOverlayOpacity: 0, heroTextColor: "#FFFFFF", dark: false },
    { name: "Slate",
      bg: "#F5F6F8", surface: "#FAFBFC", text: "#4D5058", textMuted: "#788090", border: "#D8DCE4", accent: "#A8B0B8",
      heroGradient: "none",
      heroOverlayColor: "#101418", heroOverlayOpacity: 0, heroTextColor: "#FFFFFF", dark: false },
  ],

  // Rosé
  romance: [
    { name: "Blush",
      bg: "#FAF6F4", surface: "#FFFFFE", text: "#2E1A18", textMuted: "#7A5855", border: "#EDD6CE", accent: "#CCA8A0",
      heroGradient: "linear-gradient(160deg, #A07070 0%, #CCA8A0 50%, #EDD6CE 100%)",
      heroOverlayColor: "#3A1010", heroOverlayOpacity: 0.25, heroTextColor: "#FFF8F5", dark: false },
    { name: "Petal",
      bg: "#FAF4F6", surface: "#FEFAFC", text: "#2E1820", textMuted: "#7A5868", border: "#EDD0DC", accent: "#CCA0B0",
      heroGradient: "linear-gradient(160deg, #A07088 0%, #CCA0B0 50%, #EDD0DC 100%)",
      heroOverlayColor: "#3A0818", heroOverlayOpacity: 0.25, heroTextColor: "#FFF5F8", dark: false },
    { name: "Powder",
      bg: "#F4F6FA", surface: "#F9FAFD", text: "#1A1E30", textMuted: "#606888", border: "#D0D4E8", accent: "#A0A8CC",
      heroGradient: "linear-gradient(160deg, #707090 0%, #A0A8CC 50%, #D0D4E8 100%)",
      heroOverlayColor: "#080A18", heroOverlayOpacity: 0.3, heroTextColor: "#F5F7FF", dark: false },
  ],

  // Coastal
  coastal: [
    { name: "Navy",
      bg: "#FAFBFC", surface: "#FFFFFF", text: "#1E2E3A", textMuted: "#4A6275", border: "#C8D8E0", accent: "#4A6278",
      heroGradient: "linear-gradient(160deg, #324E64 0%, #4A6278 50%, #C8DCE8 100%)",
      heroOverlayColor: "#0A1A28", heroOverlayOpacity: 0.4, heroTextColor: "#FFFFFF", dark: false },
    { name: "Sea Glass",
      bg: "#F4FAF8", surface: "#FAFFFE", text: "#1A2E28", textMuted: "#4A7060", border: "#C0DCD4", accent: "#4A7868",
      heroGradient: "linear-gradient(160deg, #2A5848 0%, #4A7868 50%, #A0C8BC 100%)",
      heroOverlayColor: "#081A14", heroOverlayOpacity: 0.35, heroTextColor: "#F0FDF8", dark: false },
    { name: "Sand",
      bg: "#FAF8F4", surface: "#FFFDF9", text: "#2E2A1E", textMuted: "#7A7060", border: "#E0D8C8", accent: "#9A8068",
      heroGradient: "linear-gradient(160deg, #5A4A38 0%, #9A8068 60%, #C0AE98 100%)",
      heroOverlayColor: "#1A1008", heroOverlayOpacity: 0.35, heroTextColor: "#FFF8F0", dark: false },
  ],

  // Champagne
  champagne: [
    { name: "Warm Stone",
      bg: "#FBF8F3", surface: "#FFFEF9", text: "#2A2210", textMuted: "#6A5838", border: "#E8DCC8", accent: "#C4AE88",
      heroGradient: "linear-gradient(160deg, #7A6040 0%, #A08558 60%, #C4AE88 100%)",
      heroOverlayColor: "#1A0A00", heroOverlayOpacity: 0.3, heroTextColor: "#FFF9E8", dark: false },
    { name: "Ecru",
      bg: "#FAF8F4", surface: "#FEFCF8", text: "#2A2418", textMuted: "#6A5E40", border: "#E4D8C0", accent: "#B4A888",
      heroGradient: "linear-gradient(160deg, #6A5A38 0%, #9A8860 60%, #B8A880 100%)",
      heroOverlayColor: "#100800", heroOverlayOpacity: 0.3, heroTextColor: "#FFFAEF", dark: false },
    { name: "Charcoal",
      bg: "#F5F5F5", surface: "#FAFAFA", text: "#282828", textMuted: "#686868", border: "#D8D8D8", accent: "#989890",
      heroGradient: "linear-gradient(160deg, #3A3A38 0%, #686860 60%, #989890 100%)",
      heroOverlayColor: "#101010", heroOverlayOpacity: 0.35, heroTextColor: "#F8F8F5", dark: false },
  ],

  // Velvet
  velvet: [
    { name: "Burgundy",
      bg: "#1E1015", surface: "#2A1520", text: "#F7F3EE", textMuted: "#9A8870", border: "#4A2830", accent: "#C9B89A",
      heroGradient: "linear-gradient(160deg, #1E1015 0%, #3A1820 60%, #5B3438 100%)",
      heroOverlayColor: "#0A0008", heroOverlayOpacity: 0.5, heroTextColor: "#F7F3EE", dark: true },
    { name: "Noir",
      bg: "#0F0F0F", surface: "#1A1A1A", text: "#F0ECE8", textMuted: "#907868", border: "#2A2020", accent: "#C0B89A",
      heroGradient: "linear-gradient(160deg, #0A0A0A 0%, #1A1818 50%, #2A2020 100%)",
      heroOverlayColor: "#000000", heroOverlayOpacity: 0.6, heroTextColor: "#F0ECE8", dark: true },
    { name: "Plum",
      bg: "#1A1020", surface: "#241830", text: "#F0EAF5", textMuted: "#9880A8", border: "#3A2848", accent: "#C0A8CC",
      heroGradient: "linear-gradient(160deg, #140A18 0%, #28183A 50%, #3A2048 100%)",
      heroOverlayColor: "#080010", heroOverlayOpacity: 0.5, heroTextColor: "#F0EAF5", dark: true },
  ],

  // European Estate
  estate: [
    { name: "Stone",
      bg: "#F7F5F0", surface: "#FFFEFA", text: "#2A281E", textMuted: "#78715C", border: "#E0DACB", accent: "#8A8060",
      heroGradient: "linear-gradient(160deg, #5E5A40 0%, #8A8060 50%, #C4BC9E 100%)",
      heroOverlayColor: "#1A1810", heroOverlayOpacity: 0.3, heroTextColor: "#FFFFFF", dark: false },
    { name: "Ivy",
      bg: "#F4F6F2", surface: "#FAFCF8", text: "#1E2818", textMuted: "#5A6A50", border: "#D0D8C8", accent: "#6A7A5A",
      heroGradient: "linear-gradient(160deg, #3A4A30 0%, #6A7A5A 50%, #A8B898 100%)",
      heroOverlayColor: "#0A1408", heroOverlayOpacity: 0.32, heroTextColor: "#F5FAF0", dark: false },
    { name: "Limestone",
      bg: "#F8F6F2", surface: "#FFFEFB", text: "#2C2820", textMuted: "#7A7260", border: "#E4DCD0", accent: "#A89878",
      heroGradient: "linear-gradient(160deg, #6A5E48 0%, #A89878 55%, #D4C8B0 100%)",
      heroOverlayColor: "#181408", heroOverlayOpacity: 0.28, heroTextColor: "#FFFAF2", dark: false },
  ],

  // Rustic
  rustic: [
    { name: "Barnwood",
      bg: "#FAF6EF", surface: "#FFFDF8", text: "#2E2418", textMuted: "#7A6650", border: "#E4D6BE", accent: "#9A7A54",
      heroGradient: "linear-gradient(160deg, #6A4E30 0%, #9A7A54 50%, #C8AE84 100%)",
      heroOverlayColor: "#1E1408", heroOverlayOpacity: 0.32, heroTextColor: "#FFF8EC", dark: false },
    { name: "Hayloft",
      bg: "#FBF7F0", surface: "#FFFCF6", text: "#302818", textMuted: "#7A6A48", border: "#E8DCC4", accent: "#B49860",
      heroGradient: "linear-gradient(160deg, #7A6030 0%, #B49860 55%, #D8C490 100%)",
      heroOverlayColor: "#1A1004", heroOverlayOpacity: 0.3, heroTextColor: "#FFFAEF", dark: false },
    { name: "Cedar",
      bg: "#F8F4F0", surface: "#FEFBF8", text: "#2A2018", textMuted: "#6A5848", border: "#E0D0C0", accent: "#8A6850",
      heroGradient: "linear-gradient(160deg, #5A4030 0%, #8A6850 55%, #C0A088 100%)",
      heroOverlayColor: "#140C08", heroOverlayOpacity: 0.34, heroTextColor: "#FFF6F0", dark: false },
  ],

  // Industrial
  industrial: [
    { name: "Steel",
      bg: "#161618", surface: "#1E1E22", text: "#EDECE8", textMuted: "#8A8880", border: "#2E2E34", accent: "#9A9AA0",
      heroGradient: "linear-gradient(160deg, #0A0A0C 0%, #1A1A20 50%, #3A3A44 100%)",
      heroOverlayColor: "#000000", heroOverlayOpacity: 0.55, heroTextColor: "#EDECE8", dark: true },
    { name: "Brick",
      bg: "#1A1412", surface: "#241C18", text: "#F0E8E0", textMuted: "#908078", border: "#3A2820", accent: "#B09080",
      heroGradient: "linear-gradient(160deg, #120A08 0%, #2A1814 50%, #4A3028 100%)",
      heroOverlayColor: "#080400", heroOverlayOpacity: 0.5, heroTextColor: "#F0E8E0", dark: true },
    { name: "Concrete",
      bg: "#18181A", surface: "#222226", text: "#E8E8EA", textMuted: "#848488", border: "#323238", accent: "#A8A8B0",
      heroGradient: "linear-gradient(160deg, #101012 0%, #202028 55%, #404048 100%)",
      heroOverlayColor: "#000000", heroOverlayOpacity: 0.52, heroTextColor: "#E8E8EA", dark: true },
  ],
};

// ── Typography Styles — global font pairings, independent of Collection ──────
// Mirrors FONT_PAIRINGS in components/portal/website-editor.tsx (the picker)
// and the seeded public.typography_styles catalog (Hosted Experience
// Platform Phase 1) — same 4 pairings, same keys. Not curated per Collection
// in this phase; see docs/hosted-experience-platform-architecture-spec.md.
type TypographyOverride = Pick<CollectionConfig, "headingFont" | "bodyFont" | "headingItalic" | "fontUrl">;

const TYPOGRAPHY_STYLES: Record<string, TypographyOverride> = {
  classic_serif: {
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;600&display=swap",
  },
  modern_sans: {
    headingFont: "'DM Sans', system-ui, sans-serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap",
  },
  romantic: {
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: true,
    fontUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap",
  },
  editorial: {
    headingFont: "'DM Serif Display', Georgia, serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap",
  },
};

// Four independent dimensions (2026-07-24) — Layout Collection, Color
// Story, Typography, Photo Style — each resolved and merged in its own
// step, in that order, so a later dimension's tokens always win over an
// earlier one's defaults for any field they both happen to touch (this
// only matters for photoFilter/photoRadius, which Photo Style now owns).
// `site` already carries every dimension's resolved tokens (layoutConfig/
// colorTokens/typographyTokens/photoStyleTokens), joined server-side by
// get_wedding_website — this function's only job is merging them over the
// same hardcoded fallback defaults the old, three-argument resolveTheme()
// used, so a site with none of the new fields set (every site published
// before this initiative) renders pixel-identical to before.
export function resolveTheme(site: PublicWebsite): ThemeConfig {
  const key = site.theme ?? "classic";
  const collection = COLLECTIONS[key] ?? COLLECTIONS.classic;
  const palettes = PALETTES[key] ?? PALETTES.classic;
  const paletteKey = site.themePalette;
  const palette = (paletteKey
    ? palettes.find(p => p.name.toLowerCase() === paletteKey.toLowerCase())
    : null) ?? palettes[0];
  // A couple's chosen Font Pairing overrides the Collection's own default
  // typography when set — otherwise the Collection's typography stands on
  // its own, unchanged from today. typographyTokens (from the catalog, via
  // typography_style_id) takes priority over the legacy fontPairing string
  // lookup when both are present.
  const legacyTypographyOverride = site.fontPairing ? TYPOGRAPHY_STYLES[site.fontPairing] : null;
  const typographyOverride = site.typographyTokens ?? legacyTypographyOverride;

  // Layout Collection (Part 1) — DB layout_config over hardcoded defaults.
  const layoutOverride = { ...LAYOUT_DEFAULTS, ...(site.layoutConfig ?? {}) };

  // Color Story (Part 2) — DB color_story tokens over the legacy palette,
  // then the couple's own direct custom colors over that. Primary/
  // Secondary/Accent/Neutral/Background/Text map onto the palette's own
  // token names one-for-one where a slot already exists (accent/bg/text),
  // and extend two new ones (primary drives buttons + hero tone,
  // secondary joins it in the hero gradient) so all six actually show up
  // somewhere real rather than only three of them doing anything.
  const colorOverride: Partial<PaletteConfig & { primary: string; secondary: string }> = {
    ...(site.colorTokens ?? {}),
    ...(site.colorAccent ? { accent: site.colorAccent } : {}),
    ...(site.colorNeutral ? { border: site.colorNeutral } : {}),
    ...(site.colorBackground ? { bg: site.colorBackground } : {}),
    ...(site.colorText ? { text: site.colorText } : {}),
  };
  // Precedence: the couple's own new Primary color, then whatever a chosen
  // Color Story (or a direct Accent override) resolved to, then the legacy
  // single accentColor a pre-this-initiative site may have saved, then the
  // Collection's hardcoded default. Legacy accentColor must rank BELOW a
  // resolved Color Story — otherwise a site that already has an accentColor
  // (nearly every site published before this initiative, since it used to
  // be the only color customization available) would see no visible change
  // from picking a brand new Color Story at all.
  const primary = site.colorPrimary ?? colorOverride.accent ?? site.accentColor ?? palette.accent;
  const secondary = site.colorSecondary ?? primary;
  if (site.colorPrimary || site.colorSecondary) {
    colorOverride.heroGradient = `linear-gradient(160deg, ${secondary} 0%, ${primary} 60%, ${primary} 100%)`;
  }

  // Photo Style (Part 4 / Invariant 1) — ONLY photo presentation keys.
  // Never merge raw photoStyleTokens (they must never carry fonts / Collection DNA).
  // Typography and Collection composition must be unchanged by Photo Style selection.
  const photoOverride: Partial<ThemeConfig> | null = site.photoStyleTokens
    ? {
        photoFilter: site.photoStyleTokens.photoFilter,
        photoRadius: site.photoStyleTokens.photoRadius,
        frameStyle: site.photoStyleTokens.frameStyle,
        captionStyle: site.photoStyleTokens.captionStyle,
        imageScale: site.photoStyleTokens.imageScale,
        arrangement: site.photoStyleTokens.arrangement,
        scalePattern: site.photoStyleTokens.scalePattern,
        rotation: site.photoStyleTokens.rotation,
        shadow: site.photoStyleTokens.shadow,
        photoSpacing: site.photoStyleTokens.spacing,
      }
    : null;

  return {
    ...collection, ...layoutOverride, ...palette, ...colorOverride, ...typographyOverride, ...photoOverride,
    // Re-assert typography after photo merge so Photo Style can never win on type.
    ...(typographyOverride
      ? {
          headingFont: typographyOverride.headingFont,
          bodyFont: typographyOverride.bodyFont,
          headingItalic: typographyOverride.headingItalic,
          fontUrl: typographyOverride.fontUrl,
        }
      : {}),
    primary, secondary,
  };
}

// ── Typography rendering primitive ──────────────────────────────────────────
// Shared Rendering Architecture, Phase 1 — the public page's font-loading
// mechanism, extracted verbatim from WeddingWebsite's own useEffect so a
// preview can load the couple's real heading/body fonts before rendering
// text in them, the same way the public page always has. Known constraint
// for Phase 2: this keys off one shared `data-wevenu-font` link, correct for
// a single on-screen instance (the public page, or Studio's Live Preview)
// but not yet safe for multiple simultaneous instances (e.g. several
// Collection Preview cards each wanting a different font at once) — that
// needs a per-instance key, deliberately not solved here since Phase 1 is
// architecture-only and every current consumer only ever renders one at a
// time.
// Shared Rendering Architecture, Phase 2 — reference-counted by URL so many
// simultaneous consumers (a Typography or Photo Style preview grid, each
// card wanting a different font) can each call this hook without fighting
// over one shared link element the way the original single `data-wevenu-
// font` singleton did (a real constraint flagged, not solved, in Phase 1 —
// every consumer before Phase 2 only ever rendered one instance at a time,
// so it never surfaced). A link is added once per distinct URL no matter
// how many components request it, and removed only once nothing needs it
// anymore.
const fontRefCounts = new Map<string, number>();

export function useThemeFonts(fontUrl: string | null) {
  React.useEffect(() => {
    if (!fontUrl) return;
    fontRefCounts.set(fontUrl, (fontRefCounts.get(fontUrl) ?? 0) + 1);
    const selector = `link[data-wevenu-font-url="${CSS.escape(fontUrl)}"]`;
    if (!document.head.querySelector(selector)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fontUrl;
      link.setAttribute("data-wevenu-font-url", fontUrl);
      document.head.appendChild(link);
    }
    return () => {
      const remaining = (fontRefCounts.get(fontUrl) ?? 1) - 1;
      if (remaining <= 0) {
        fontRefCounts.delete(fontUrl);
        document.head.querySelector(selector)?.remove();
      } else {
        fontRefCounts.set(fontUrl, remaining);
      }
    };
  }, [fontUrl]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEventDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatEventDateRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatEventDate(start);
  return `${formatEventDate(start)} – ${formatEventDate(end)}`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}

// Schedule Desktop Composition — day/month/year for ScheduleDateMoment,
// parsed from the SAME authoritative eventDate every other date display on
// this page already uses (see `formatEventDate` above), never a second
// date source and never a hand-entered field.
function scheduleDateParts(iso: string): { day: string; month: string; year: string } {
  const d = new Date(iso + "T12:00:00");
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString("en-US", { month: "long" }),
    year: String(d.getFullYear()),
  };
}

// ── Dividers — theme-aware section separators ─────────────────────────────────

function SectionDivider({ style, color }: { style: ThemeConfig["divider"]; color: string }) {
  if (style === "none") return null;

  if (style === "rule") return (
    <div className="flex items-center gap-3 my-3">
      <div className="h-px flex-1" style={{ background: `${color}35` }} />
    </div>
  );

  if (style === "dots") return (
    // Garden Party — tapered dot row
    <div className="flex items-center justify-center gap-2 my-4">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="rounded-full" style={{
          width:  i === 2 ? "5px" : "3px",
          height: i === 2 ? "5px" : "3px",
          background: `${color}${i === 2 ? "55" : "30"}`,
        }} />
      ))}
    </div>
  );

  if (style === "ornament") return (
    // Rosé — romantic heart rule
    <div className="flex items-center gap-4 my-4">
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
      <span style={{ color: `${color}70`, fontSize: "15px", lineHeight: 1 }}>♡</span>
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
    </div>
  );

  if (style === "deco") return (
    // Coastal / Champagne — refined ✦ rule
    <div className="flex items-center gap-3 my-4">
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
      <span className="text-[9px] tracking-[0.4em]" style={{ color: `${color}55` }}>✦</span>
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
    </div>
  );

  // botanical — Wildflower: pressed-flower typographic ornament
  return (
    <div className="flex items-center gap-4 my-4">
      <div className="h-px flex-1" style={{ background: `${color}18` }} />
      <div className="flex items-center gap-1" style={{ color: `${color}60` }}>
        <span style={{ fontSize: "13px", lineHeight: 1 }}>❧</span>
        <span style={{ fontSize: "7px", letterSpacing: "0.15em", opacity: 0.7 }}>✦</span>
        <span style={{ fontSize: "13px", lineHeight: 1, transform: "scaleX(-1)", display: "inline-block" }}>❧</span>
      </div>
      <div className="h-px flex-1" style={{ background: `${color}18` }} />
    </div>
  );
}

// ── Section header — 5 typographic personalities ─────────────────────────────
// Remove all colors and each style should still be immediately recognizable.

/**
 * WW-AUDIT-01 Approach A — story *body* horizontal align follows the
 * SectionHeader composition family, not Collection-wide itemAlign /
 * heroAlign / asymmetry ORs (those still art-direct the hero and other
 * sections — e.g. Wildflower offset hero stays).
 *
 * - romantic / formal → centered prose (welcome + ornaments are centered)
 *   unless treatment is `editorial-opening` (magazine path)
 * - coastal / editorial → left magazine columns
 * - minimal / other → prior DNA OR-list fallback
 */
export function storyBodyAlignsLeft(input: {
  headerStyle: ThemeConfig["headerStyle"];
  itemAlign?: ThemeConfig["itemAlign"];
  heroAlign?: ThemeConfig["heroAlign"];
  asymmetry?: ThemeConfig["asymmetry"];
  storyTreatment?: string | null;
}): boolean {
  const { headerStyle, storyTreatment } = input;
  const editorialOpening = storyTreatment === "editorial-opening";

  if (headerStyle === "romantic" || headerStyle === "formal") {
    return editorialOpening;
  }
  if (headerStyle === "coastal" || headerStyle === "editorial") {
    return true;
  }
  return (
    input.itemAlign === "left"
    || input.heroAlign === "offset"
    || input.asymmetry === "editorial"
    || input.asymmetry === "subtle"
  );
}

export function SectionHeader({ title, tc, accentColor }: { title: string; tc: ThemeConfig; accentColor: string }) {
  const color = accentColor;

  // Editorial — Velvet / Midnight
  // Full-width hairline rule above, quiet small-caps label below. Magazine column header.
  if (tc.headerStyle === "editorial") {
    return (
      <div className="mb-10">
        <div className="h-px w-full mb-4" style={{ background: `${color}30` }} />
        <h2 style={{
          fontFamily: tc.headingFont,
          color: tc.text,
          fontSize: "clamp(0.65rem, 1.1cqw, 0.8rem)",
          fontWeight: tc.headingFont.includes("DM") ? 500 : 400,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
        }}>
          {title}
        </h2>
      </div>
    );
  }

  // Minimal — Linen
  // Almost invisible. Tiny uppercase label, short tick mark. Lets content breathe.
  if (tc.headerStyle === "minimal") {
    return (
      <div className="mb-10">
        <p style={{
          fontFamily: tc.bodyFont,
          color: tc.textMuted,
          fontSize: "0.6rem",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          fontWeight: 400,
          marginBottom: "6px",
        }}>
          {title}
        </p>
        <div style={{ height: "1px", width: "20px", background: `${color}40` }} />
      </div>
    );
  }

  // Coastal — short accent bar above, left-aligned confident sans heading
  if (tc.headerStyle === "coastal") {
    return (
      <div className="mb-10">
        <div style={{ height: "3px", width: "28px", background: color, marginBottom: "14px", borderRadius: "2px" }} />
        <h2 style={{
          fontFamily: tc.headingFont,
          color: tc.text,
          fontSize: "clamp(1.2rem, 2.5cqw, 1.6rem)",
          fontWeight: 600,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
        }}>
          {title}
        </h2>
      </div>
    );
  }

  // Formal — Champagne (deco ✦) vs European Estate (ornament ♡)
  // Same formal letterpress grammar, distinct ornaments so the two
  // framed-center Collections remain blind-ID separable.
  if (tc.headerStyle === "formal") {
    const mark = tc.divider === "ornament" ? "♡" : tc.divider === "deco" ? "✦" : null;
    return (
      <div className="text-center mb-12">
        <div className="mx-auto flex items-center justify-center gap-3" style={{ width: mark ? "120px" : "48px" }}>
          <div style={{ height: "1px", flex: 1, background: `${color}40` }} />
          {mark && <span style={{ color: `${color}70`, fontSize: mark === "♡" ? "14px" : "9px", letterSpacing: mark === "✦" ? "0.2em" : undefined }}>{mark}</span>}
          <div style={{ height: "1px", flex: 1, background: `${color}40` }} />
        </div>
        <p style={{
          fontFamily: "'Lato', system-ui, sans-serif",
          color: tc.textMuted,
          fontSize: "0.6rem",
          fontWeight: 600,
          letterSpacing: "0.4em",
          textTransform: "uppercase",
          margin: "14px 0",
        }}>
          {title}
        </p>
        <div className="mx-auto flex items-center justify-center gap-3" style={{ width: mark ? "120px" : "48px" }}>
          <div style={{ height: "1px", flex: 1, background: `${color}40` }} />
          {mark && <span style={{ color: `${color}70`, fontSize: mark === "♡" ? "14px" : "9px", letterSpacing: mark === "✦" ? "0.2em" : undefined }}>{mark}</span>}
          <div style={{ height: "1px", flex: 1, background: `${color}40` }} />
        </div>
      </div>
    );
  }

  // Romantic — Wildflower, Garden Party, Rosé
  // Centered, warm heading in accent color, framed by theme-specific ornamental dividers.
  // Rosé (italic Cormorant Garamond) gets larger — it's breathtaking at size.
  const headingSize = tc.headingItalic
    ? "clamp(1.85rem, 4.5cqw, 2.8rem)"
    : "clamp(1.5rem, 3.5cqw, 2.2rem)";

  return (
    <div className="text-center mb-12">
      <SectionDivider style={tc.divider} color={color} />
      <h2 style={{
        fontFamily: tc.headingFont,
        color,
        fontStyle: tc.headingItalic ? "italic" : "normal",
        fontSize: headingSize,
        fontWeight: 400,
        lineHeight: 1.15,
        margin: "14px 0",
      }}>
        {title}
      </h2>
      <SectionDivider style={tc.divider} color={color} />
    </div>
  );
}

// ── Gallery ────────────────────────────────────────────────────────────────────
// Collection owns the gallery SECTION's relationship to the page (width,
// edge treatment, band, header/divider) — applied by the "gallery" case in
// WeddingWebsite, not here. This component owns only what's inside that
// section: galleryLayout (Collection's base grid/masonry/film-strip, used
// by every "uniform"-arrangement Photo Style) and everything Photo Style
// controls (arrangement/scalePattern/rotation/shadow/spacing/frame/scale/
// filter/radius). `arrangement: "collage"/"scrapbook"` replace the per-
// image loop entirely for that gallery instance — the one place Photo
// Style's own composition supersedes Collection's galleryLayout, per the
// locked product model.

const SPACING_GAP: Record<ThemeConfig["photoSpacing"], string> = {
  tight: "0.5rem", normal: "0.75rem", generous: "1.5rem",
};

function rotationFor(style: ThemeConfig["rotation"], i: number, wide = false): number {
  if (style === "none") return 0;
  const range = style === "scattered" ? (wide ? 7 : 5) : 2;
  // Deterministic per-index "randomness" — same site always renders the
  // same arrangement (no layout shift on re-render), still reads as
  // organically placed rather than a repeating pattern.
  const seed = (i * 47 + 13) % 100;
  return ((seed / 100) * 2 - 1) * range;
}

function shadowFor(style: ThemeConfig["shadow"]): string {
  if (style === "lifted") return "0 12px 28px rgba(0,0,0,0.22)";
  if (style === "soft") return "0 4px 16px rgba(0,0,0,0.1)";
  return "none";
}

export function GalleryGrid({ photos, tc }: { photos: string[]; tc: ThemeConfig }) {
  // Contact-sheet fusion: bordered equal cells with tight spacing abut so
  // white mats form continuous sheet lines (Film). Modern keeps paint
  // between tiles (no frame). Collage / scrapbook / hero-emphasis paths
  // never author this combo — Luxury uses generous + hero-emphasis.
  const contactSheet =
    tc.frameStyle === "border" &&
    tc.photoSpacing === "tight" &&
    (tc.scalePattern ?? "uniform") === "uniform" &&
    (tc.arrangement ?? "uniform") === "uniform";
  // Dark cinematic grade (Midnight Photo Style) — used to pick the band
  // silhouette without a photo_styles.key branch.
  const darkCinematic = /brightness\(\s*0\.[0-7]/.test(tc.photoFilter || "");
  // Token-gated silhouette families (Final Visual Pass) — each combo is
  // unique in the catalog so published + Studio share one geometry path.
  const editorialEssay =
    (tc.arrangement ?? "uniform") === "uniform" &&
    tc.scalePattern === "hero-emphasis" &&
    tc.frameStyle === "none" &&
    tc.photoSpacing === "tight" &&
    tc.shadow === "none" &&
    !darkCinematic;
  const midnightBand =
    (tc.arrangement ?? "uniform") === "uniform" &&
    tc.scalePattern === "hero-emphasis" &&
    tc.frameStyle === "none" &&
    tc.photoSpacing === "tight" &&
    darkCinematic;
  const luxuryImmersive =
    (tc.arrangement ?? "uniform") === "uniform" &&
    tc.scalePattern === "hero-emphasis" &&
    tc.frameStyle === "border" &&
    tc.photoSpacing === "generous";
  // Minimal sparse — gated on arrangement:"sparse" (oval/round frames + air).
  // Content count is never reduced here — all photos render; restraint is
  // whitespace + oval hierarchy, not omitting images.
  const sparseQuiet = (tc.arrangement ?? "uniform") === "sparse";
  // Gallery Wall — dedicated salon-wall arrangement (≠ Magazine collage slots).
  const galleryWall = tc.arrangement === "gallery-wall";
  // Wildflower — organic unequal windows via alternating scale + soft radius;
  // tilt is not required for identity (rotation may be none).
  const wildflowerOrganic =
    (tc.arrangement ?? "uniform") === "uniform" &&
    tc.scalePattern === "alternating" &&
    tc.frameStyle === "none" &&
    tc.shadow === "soft" &&
    parseFloat(String(tc.photoRadius || "0")) >= 0.5;
  const gap = contactSheet ? "0px" : SPACING_GAP[tc.photoSpacing];
  const frame = (i: number, extraRotation = 0): React.CSSProperties => {
    const rot = rotationFor(tc.rotation, i) + extraRotation;
    const base: React.CSSProperties = {
      transform: rot ? `rotate(${rot.toFixed(1)}deg)` : undefined,
      boxShadow: shadowFor(tc.shadow),
    };
    if (tc.frameStyle === "polaroid") return { ...base, background: "#fff", padding: "10px 10px 28px", boxShadow: base.boxShadow === "none" ? "0 6px 20px rgba(0,0,0,0.18)" : base.boxShadow };
    if (tc.frameStyle === "border") {
      // Gallery Wall salon frames: white mat + darker outer edge.
      const salonFrame = galleryWall;
      const matEdge = salonFrame
        ? "0 0 0 1px rgba(0,0,0,0.28), 0 0 0 2px #2a241c"
        : "0 0 0 1px rgba(0,0,0,0.12)";
      const matWidth = contactSheet ? "8px" : salonFrame ? "8px" : "6px";
      return {
        ...base,
        border: `${matWidth} solid #fff`,
        boxShadow: base.boxShadow === "none" ? matEdge : `${base.boxShadow}, ${matEdge}`,
      };
    }
    return base;
  };
  const imgStyle: React.CSSProperties = {
    display: "block", width: "100%", objectFit: "cover",
    objectPosition: PORTRAIT_FACE_FOCAL,
    filter: tc.photoFilter || undefined,
    borderRadius: tc.frameStyle === "polaroid" ? 0 : tc.photoRadius,
  };
  // WW-AUDIT-03 — split Mag/Edit/Minimal grids use a milder Y-anchor than
  // PORTRAIT_FACE_FOCAL so cover crops in short cells don't amputate faces
  // as hard; collage stays at its existing page-spread center bias.
  const splitSafeImgStyle: React.CSSProperties = {
    ...imgStyle,
    objectPosition: GALLERY_SPLIT_FACE_FOCAL,
  };

  // ── Editorial essay — fashion-spread dominant + support fleet + air ──
  // All photos render; style = hierarchy/scale, not truncation.
  // WW-AUDIT-03: single column below 480cqw so the lead is never an
  // unreadable ultra-narrow strip on Studio/published mobile.
  if (editorialEssay && photos.length >= 1) {
    const lead = photos[0]!;
    const supports = photos.slice(1);
    return (
      <div
        className={
          supports.length
            ? "grid grid-cols-1 @min-[480px]/wedding:grid-cols-[1.55fr_1fr]"
            : "grid grid-cols-1"
        }
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "40rem",
          margin: "0 auto",
          padding: "0.35rem 0.45rem 1rem",
          gap: "0.55rem 0.75rem",
          alignItems: "start",
        }}
      >
        <div className="overflow-hidden" style={{ width: "100%" }}>
          <img src={lead} alt="" style={{ ...splitSafeImgStyle, aspectRatio: "4 / 5" }} />
        </div>
        {supports.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", paddingTop: "0.35rem" }}>
            {supports.map((url, i) => (
              <div
                key={i}
                className="overflow-hidden"
                style={{
                  width: i % 2 === 0 ? "92%" : "78%",
                  marginLeft: i % 2 === 0 ? "0" : "auto",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                  opacity: 0.97,
                }}
              >
                <img src={url} alt="" style={{ ...splitSafeImgStyle, aspectRatio: i % 3 === 1 ? "1 / 1" : "3 / 4" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Luxury — fine-art hero mat + elegant secondary fleet ──
  if (luxuryImmersive && photos.length >= 1) {
    const rest = photos.slice(1);
    return (
      <div
        style={{
          maxWidth: "36rem",
          margin: "0 auto",
          padding: "0.65rem 0.75rem 0.85rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: rest.length ? "0.65rem" : 0,
        }}
      >
        <div className="overflow-hidden" style={{ ...frame(0), width: "64%", maxWidth: "16rem" }}>
          <img src={photos[0]} alt="" style={{ ...imgStyle, aspectRatio: "4 / 5" }} />
        </div>
        {rest.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.45rem",
              width: "100%",
              maxWidth: "34rem",
            }}
          >
            {rest.map((url, i) => (
              <div key={i} className="overflow-hidden" style={{ ...frame(i + 1), width: "16%", minWidth: "3.25rem", maxWidth: "5rem" }}>
                <img src={url} alt="" style={{ ...imgStyle, aspectRatio: "1 / 1" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Midnight cinematic — wide lead + dark field + even-packed supports ──
  // Option D: cols from {2,3,4} via pickMidnightSupportColumns (divisor-first;
  // awkward counts center/span last-row remainder). Still renders every photo.
  if (midnightBand && photos.length >= 1) {
    const supports = photos.slice(1);
    const supportCols = pickMidnightSupportColumns(supports.length);
    return (
      <div
        style={{
          background: "#0a0a0c",
          padding: "0.75rem 0.65rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          boxSizing: "border-box",
        }}
      >
        <div className="overflow-hidden" style={{ flex: "0 0 auto" }}>
          <img src={photos[0]} alt="" style={{ ...imgStyle, aspectRatio: "21 / 9", width: "100%" }} />
        </div>
        {supports.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${supportCols}, 1fr)`,
              gap: "0.4rem",
            }}
          >
            {supports.map((url, i) => {
              const gridColumn = midnightSupportGridColumn(i, supports.length, supportCols);
              return (
                <div
                  key={i}
                  className="overflow-hidden"
                  style={gridColumn ? { gridColumn } : undefined}
                >
                  <img src={url!} alt="" style={{ ...imgStyle, aspectRatio: "4 / 5" }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Minimal sparse — premium oval editorial (all photos, no tiny thumbs) ──
  // Restored from pre–Phase-B `minimalAsym` DNA (tall oval + stacked circles +
  // support), extended so the canonical 6-photo set stays meaningful-scale.
  // Do NOT use a thumbnail-dot strip to "fit" remaining photos.
  // WW-AUDIT-03: below 480cqw collapse the 3-col band to lead-full + 2-col
  // support so ovals stay meaningful (never tiny thumbs).
  if (sparseQuiet && photos.length >= 1) {
    const oval = (tc.photoRadius && tc.photoRadius !== "0") ? tc.photoRadius : "50%";
    const [a, b, c, d, e, f] = [
      photos[0]!,
      photos[1] ?? photos[0]!,
      photos[2] ?? photos[0]!,
      photos[3] ?? photos[1] ?? photos[0]!,
      photos[4] ?? photos[2] ?? photos[0]!,
      photos[5] ?? photos[3] ?? photos[1] ?? photos[0]!,
    ];
    const ovalImg = (aspect: string): React.CSSProperties => ({
      ...splitSafeImgStyle,
      aspectRatio: aspect,
      borderRadius: oval,
      objectFit: "cover",
      objectPosition: GALLERY_SPLIT_FACE_FOCAL,
    });
    const showSecondRow = photos.length >= 5;
    return (
      <div
        style={{
          maxWidth: "42rem",
          margin: "0 auto",
          padding: "0.85rem 0.65rem 1.25rem",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "1.35rem",
        }}
      >
        <div
          className={
            photos.length >= 2
              ? "grid grid-cols-2 @min-[480px]/wedding:grid-cols-[1.15fr_0.72fr_0.95fr] items-center gap-[1.15rem]"
              : "grid grid-cols-1 items-center gap-[1.15rem]"
          }
        >
          <div
            className={
              photos.length >= 2
                ? "overflow-hidden col-span-2 @min-[480px]/wedding:col-span-1 @min-[480px]/wedding:row-span-2 w-full max-w-[20rem] @min-[480px]/wedding:max-w-none mx-auto @min-[480px]/wedding:mx-0"
                : "overflow-hidden w-[52%] mx-auto"
            }
            style={{ borderRadius: oval }}
          >
            <img src={a} alt="" style={ovalImg("3 / 4")} />
          </div>
          {photos.length >= 2 && (
            <div
              className="flex flex-col items-center justify-center gap-[1.15rem]"
            >
              <div className="overflow-hidden" style={{ width: "90%", borderRadius: oval }}>
                <img src={b} alt="" style={ovalImg("1 / 1")} />
              </div>
              <div className="overflow-hidden" style={{ width: "78%", borderRadius: oval }}>
                <img src={c} alt="" style={ovalImg("1 / 1")} />
              </div>
            </div>
          )}
          {photos.length >= 2 && (
            <div className="overflow-hidden w-full" style={{ borderRadius: oval }}>
              <img src={d} alt="" style={ovalImg("4 / 5")} />
            </div>
          )}
        </div>
        {showSecondRow && (
          <div
            className={
              photos.length >= 6
                ? "grid grid-cols-2 justify-center gap-[1.25rem] w-full max-w-[34rem] mx-auto"
                : "grid grid-cols-1 justify-center gap-[1.25rem] w-full max-w-[18rem] mx-auto"
            }
          >
            <div className="overflow-hidden" style={{ borderRadius: oval }}>
              <img src={e} alt="" style={ovalImg("4 / 5")} />
            </div>
            {photos.length >= 6 && (
              <div className="overflow-hidden" style={{ borderRadius: oval }}>
                <img src={f} alt="" style={ovalImg("4 / 5")} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Wildflower — organic rhythm via unequal windows (no tilt-as-identity) ──
  // Containment: pairs must stay inside the gallery width. Additive %
  // marginLeft + % width previously summed past 100% with column-gap, and
  // intrinsic img min-width blocked flex-shrink — Studio phone (`overflow-x-
  // hidden`) and desktop preview then hard-clipped faces at the container edge.
  // Odd indices use marginLeft:auto so they sit right without protruding.
  if (wildflowerOrganic) {
    const widths = ["50%", "34%", "40%", "44%"];
    const aspects = ["4 / 5", "5 / 6", "3 / 2", "1 / 1"];
    const margins = [
      { marginTop: "0", marginLeft: "2%", marginRight: "0" },
      { marginTop: "1.1rem", marginLeft: "auto", marginRight: "2%" },
      { marginTop: "0.15rem", marginLeft: "6%", marginRight: "0" },
      { marginTop: "0.65rem", marginLeft: "auto", marginRight: "0" },
    ];
    // Milder Y-anchor than PORTRAIT_FACE_FOCAL so short landscape windows
    // (3/2) don't amputate jawlines the way a pure top-bias cover crop does.
    const wildflowerImg: React.CSSProperties = {
      ...imgStyle,
      objectPosition: GALLERY_SPLIT_FACE_FOCAL,
    };
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          gap: "0.75rem 0.65rem",
          padding: "0.5rem 0.75rem 1rem",
          maxWidth: "40rem",
          margin: "0 auto",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        {photos.map((url, i) => (
          <div
            key={i}
            className="overflow-hidden"
            style={{
              width: widths[i % widths.length],
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              ...margins[i % margins.length],
              borderRadius: tc.photoRadius,
              boxShadow: shadowFor(tc.shadow),
            }}
          >
            <img src={url} alt="" style={{ ...wildflowerImg, aspectRatio: aspects[i % aspects.length], borderRadius: tc.photoRadius }} />
          </div>
        ))}
      </div>
    );
  }

  // ── Gallery Wall — non-overlap framed salon (mats + deliberate air) ──
  // All photos hang; style = framed salon spacing, not a 4-slot cap.
  if (galleryWall) {
    const aspects = ["4 / 5", "5 / 6", "1 / 1", "4 / 5", "5 / 6", "1 / 1"];
    const widths = ["30%", "28%", "24%", "27%", "25%", "26%"];
    const aligns = ["flex-end", "flex-start", "center", "flex-start", "flex-end", "center"] as const;
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "flex-end",
          columnGap: "0.95rem",
          rowGap: "1.15rem",
          padding: "1rem 0.75rem 1.15rem",
          maxWidth: "42rem",
          margin: "0 auto",
        }}
      >
        {photos.map((url, i) => (
          <div
            key={i}
            className="overflow-hidden shrink-0"
            style={{
              width: widths[i % widths.length],
              alignSelf: aligns[i % aligns.length],
              ...frame(i),
            }}
          >
            <img src={url} alt="" style={{ ...imgStyle, aspectRatio: aspects[i % aspects.length] }} />
          </div>
        ))}
      </div>
    );
  }

  // ── Magazine spread — designed page hierarchy (≠ salon, ≠ scrapbook) ──
  // Cover + full subordinate fleet — every photo participates.
  // WW-AUDIT-03: stack below 480cqw. At ≥480, lead stays a fixed 4/5 cover
  // (items-start) — NOT stretched to the full support-fleet height. Stretching
  // a landscape specimen into a ~5-photo-tall column over-zooms into soft
  // sky/bokeh (blurry left panel on picker thumbs + desktop Live Preview while
  // phone stack looked fine). Editorial already uses fixed 4/5 lead; Mag matches.
  //
  // Fleet cells stay aspect-intrinsic (flex: 0 0 auto) so ScaledThumbnail
  // Mag≠Edit cards do not collapse.
  if (tc.arrangement === "collage") {
    const collageImgStyle: React.CSSProperties = {
      ...imgStyle,
      objectPosition: GALLERY_SPLIT_FACE_FOCAL,
    };
    if (photos.length <= 1) {
      return (
        <div style={{ padding: "0.35rem", maxWidth: "36rem", margin: "0 auto" }}>
          <div className="overflow-hidden" style={{ borderRadius: tc.photoRadius, ...frame(0) }}>
            <img src={photos[0]} alt="" style={{ ...collageImgStyle, aspectRatio: "4 / 5" }} />
          </div>
        </div>
      );
    }
    const rest = photos.slice(1);
    return (
      <div
        className="grid grid-cols-1 @min-[480px]/wedding:grid-cols-[1.35fr_1fr] items-start"
        style={{
          gap: "0.45rem 0.55rem",
          maxWidth: "40rem",
          margin: "0 auto",
          padding: "0.35rem 0.25rem",
        }}
      >
        <div
          className="overflow-hidden relative w-full"
          style={{
            borderRadius: tc.photoRadius,
            ...frame(0),
          }}
        >
          <img
            src={photos[0]}
            alt=""
            style={{ ...collageImgStyle, aspectRatio: "4 / 5", height: "auto", width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {rest.map((url, i) => (
            <div
              key={i}
              className="overflow-hidden"
              style={{
                borderRadius: tc.photoRadius,
                flex: "0 0 auto",
                ...frame(i + 1),
              }}
            >
              <img
                src={url}
                alt=""
                style={{
                  ...collageImgStyle,
                  aspectRatio: i % 2 === 0 ? "5 / 4" : "4 / 5",
                  height: "auto",
                  width: "100%",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Scrapbook — elegant tactile page, restrained imperfect (not chaos) ──
  if (tc.arrangement === "scrapbook") {
    const tilts = [-2.2, 1.6, -1.1, 2.4];
    return (
      <div
        className="flex flex-wrap justify-center"
        style={{
          rowGap: "1.35rem",
          columnGap: "0.35rem",
          paddingInline: "1.75rem",
          paddingTop: "0.65rem",
          paddingBottom: "1rem",
          maxWidth: "38rem",
          margin: "0 auto",
        }}
      >
        {photos.map((url, i) => (
          <div
            key={i}
            className="overflow-hidden shrink-0"
            style={{
              width: i % 3 === 0 ? "44%" : "40%",
              maxWidth: "240px",
              marginTop: i === 1 ? "0.85rem" : i === 3 ? "0.4rem" : "0",
              marginLeft: i > 0 ? "-0.55rem" : "0",
              zIndex: i + 1,
              ...frame(i, tilts[i % tilts.length]! - rotationFor(tc.rotation, i)),
            }}
          >
            <img src={url} alt="" style={{ ...imgStyle, aspectRatio: "1 / 1" }} />
          </div>
        ))}
      </div>
    );
  }

  // ── Uniform arrangement — Film / Modern (and defensive fallbacks) ──
  // LEAVE Film contact-sheet + Modern equal grid (B10 / B11).
  const spanFor = (i: number, total: number): string => {
    if (tc.scalePattern === "hero-emphasis" && i === 0 && total > 1) return "col-span-2 row-span-2";
    if (tc.scalePattern === "alternating" && i % 3 === 1) return "col-span-2";
    return "";
  };
  const aspectFor = (i: number): string => {
    if (tc.scalePattern === "alternating") return i % 2 === 0 ? "4 / 5" : "16 / 10";
    return "1 / 1";
  };

  if (tc.galleryLayout === "film-strip") {
    const baseW = tc.imageScale === "large" ? 78 : 46;
    const baseMax = tc.imageScale === "large" ? 560 : 340;
    const widthFor = (i: number): { vw: string; max: number } => {
      if (tc.scalePattern === "hero-emphasis" && i === 0) return { vw: `${Math.min(baseW + 22, 92)}vw`, max: baseMax + 180 };
      if (tc.scalePattern === "alternating") return i % 2 === 1 ? { vw: `${Math.max(baseW - 12, 30)}vw`, max: baseMax - 100 } : { vw: `${baseW}vw`, max: baseMax };
      return { vw: `${baseW}vw`, max: baseMax };
    };
    return (
      <div className="flex overflow-x-auto pb-4 -mx-6 px-6" style={{ gap, scrollSnapType: "x proximity" }}>
        {photos.map((url, i) => {
          const w = widthFor(i);
          return (
            <div key={i} className="shrink-0 overflow-hidden"
              style={{ width: w.vw, maxWidth: w.max, borderRadius: tc.photoRadius, scrollSnapAlign: "center", ...frame(i) }}>
              <img src={url} alt="" style={{ ...imgStyle, aspectRatio: "4 / 5" }} />
            </div>
          );
        })}
      </div>
    );
  }

  if (tc.galleryLayout === "grid") {
    // Film contact-sheet Option D: pack into 2–3 col rows; short final rows
    // shrink + center so cream strip never paints empty tracks (same bug
    // class as Midnight's orphan support cell, cream instead of near-black).
    if (contactSheet) {
      const cols = pickFilmContactColumns(photos.length);
      const rows = chunkFilmContactRows(photos, cols);
      let photoIndex = 0;
      const sheet = (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {rows.map((row, rowIndex) => {
            const widthPct = filmContactRowWidthPercent(row.length, cols);
            return (
              <div
                key={rowIndex}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                  gap: 0,
                  width: `${widthPct}%`,
                  marginInline: "auto",
                }}
              >
                {row.map((url) => {
                  const i = photoIndex++;
                  return (
                    <div
                      key={i}
                      className="overflow-hidden"
                      style={{ borderRadius: tc.photoRadius, ...frame(i) }}
                    >
                      <img src={url} alt="" style={{ ...imgStyle, aspectRatio: aspectFor(i) }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
      const sprocket = (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", padding: "4px 3px", background: "#1a1510" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ width: 7, height: 5, borderRadius: 1, background: "#f3ebe0", opacity: 0.9 }} />
          ))}
        </div>
      );
      return (
        <div
          style={{
            background: "linear-gradient(180deg, #f3ebe0 0%, #e8dcc8 100%)",
            padding: "0.45rem",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.1)",
            display: "flex",
            gap: 0,
          }}
        >
          {sprocket}
          <div style={{ flex: 1, minWidth: 0 }}>{sheet}</div>
          {sprocket}
        </div>
      );
    }
    const grid = (
      <div className={`grid ${tc.imageScale === "large" ? "grid-cols-2" : "grid-cols-2 @min-[768px]/wedding:grid-cols-3"}`} style={{ gap }}>
        {photos.map((url, i) => (
          <div key={i} className={`overflow-hidden ${spanFor(i, photos.length)}`} style={{ borderRadius: tc.photoRadius, ...frame(i) }}>
            <img src={url} alt="" style={{ ...imgStyle, aspectRatio: aspectFor(i) }} />
          </div>
        ))}
      </div>
    );
    return grid;
  }

  const masonry = (
    <div className={`columns-2 space-y-3 ${tc.imageScale === "large" ? "@min-[768px]/wedding:columns-2" : "@min-[768px]/wedding:columns-3 @min-[1024px]/wedding:columns-4"}`} style={{ columnGap: gap }}>
      {photos.map((url, i) => (
        <div key={i} className="break-inside-avoid overflow-hidden" style={{ borderRadius: tc.photoRadius, marginBottom: gap, ...frame(i) }}>
          <img src={url} alt="" style={imgStyle} />
        </div>
      ))}
    </div>
  );
  if (contactSheet) {
    return (
      <div
        style={{
          background: "linear-gradient(180deg, #f3ebe0 0%, #e8dcc8 100%)",
          padding: "0.55rem",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.1)",
        }}
      >
        {masonry}
      </div>
    );
  }
  return masonry;
}

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({
  slug, accentColor, headingFont, headingItalic,
}: { slug: string; accentColor: string; headingFont: string; headingItalic: boolean }) {
  const router = useRouter();
  const [pw, setPw] = React.useState("");
  const [checking, setChecking] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    router.push(`/w/${slug}?p=${encodeURIComponent(pw)}`);
    setChecking(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F5F1" }}>
      <div className="text-center space-y-6 px-6 max-w-sm w-full">
        <p className="text-3xl">🔒</p>
        <div>
          <p style={{ fontFamily: headingFont, fontStyle: headingItalic ? "italic" : "normal", fontSize: "1.25rem", color: "#5D6F5D" }}>
            Private wedding website
          </p>
          <p className="text-sm mt-1" style={{ color: "#B8AEA1" }}>Enter the password to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="Password" autoFocus
            className="w-full rounded-xl border border-[#DED6CA] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
          <button type="submit" disabled={!pw.trim() || checking}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ background: accentColor }}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── RSVP form ─────────────────────────────────────────────────────────────────

// Hosted Experience Platform Phase 4 — unifies what used to be two RSVP
// experiences into one. A guest who lands here directly (not via their
// personalized emailed link) types their code; once get_rsvp_context
// confirms it's real, this renders the exact same RsvpPage a guest gets
// at /rsvp/[token] — same meal options, same custom questions, same
// household members, same submit path. No second, thinner form, and no
// "found" state until the code has actually been validated server-side
// (previously a client-side length check accepted any 11+ character
// string, showing a working-looking form for a code that was never real).
function RsvpSection({ accentColor, tc }: { accentColor: string; tc: ThemeConfig }) {
  const [token, setToken] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [context, setContext] = React.useState<RsvpContext | null>(null);

  // Visual Regression Pass (2026-08-13) — shorthand `background`/`border`
  // CSS in an inline style object is a known source of spurious React
  // hydration mismatch warnings: the browser's CSSStyleDeclaration always
  // expands a shorthand into every one of its longhand sub-properties
  // (background-image, border-top-width, etc, mostly "initial"), and
  // React's hydration diff compares against that expanded form rather than
  // the shorthand string it rendered server-side. Longhand properties here
  // avoid the expansion entirely — same visual result, no mismatch.
  const inputStyle: React.CSSProperties = {
    backgroundColor: tc.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tc.dark ? "rgba(255,255,255,0.15)" : "#DED6CA",
    color: tc.dark ? "#F5E8D0" : "#333",
    borderRadius: tc.buttonRadius,
  };

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setChecking(true);
    try {
      const res = await fetch("/api/portal/rsvp/lookup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      const data = await res.json() as { ok: boolean; context?: RsvpContext };
      if (data.ok && data.context) setContext(data.context);
      else toast.error("We couldn't find that code. Please check your invitation and try again.");
    } catch { toast.error("Something went wrong. Please try again."); }
    finally { setChecking(false); }
  }

  if (context) {
    return (
      <div className="space-y-4">
        <RsvpPage context={context} rsvpToken={token.trim()} />
        <GuestConciergeWidget rsvpToken={token.trim()} accentColor={accentColor} tc={tc} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5" style={{ backgroundColor: tc.dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)", borderRadius: tc.cardRadius, color: tc.dark ? tc.text : "#333" }}>
      <form onSubmit={handleLookup} className="space-y-3">
        <p className="text-sm font-medium">Enter the RSVP code from your invitation</p>
        <input value={token} onChange={e => setToken(e.target.value)} placeholder="Your RSVP code"
          className="w-full px-4 py-3 text-sm focus:outline-none" style={inputStyle} />
        <button type="submit" disabled={!token.trim() || checking}
          className="w-full py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: accentColor, borderRadius: tc.buttonRadius }}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Find My Invitation →"}
        </button>
      </form>
    </div>
  );
}

// ── Dress code label ──────────────────────────────────────────────────────────

const FORMALITY_LABELS: Record<string, string> = {
  casual:       "Casual",
  smart_casual: "Smart Casual",
  cocktail:     "Cocktail Attire",
  black_tie:    "Black Tie",
  custom:       "",
};

// ── Category labels for Things To Do ─────────────────────────────────────────
// Visual Composition Pass (2026-08-12) — this used to be two parallel maps:
// CATEGORY_ICONS (an emoji per category, used as the item's small eyebrow
// label by every Collection without sectionRoles) and CATEGORY_LABELS (a
// real text label, used only by Coastal's own DestinationFeature). An emoji
// rendered at 10px as a section eyebrow is exactly the "tiny placeholder/
// broken-image-looking icon" artifact this pass fixes — some platforms
// render an unsupported/tiny emoji as a fallback tofu glyph indistinguishable
// from a broken image. One real text label now, for every Collection.
const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe:       "Café",
  attraction: "Attraction",
  hotel:      "Hotel",
  shopping:   "Shopping",
  other:      "Local Favorite",
};

// ── Main public website ───────────────────────────────────────────────────────

// ── Hero primitive ────────────────────────────────────────────────────────────
// Shared Rendering Architecture, Phase 1 — extracted verbatim from
// WeddingWebsite's own inline JSX (no visual or behavioral change). This is
// now the one place hero layout, cover-photo handling, overlay/scrim math,
// and heading/eyebrow/date typography are decided. See docs/wedding-website-
// shared-primitives.md for responsibility/inputs/outputs/consumers.

/** Left-aligned hero title clamp (WW-AUDIT-02). Floor stays below 3rem so
 * narrow phone containers can fit multi-line couple names. */
export const HERO_LEFT_TITLE_CLAMP = "clamp(2.15rem, 8cqw, 6rem)";

/** Class + CSS var target for Studio phone frame height capping (cqh). */
export const HERO_MIN_BOX_CLASS = "ww-hero-min-box";

export function Hero({ site, tc, editMode = false, onSectionClick }: {
  site: PublicWebsite;
  tc: ThemeConfig;
  editMode?: boolean;
  onSectionClick?: (key: string) => void;
}) {
  const color = tc.primary;
  const content = site.content ?? {};
  const couple = site.couple;
  const coupleName = couple
    ? [couple.firstName, couple.partnerFirstName].filter(Boolean).join(" & ")
    : "The Couple";
  const eventDate = site.event?.eventDate;
  const eventEndDate = site.event?.eventEndDate;
  const eventDateLabel = eventDate ? formatEventDateRange(eventDate, eventEndDate) : null;
  const du = eventDate ? daysUntil(eventDate) : null;
  const occasionEyebrow = hostedHeroOccasionLabel(resolveExperienceProfile(site.event?.eventType));

  // Hero background — the couple's own cover photo always wins when set.
  // venues.hero_image_url (Coastal Premium Art-Direction Proof Pass,
  // 2026-08-03) is a safe fallback only — never replaces a couple-selected
  // hero — and only when no cover photo exists does the theme's personality
  // gradient apply. COUPLE = STORY, VENUE = PLACE.
  const heroImage = content.home?.coverImageUrl || site.venue?.heroImageUrl || null;
  const hascover = !!heroImage;
  const heroStyle: React.CSSProperties = hascover
    ? { backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: PORTRAIT_FACE_FOCAL,
        filter: tc.photoFilter || undefined }
    : { background: tc.heroGradient };

  // Visual Composition Pass (2026-08-12) — a Color Story's own heroTextColor
  // is authored for a FLAT gradient hero (tc.heroGradient), where it's
  // contrast-checked against a predictable, known color. It is NOT safe for
  // a photographic hero: a couple's own photo has unpredictable, uneven
  // luminance across its frame (sky vs. faces vs. shadow), so inheriting
  // the Color Story's page-context text color here — which is what was
  // happening — produced muddy, low-contrast type over busy photo regions
  // regardless of which curated palette was picked. A photographic hero
  // always uses light/white type over its own scrim (heroOverlayColor/
  // heroOverlayOpacity, still Collection+palette-controlled) instead — the
  // one universally reliable choice for an unpredictable background, and
  // never Collection- or couple-specific.
  const heroTextColor = hascover ? "#FFFFFF" : tc.heroTextColor;

  // A Color Story authored with heroOverlayOpacity near 0 (Linen/Midnight/
  // Velvet's flat "invitation" defaults, meant for zero-photo type-on-paper
  // heroes) leaves photographic heroes with no scrim at all — legible only
  // by luck of which region of the couple's photo happens to sit behind the
  // eyebrow/name text. Same unpredictable-luminance problem as heroTextColor
  // above, same fix: a photographic hero always gets a minimum scrim.
  const heroOverlayOpacity = hascover ? Math.max(tc.heroOverlayOpacity, 0.2) : 0;

  // Linen: invitation layout — when no cover, type-on-paper only; when a
  // cover exists, photograph sits ABOVE a printed suite (names on paper),
  // never as a full-bleed name-over-image hero. That keeps Linen blind-ID–
  // distinct from Garden Party / Champagne even after a couple uploads.
  if (tc.heroType === "invitation") {
    const invitationBody = (
      <div className="max-w-sm mx-auto px-8 py-14 text-center" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <p style={{ fontFamily: tc.bodyFont, fontSize: "0.6rem", letterSpacing: "0.45em", textTransform: "uppercase", color: tc.textMuted, fontWeight: 400 }}>
          {occasionEyebrow}
        </p>
        <h1 style={{ fontFamily: tc.headingFont, fontSize: "clamp(2.2rem, 6cqw, 3.8rem)", fontWeight: 400, lineHeight: 1.1, color: tc.text, letterSpacing: "0.03em" }}>
          {content.home?.title ?? coupleName}
        </h1>
        <div style={{ height: "1px", width: "36px", background: `${color}50`, margin: "0 auto" }} />
        {eventDate && (
          <p style={{ fontFamily: tc.bodyFont, fontSize: "0.7rem", color: tc.textMuted, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 400 }}>
            {eventDateLabel}
          </p>
        )}
        {content.event?.ceremony?.location && (
          <p style={{ fontFamily: tc.headingFont, fontSize: "0.95rem", color: tc.text, letterSpacing: "0.04em" }}>
            {content.event.ceremony.location}
          </p>
        )}
      </div>
    );

    return (
      <div
        className={editMode ? "group cursor-pointer relative" : undefined}
        style={{ background: tc.bg }}
        onClick={editMode ? () => onSectionClick?.("home") : undefined}
      >
        {editMode && (
          <button type="button" onClick={() => onSectionClick?.("home")}
            className="absolute top-3 right-3 z-20 text-xs font-semibold px-2.5 py-1.5 rounded-xl text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `${color}CC` }}>
            ✏ Edit home
          </button>
        )}
        {hascover && (
          <div
            style={{
              width: "100%",
              height: tc.heroMinHeight === "auto" ? "42vh" : tc.heroMinHeight,
              minHeight: "220px",
              maxHeight: "52vh",
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: PORTRAIT_FACE_FOCAL,
              filter: tc.photoFilter || undefined,
            }}
          />
        )}
        {invitationBody}
      </div>
    );
  }

  const titleBlockLeft = (
    <div className="relative z-10 max-w-5xl w-full" style={{ color: heroTextColor }}>
      <div className="mb-4 w-10 h-px" style={{ background: color }} />
      <h1 style={{
        fontFamily: tc.headingFont,
        color: heroTextColor,
        fontStyle: "normal",
        // WW-AUDIT-02: floor below 3rem so narrow ~359cqw phones can fit
        // multi-line couple names inside an inset mat without clipping the
        // first line under overflow / rounded corners.
        fontSize: HERO_LEFT_TITLE_CLAMP,
        fontWeight: tc.headingFont.includes("DM Sans") ? 700 : 400,
        lineHeight: 1.0,
        letterSpacing: tc.headingFont.includes("DM Sans") ? "-0.02em" : "0.01em",
        textShadow: "0 2px 30px rgba(0,0,0,0.4)",
      }}>
        {content.home?.title ?? coupleName}
      </h1>
      <div className="flex items-baseline gap-5 mt-5 flex-wrap">
        {eventDate && (
          <p style={{ fontFamily: tc.headingFont, fontSize: "1rem", opacity: 0.65 }}>
            {eventDateLabel}
          </p>
        )}
        {du !== null && du > 0 && (
          <p className="text-sm opacity-35">{du} days to go</p>
        )}
      </div>
      {content.home?.subtitle && (
        <p className="mt-3 text-sm opacity-55" style={{ fontFamily: tc.bodyFont }}>{content.home.subtitle}</p>
      )}
    </div>
  );

  const titleBlockOffset = (
    // Wildflower — not dead-center, not full left editorial: shifted type mass.
    <div className="relative z-10 max-w-xl w-[78%] text-left" style={{ color: heroTextColor, marginLeft: "4%", marginRight: "auto", alignSelf: "flex-start" }}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-70 mb-4">
        {occasionEyebrow}
      </p>
      <h1 style={{
        fontFamily: tc.headingFont,
        color: heroTextColor,
        fontStyle: tc.headingItalic ? "italic" : "normal",
        fontSize: "clamp(2.4rem, 7cqw, 4.6rem)",
        fontWeight: 600,
        lineHeight: 1.08,
        textShadow: "0 2px 20px rgba(0,0,0,0.25)",
      }}>
        {content.home?.title ?? coupleName}
      </h1>
      {content.home?.subtitle && (
        <p className="mt-4 text-base opacity-80" style={{ fontFamily: tc.headingFont, fontStyle: "italic" }}>
          {content.home.subtitle}
        </p>
      )}
      {eventDate && (
        <p className="mt-5 text-sm opacity-75" style={{ fontFamily: tc.bodyFont, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {eventDateLabel}
        </p>
      )}
    </div>
  );

  const titleBlockCenter = tc.sectionRoles ? (
    <div className="relative z-10 max-w-3xl mx-auto text-center" style={{ color: heroTextColor }}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-70 mb-5">
        {occasionEyebrow}
      </p>
      {content.home?.subtitle && (
        <p className="text-base @min-[768px]/wedding:text-lg italic opacity-80 mb-4" style={{ fontFamily: tc.headingFont }}>
          {content.home.subtitle}
        </p>
      )}
      <h1 style={{
        fontFamily: tc.headingFont,
        color: heroTextColor,
        fontStyle: tc.headingItalic ? "italic" : "normal",
        fontSize: "clamp(2.5rem, 8cqw, 5rem)",
        fontWeight: 600,
        lineHeight: 1.1,
        textShadow: "0 2px 20px rgba(0,0,0,0.25)",
      }}>
        {content.home?.title ?? coupleName}
      </h1>
      {(eventDate || content.event?.ceremony?.location || site.venue?.name) && (
        <p className="pt-5 text-base @min-[768px]/wedding:text-lg opacity-90" style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal" }}>
          {[eventDateLabel, content.event?.ceremony?.location ?? site.venue?.name ?? null]
            .filter(Boolean).join(" · ")}
        </p>
      )}
      {du !== null && du > 0 && (
        <p className="text-sm opacity-60 pt-1">{du} days to go</p>
      )}
    </div>
  ) : (
    <div className="relative z-10 space-y-5 max-w-3xl mx-auto text-center" style={{ color: heroTextColor }}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-70">
        {occasionEyebrow}
      </p>
      <h1 style={{
        fontFamily: tc.headingFont,
        color: heroTextColor,
        fontStyle: tc.headingItalic ? "italic" : "normal",
        fontSize: "clamp(2.5rem, 8cqw, 5rem)",
        fontWeight: 600,
        lineHeight: 1.1,
        textShadow: "0 2px 20px rgba(0,0,0,0.25)",
      }}>
        {content.home?.title ?? coupleName}
      </h1>
      {content.home?.subtitle && (
        <p className="text-lg opacity-85" style={{ fontFamily: tc.bodyFont }}>{content.home.subtitle}</p>
      )}
      {eventDate && (
        <div className="pt-4 space-y-1">
          <p style={{ fontFamily: tc.headingFont, fontSize: "1.15rem", fontStyle: tc.headingItalic ? "italic" : "normal" }}>
            {eventDateLabel}
          </p>
          {du !== null && du > 0 && (
            <p className="text-sm opacity-60">{du} days to go</p>
          )}
        </div>
      )}
    </div>
  );

  const titleInner =
    tc.heroAlign === "left" ? titleBlockLeft
      : tc.heroAlign === "offset" ? titleBlockOffset
        : titleBlockCenter;

  const heroShellClass =
    tc.heroAlign === "left"
      ? "relative flex flex-col items-start justify-end pb-14 pl-8 px-6 py-20"
      : tc.heroAlign === "offset"
        ? "relative flex flex-col items-start justify-end pb-12 px-6 pt-16"
        : "relative flex flex-col items-center justify-center px-6 py-20";

  const aspectStyle: React.CSSProperties = tc.heroAspectCap
    ? { width: "100%", aspectRatio: tc.heroAspectCap, maxHeight: tc.heroMaxHeight }
    : {};

  // Shared hero min-height surface for Studio phone frame CSS
  // (`.ww-phone-frame-scroll .ww-hero-min-box` may cap with cqh).
  const heroMinBoxStyle: React.CSSProperties = {
    minHeight: tc.heroMinHeight,
    ["--ww-hero-min-height" as string]: tc.heroMinHeight,
  };

  // Collection Composition Phase B (STOP-2) — reusable inset/framed/matted
  // hero. Estate (architectural symmetric) and Rustic (tactile irregular mat)
  // parametrize the same primitive via layout_config — no Collection forks.
  if (tc.heroType === "inset") {
    const pad = tc.heroInsetPadding ?? "1.5rem";
    const radius = tc.heroInsetRadius ?? "0.25rem";
    const borderW = tc.heroInsetBorderWidth ?? "1px";
    const ox = tc.heroInsetOffsetX ?? "0";
    const oy = tc.heroInsetOffsetY ?? "0";
    // Mat must read as a frame vs the surrounding page (Studio cards mount
    // Hero on `tc.bg` — using the same bg for the outer shell collapses the
    // inset silhouette). Prefer surface, then a border-tinted field.
    const matBg = tc.surface && tc.surface !== tc.bg
      ? tc.surface
      : `color-mix(in srgb, ${tc.border} 48%, ${tc.bg} 52%)`;
    return (
      <div
        className={editMode ? "group cursor-pointer relative" : "relative"}
        style={{ background: matBg, padding: pad }}
        onClick={editMode ? () => onSectionClick?.("home") : undefined}
      >
        {editMode && (
          <button type="button" onClick={() => onSectionClick?.("home")}
            className="absolute top-3 right-3 z-20 text-xs font-semibold px-2.5 py-1.5 rounded-xl text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `${color}CC` }}>
            ✏ Edit home
          </button>
        )}
        {/* WW-AUDIT-02: clip the photo/overlay to the mat radius, but keep
            the type layer overflow-visible so tall justify-end title blocks
            (left Rustic) and large serif ink are not amputated by the
            rounded overflow:hidden shell. Image stays cover-cropped. */}
        <div
          className={`${heroShellClass} ${HERO_MIN_BOX_CLASS}`}
          style={{
            ...heroMinBoxStyle,
            ...aspectStyle,
            borderRadius: radius,
            border: borderW === "0" || borderW === "0px"
              ? undefined
              : `${borderW} solid color-mix(in srgb, ${tc.border} 70%, ${tc.text} 30%)`,
            overflow: "visible",
            transform: `translate(${ox}, ${oy})`,
            boxShadow: "0 10px 28px rgba(20,16,12,0.12)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ ...heroStyle, borderRadius: radius }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: tc.heroOverlayColor,
              opacity: heroOverlayOpacity,
              borderRadius: radius,
            }}
          />
          {titleInner}
        </div>
      </div>
    );
  }

  return (
  <div
    className={`${heroShellClass} ${HERO_MIN_BOX_CLASS}${editMode ? " group cursor-pointer" : ""}`}
    style={{
      ...heroStyle,
      ...heroMinBoxStyle,
      // `width: 100%` pins width so aspect-ratio only ever solves for
      // height — without it, once maxHeight clamps height below what
      // the ratio would give a full-width box, Chromium renegotiates
      // width down to (height * ratio) instead, breaking full-bleed.
      ...aspectStyle,
    }}
    onClick={editMode ? () => onSectionClick?.("home") : undefined}
  >
    {/* Overlay — softens cover photos; unused for gradient heroes */}
    <div className="absolute inset-0"
      style={{ background: tc.heroOverlayColor, opacity: heroOverlayOpacity }} />

    {editMode && (
      <button type="button" onClick={() => onSectionClick?.("home")}
        className="absolute top-3 right-3 z-20 text-xs font-semibold px-2.5 py-1.5 rounded-xl text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `${color}CC` }}>
        ✏ Edit home
      </button>
    )}

    {titleInner}
  </div>
  );
}

// ── Section primitive ─────────────────────────────────────────────────────────
// Shared Rendering Architecture, Phase 1 — extracted verbatim from
// WeddingWebsite's own nested renderSolo/renderPair closures (no visual or
// behavioral change: same JSX, same conditionals, same shared composition
// primitives, just parameterized by an explicit context object instead of
// closing over WeddingWebsite's local scope). This is now the one place
// that decides how any single content section — or a paired passage like
// Dress Code + Wedding Party — renders, for any consumer that has a
// resolved ThemeConfig and content. See docs/wedding-website-shared-
// primitives.md for responsibility/inputs/outputs/consumers.
export type SectionRenderContext = {
  tc: ThemeConfig;
  content: NonNullable<PublicWebsite["content"]>;
  site: PublicWebsite;
  color: string;
  editMode: boolean;
  /** Studio / wizard phone (and similar nested scroll surfaces). */
  disableScrollReveal?: boolean;
  activeSection: string | null;
  onSectionClick?: (key: string) => void;
};

export function createSectionRenderer(ctx: SectionRenderContext) {
  const { tc, content, site, color, editMode, disableScrollReveal = false, activeSection, onSectionClick } = ctx;
  const eventDate = site.event?.eventDate;

  // Wraps each section in an edit overlay when editMode=true, and — on the
  // published site — in the Collection's own scroll-reveal + scroll-snap
  // behavior (Part 1). Studio / wizard phone frames pass disableScrollReveal:
  // nested overflow used to leave fade/rise sections at opacity:0 (solid
  // cream voids). Picker thumbs already force animationStyle none the same way.
  function SectionWrapper({ sectionKey, children }: { sectionKey: string; children: React.ReactNode }) {
    const revealStyle = (editMode || disableScrollReveal) ? "none" : tc.animationStyle;
    const revealed = (
      <ScrollReveal
        style={revealStyle}
        scrollSnap={!editMode && !disableScrollReveal && tc.scrollBehavior === "snap"}
      >
        {children}
      </ScrollReveal>
    );
    if (!editMode) return revealed;
    const isActive = activeSection === sectionKey;
    return (
      <div
        className={`relative group cursor-pointer transition-all rounded-2xl ${isActive ? "ring-2 ring-offset-2" : ""}`}
        style={isActive ? { "--tw-ring-color": `${color}60` } as React.CSSProperties : {}}
        onClick={() => onSectionClick?.(sectionKey)}
      >
        {revealed}
        <div
          className={`absolute inset-0 rounded-2xl pointer-events-none border-2 transition-all ${isActive ? "" : "opacity-0 group-hover:opacity-100"}`}
          style={{ borderColor: isActive ? `${color}90` : `${color}45`, background: `${color}06` }}
        />
        <div className={`absolute top-3 right-3 transition-all ${isActive ? "" : "opacity-0 group-hover:opacity-100"}`}>
          <span className="text-xs font-semibold px-2.5 py-1.5 rounded-xl text-white shadow-lg"
            style={{ background: color }}>
            ✏ Edit
          </span>
        </div>
      </div>
    );
  }

  const canvasColors = { surface: tc.surface, secondary: tc.secondary, accent: tc.accent, bg: tc.bg, border: tc.border };

  function renderDressCodeWeddingPartyPair(): React.ReactNode {
    const dc = content.dress_code;
    const bp = content.bridal_party;
    const formalityLabel = dc?.formality ? (FORMALITY_LABELS[dc.formality] ?? "") : "";
    const members: PartyMember[] = bp?.members ?? [];
    return (
      <SectionCanvas key="dress_code+bridal_party" role={tc.sectionRoles?.dress_code} sparse={members.length <= 2} colors={canvasColors}>
        <PairedPassage
          dividerColor={`color-mix(in srgb, ${tc.border} 55%, ${tc.text} 45%)`}
          leftSpan={4}
          left={
            <SectionWrapper sectionKey="dress_code">
              <section>
                <SectionHeader title="Dress Code" tc={tc} accentColor={color} />
                <div className="space-y-4">
                  {formalityLabel && (
                    <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", fontSize: "1.4rem", color }}>
                      {formalityLabel}
                    </p>
                  )}
                  {dc?.description && <p className="leading-relaxed opacity-70 text-sm">{dc.description}</p>}
                  {dc?.colorNote && <p className="text-sm opacity-55 italic" style={{ fontFamily: tc.headingFont }}>{dc.colorNote}</p>}
                </div>
              </section>
            </SectionWrapper>
          }
          right={
            <SectionWrapper sectionKey="bridal_party">
              <section>
                <SectionHeader title={bp?.title ?? "Our Wedding Party"} tc={tc} accentColor={color} />
                <WeddingPartyComposition recipe={tc} tc={tc} color={color} members={members} />
              </section>
            </SectionWrapper>
          }
        />
      </SectionCanvas>
    );
  }

  function renderRegistryFaqPair(): React.ReactNode {
    const registryItems: CompositionItem[] = (content.registry ?? []).map(r => ({ heading: r.name, body: r.notes, href: r.url }));
    const faqItems: CompositionItem[] = (content.faq ?? []).map(item => ({ heading: item.question, body: item.answer }));
    return (
      <SectionCanvas key="registry+faq" role={tc.sectionRoles?.registry} sparse={registryItems.length <= 1 && faqItems.length <= 2} colors={canvasColors}>
        <PairedPassage
          dividerColor={`color-mix(in srgb, ${tc.border} 55%, ${tc.text} 45%)`}
          leftSpan={5}
          left={
            <SectionWrapper sectionKey="registry">
              <section>
                <SectionHeader title="Registry" tc={tc} accentColor={color} />
                <SectionComposition recipe={tc} tc={tc} color={color} items={registryItems} />
              </section>
            </SectionWrapper>
          }
          right={
            <SectionWrapper sectionKey="faq">
              <section>
                <SectionHeader title="FAQ" tc={tc} accentColor={color} />
                <SectionComposition recipe={tc} tc={tc} color={color} items={faqItems} />
              </section>
            </SectionWrapper>
          }
        />
      </SectionCanvas>
    );
  }

  function renderPair(keyA: string, keyB: string): React.ReactNode {
    const pairId = [keyA, keyB].sort().join("+");
    if (pairId === "bridal_party+dress_code") return renderDressCodeWeddingPartyPair();
    if (pairId === "faq+registry") return renderRegistryFaqPair();
    return null;
  }

  function renderSolo(key: string): React.ReactNode {
          switch (key) {

            // ── Our Story ──────────────────────────────────────────────────────
            case "story": {
              const s = content.story;
              if (!s?.text) return editMode ? (
                <SectionCanvas key="story" role={tc.sectionRoles?.story} sparse colors={canvasColors}>
                  <SectionWrapper sectionKey="story">
                    <section className="py-4">
                      <p style={{ fontSize: "0.8rem", opacity: 0.3, fontStyle: "italic" }}>Your story will appear here.</p>
                    </section>
                  </SectionWrapper>
                </SectionCanvas>
              ) : null;

              // Dead-space guard (Part 8): a short story reads as sparse —
              // collapses Standard down to Interlude spacing.
              const storySparse = s.text.length < 240;
              // Our Story Image Ownership fix — the story image is the
              // couple's own dedicated, optional upload (content.story.imageUrl)
              // and nothing else. It previously borrowed content.gallery.photos[0],
              // which meant reordering or editing the gallery could silently
              // change what appeared here, and a couple had no way to know
              // "my first gallery photo secretly becomes my Our Story photo."
              // Never falls back to the gallery, hero, or venue imagery.
              const storyPhoto = s.imageUrl ?? null;

              // Collection Composition Phase B — Story presentation follows
              // storyStyle first; EditorialOpening is only when the Story
              // role explicitly asks for `treatment: "editorial-opening"`.
              // Truthy sectionRoles alone no longer masks Champagne ✦ /
              // Estate ♡ / Wildflower botanical / Garden dots headers.
              const storyRole = tc.sectionRoles?.story;
              const useEditorialOpening = storyRole?.treatment === "editorial-opening"
                && tc.storyStyle !== "quote"
                && tc.storyStyle !== "minimal";
              // Paper chamber (STOP-1): ink tokens for the independent light
              // field, so Midnight type stays readable on paper under a dark
              // Color Story page.
              const paperChamber = storyRole?.canvas === "paper";
              const storyTc: ThemeConfig = paperChamber
                ? {
                    ...tc,
                    bg: PAPER_CHAMBER.bg,
                    surface: PAPER_CHAMBER.surface,
                    text: PAPER_CHAMBER.text,
                    textMuted: PAPER_CHAMBER.textMuted,
                    border: PAPER_CHAMBER.border,
                  }
                : tc;

              const asymmetryPad =
                storyTc.asymmetry === "editorial" ? "2.75rem"
                  : storyTc.asymmetry === "subtle" ? "1.35rem"
                    : "0";
              // WW-AUDIT-01 Approach A: body align follows header family
              // (romantic/formal center; coastal/editorial left). Collection
              // DNA left/offset/asymmetry still drive the hero — not story
              // prose when the header composition is already centered.
              const storyLeft = storyBodyAlignsLeft({
                headerStyle: storyTc.headerStyle,
                itemAlign: storyTc.itemAlign,
                heroAlign: storyTc.heroAlign,
                asymmetry: storyTc.asymmetry,
                storyTreatment: storyRole?.treatment,
              });

              const proseBody = (
                <p style={{
                  fontFamily: storyTc.storyStyle === "editorial" ? storyTc.bodyFont : storyTc.headingFont,
                  fontStyle: storyTc.storyStyle === "editorial"
                    ? "normal"
                    : (storyTc.headingItalic ? "italic" : "normal"),
                  fontSize: storyTc.density === "airy" ? "clamp(1.05rem, 2.2cqw, 1.3rem)" : "clamp(1rem, 2cqw, 1.2rem)",
                  lineHeight: storyTc.density === "airy" ? 2.05 : 1.85,
                  color: storyTc.storyStyle === "editorial" ? storyTc.textMuted : storyTc.text,
                  letterSpacing: "0.01em",
                }}>
                  {s.text}
                </p>
              );

              // Champagne formal framed Story — structural ✦ identity.
              // Estate (inset hero) shares formal headerStyle but must NOT
              // inherit this card frame (architectural ≠ letterpress card).
              const formalFramed =
                storyTc.headerStyle === "formal"
                && storyTc.sectionComposition === "framed"
                && storyTc.heroType !== "inset";

              const storyBody = tc.storyStyle === "quote" ? (
                // Rosé — large italic pull quote, centered, like a love letter
                <div className="max-w-xl mx-auto text-center px-4">
                  <p style={{
                    fontFamily: tc.headingFont,
                    fontStyle: "italic",
                    fontSize: "clamp(1.35rem, 3cqw, 1.9rem)",
                    lineHeight: 1.75,
                    color,
                    letterSpacing: "0.01em",
                  }}>
                    {s.text}
                  </p>
                </div>
              ) : tc.storyStyle === "minimal" ? (
                // Linen — quiet body-text scale, no headingFont, max breathing room
                <div>
                  <p style={{
                    fontFamily: tc.bodyFont,
                    fontSize: "0.9rem",
                    lineHeight: 2.05,
                    color: tc.textMuted,
                    maxWidth: "520px",
                  }}>
                    {s.text}
                  </p>
                </div>
              ) : useEditorialOpening ? (
                <EditorialOpening tc={storyTc} color={color} labelColor={storyTc.accent || color} eyebrow="Our Story" heading={s.title ?? "How it began"} text={s.text} photoUrl={storyPhoto} />
              ) : formalFramed ? (
                <div
                  className="mx-auto text-center"
                  style={{
                    maxWidth: "34rem",
                    border: `1px solid ${storyTc.border}`,
                    borderRadius: storyTc.cardRadius,
                    padding: "2.25rem 1.85rem",
                  }}
                >
                  {proseBody}
                </div>
              ) : storyLeft ? (
                <div style={{
                  maxWidth: storyTc.contentWidth === "narrow" ? "28rem" : "36rem",
                  marginLeft: asymmetryPad,
                  marginRight: "auto",
                  textAlign: "left",
                }}>
                  {proseBody}
                </div>
              ) : (
                <div className="max-w-xl mx-auto text-center px-4" style={{
                  paddingInline: storyTc.density === "airy" ? "0.5rem" : undefined,
                }}>
                  {proseBody}
                </div>
              );
              // EditorialOpening supplies its own heading — every other
              // branch still needs the Collection's own SectionHeader.
              const needsHeader = !useEditorialOpening;

              return (
                <SectionCanvas key="story" role={storyRole} sparse={storySparse} colors={canvasColors}>
                <SectionWrapper sectionKey="story">
                  <section>
                    {needsHeader && <SectionHeader title={s.title ?? "Our Story"} tc={storyTc} accentColor={color} />}
                    {storyBody}
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }
            // ── Event Details ─────────────────────────────────────────────────
            // The one authorized primary placement for the venue's editorial
            // image (Coastal Premium Art-Direction Proof Pass, guardrail 3) —
            // it belongs here because this is where ceremony/reception
            // information already connects to the physical venue. Canvas
            // "strong" needs a contrast-checked tc so heading/body/meta text
            // stays readable against any Color Story's secondary/accent —
            // never hardcoded to a specific palette.
            case "event": {
              const e = content.event;
              if (!e?.ceremony && !e?.reception) return null;
              // Location + address render as one body line, not a
              // separate `meta` line — `meta` gets an additional
              // opacity-55 on top of this section's own (already dimmed,
              // on-color-field) textMuted below, and the two compound to
              // ~2:1 contrast against the "strong" canvas background,
              // under WCAG's 3:1 minimum. A single line at the section's
              // normal muted-text weight stays legible on every Color
              // Story, not just ones where that compounding happens not
              // to bite.
              const items: CompositionItem[] = [];
              if (e.ceremony) items.push({
                label: "Ceremony",
                heading: e.ceremony.time ?? "Ceremony",
                body: [e.ceremony.location, e.ceremony.address].filter(Boolean).join(" · "),
              });
              if (e.reception) items.push({
                label: "Reception",
                heading: e.reception.time ?? "Reception",
                body: [e.reception.location, e.reception.address].filter(Boolean).join(" · "),
              });
              const eventRole = tc.sectionRoles?.event;
              const eventStrong = eventRole?.canvas === "strong";
              const eventBg = tc.secondary || tc.accent;
              const eventFg = eventStrong ? contrastText(eventBg) : tc.text;
              const eventTc: ThemeConfig = eventStrong ? { ...tc, text: eventFg, textMuted: `${eventFg}cc` } : tc;
              const venueImage = site.venue?.heroImageUrl;
              return (
                <SectionCanvas key="event" role={eventRole} colors={canvasColors}>
                <SectionWrapper sectionKey="event">
                  <section className={venueImage ? "grid gap-10 @min-[768px]/wedding:grid-cols-5 @min-[768px]/wedding:items-center" : undefined}>
                    <div className={venueImage ? "@min-[768px]/wedding:col-span-3" : undefined}>
                      <SectionHeader title="Event Details" tc={eventTc} accentColor={eventStrong ? eventFg : color} />
                      <SectionComposition recipe={eventTc} tc={eventTc} color={eventStrong ? eventFg : color} items={items} />
                    </div>
                    {venueImage && (
                      <div className="@min-[768px]/wedding:col-span-2">
                        <div className="overflow-hidden" style={{ borderRadius: tc.cardRadius, aspectRatio: "4 / 5" }}>
                          <img src={venueImage} alt={site.venue?.name ?? "The venue"} className="w-full h-full object-cover" />
                        </div>
                        {site.venue?.name && (
                          <p className="text-xs mt-3 text-center opacity-60" style={{ color: eventFg, fontFamily: tc.bodyFont }}>
                            {site.venue.name}
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Photo Gallery ─────────────────────────────────────────────────
            // Collection owns this section's relationship to the page — width,
            // edge treatment, background band; Photo Style owns everything
            // inside GalleryGrid. Neither reads the other's fields.
            case "gallery": {
              const g = content.gallery;
              if (!g?.photos?.length) return null;
              return (
                <SectionCanvas key="gallery" role={tc.sectionRoles?.gallery} colors={canvasColors}>
                <SectionWrapper sectionKey="gallery">
                  <section
                    className={edgeWidthClass(tc.edgeTreatment, 0)}
                    style={tc.sectionBand === "tinted" ? { background: tc.surface, paddingBlock: "3rem" } : undefined}
                  >
                    <div style={{ maxWidth: tc.edgeTreatment === "full-bleed" ? "none" : (tc.contentWidth === "narrow" ? "30rem" : tc.contentWidth === "wide" ? "56rem" : "42rem"), marginInline: tc.edgeTreatment === "full-bleed" ? undefined : "auto" }}>
                      <SectionHeader title={g.title ?? "Our Photos"} tc={tc} accentColor={color} />
                      <GalleryGrid photos={g.photos} tc={tc} />
                    </div>
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Day-of Schedule — a visual timeline for Coastal, the
            // original database-list treatment for every other Collection ──
            case "schedule": {
              if (!content.schedule?.length) return null;
              const items: CompositionItem[] = content.schedule.map(item => ({
                label: item.time, heading: item.title, body: item.description,
              }));
              const scheduleSparse = items.length <= 2;
              // Schedule Desktop Composition — the authoritative event date
              // (same source the hero/countdown already use), never a
              // second date field. Absent on Coastal only when this
              // couple's event has no date synced yet; the decorative
              // field is simply omitted, never fabricated.
              const dateParts = tc.sectionRoles && eventDate ? scheduleDateParts(eventDate) : null;
              const scheduleLeft = (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-3" style={{ color: `${tc.accent || color}95` }}>Our Day</p>
                  <SectionHeader title="Schedule" tc={tc} accentColor={color} />
                  <ScheduleTimeline tc={tc} color={color} labelColor={tc.accent || color} items={items} />
                </>
              );
              return (
                <SectionCanvas key="schedule" role={tc.sectionRoles?.schedule} sparse={scheduleSparse} colors={canvasColors}>
                <SectionWrapper sectionKey="schedule">
                  <section>
                    {tc.sectionRoles ? (
                      dateParts ? (
                        // WW-PREVIEW-01 fix (2026-08-06) — was `lg:grid-cols-12`
                        // (true browser viewport). Schedule's "soft" canvas full
                        // -bleed background (SectionCanvas) and this grid now both
                        // resolve against the same `@container/wedding` boundary
                        // (WeddingWebsite's own root), so Studio's simulated phone
                        // frame correctly collapses this to a single column instead
                        // of the previously-documented Studio-only gap. The real
                        // guest-facing mobile page is unaffected either way — it
                        // was always narrower than 1024px already.
                        <div className="grid grid-cols-1 @min-[1024px]/wedding:grid-cols-12 gap-10 @min-[1024px]/wedding:gap-16 @min-[1024px]/wedding:items-center">
                          <div className="@min-[1024px]/wedding:col-span-7">{scheduleLeft}</div>
                          {/* Mobile/tablet default is clean timeline first (Step 6) —
                              the decorative date moment is a desktop-only field,
                              not a shrunk-down copy stacked underneath. */}
                          <div className="hidden @min-[1024px]/wedding:block @min-[1024px]/wedding:col-span-5">
                            <ScheduleDateMoment tc={tc} color={tc.accent || color} day={dateParts.day} month={dateParts.month} year={dateParts.year} sparse={scheduleSparse} />
                          </div>
                        </div>
                      ) : scheduleLeft
                    ) : (
                      <>
                        <SectionHeader title="Schedule" tc={tc} accentColor={color} />
                        <SectionComposition recipe={tc} tc={tc} color={color} items={items} />
                      </>
                    )}
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Travel & Hotels ───────────────────────────────────────────────
            case "travel": {
              const t = content.travel;
              if (!t?.message && !t?.hotels?.length && !t?.transportation?.notes) return null;
              const items: CompositionItem[] = [
                ...(t.hotels ?? []).map(h => ({
                  heading: h.name,
                  body: h.notes,
                  meta: h.code ? `Code: ${h.code}` : undefined,
                  href: h.url,
                })),
                ...(t.transportation?.notes ? [{ label: "Transportation", heading: "Getting around", body: t.transportation.notes }] : []),
              ];
              return (
                <SectionCanvas key="travel" role={tc.sectionRoles?.travel} sparse={items.length <= 1} colors={canvasColors}>
                <SectionWrapper sectionKey="travel">
                  <section>
                    <SectionHeader title="Travel & Accommodations" tc={tc} accentColor={color} />
                    {t.message && <p className="text-center opacity-65 mb-8 leading-relaxed">{t.message}</p>}
                    <SectionComposition recipe={tc} tc={tc} color={color} items={items} />
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Dress Code (solo fallback — see renderDressCodeWeddingPartyPair
            // for the paired-with-Wedding-Party composition) ──────────────────
            case "dress_code": {
              const dc = content.dress_code;
              if (!dc?.formality && !dc?.description) return null;
              const formalityLabel = dc.formality ? (FORMALITY_LABELS[dc.formality] ?? "") : "";
              return (
                <SectionCanvas key="dress_code" role={tc.sectionRoles?.dress_code} sparse colors={canvasColors}>
                <SectionWrapper sectionKey="dress_code">
                  <section>
                    <SectionHeader title="Dress Code" tc={tc} accentColor={color} />
                    <ContentBlock recipe={tc} tc={tc} color={color}>
                      <div className="space-y-4">
                        {formalityLabel && (
                          <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", fontSize: "1.5rem", color }}>
                            {formalityLabel}
                          </p>
                        )}
                        {dc.description && <p className="leading-relaxed opacity-70">{dc.description}</p>}
                        {dc.colorNote && (
                          <p className="text-sm opacity-55 italic" style={{ fontFamily: tc.headingFont }}>{dc.colorNote}</p>
                        )}
                      </div>
                    </ContentBlock>
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Wedding Party (solo fallback) — Collection composition only,
            // Photo Style is never consulted here, per the locked product
            // model (Photo Style is scoped to the Photo Gallery section). ────
            case "bridal_party": {
              const bp = content.bridal_party;
              if (!bp?.members?.length) return null;
              const members: PartyMember[] = bp.members;
              return (
                <SectionCanvas key="bridal_party" role={tc.sectionRoles?.bridal_party} sparse={members.length <= 2} colors={canvasColors}>
                <SectionWrapper sectionKey="bridal_party">
                  <section>
                    <SectionHeader title={bp.title ?? "Our Wedding Party"} tc={tc} accentColor={color} />
                    <WeddingPartyComposition recipe={tc} tc={tc} color={color} members={members} />
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Things To Do — a small destination moment for Coastal ──────────
            case "things_to_do": {
              const ttd = content.things_to_do;
              if (!ttd?.items?.length) return null;
              const items: CompositionItem[] = ttd.items.map(item => ({
                label: CATEGORY_LABELS[item.category] ?? "Local Favorite",
                heading: item.name,
                body: item.description,
                meta: item.address,
                href: item.url,
              }));
              // Things To Do Sparse/Dense fix — DestinationFeature (Coastal
              // only) reads the raw, richly-typed items directly rather than
              // the lossy CompositionItem mapping above (which stays exactly
              // as it was for every other Collection's SectionComposition
              // fallback, untouched).
              const destinationItems: DestinationItem[] = ttd.items.map(item => ({
                name: item.name,
                categoryLabel: CATEGORY_LABELS[item.category] ?? "Local Favorite",
                description: item.description,
                address: item.address,
                url: item.url,
              }));
              return (
                <SectionCanvas key="things_to_do" role={tc.sectionRoles?.things_to_do} sparse={items.length <= 1} colors={canvasColors}>
                <SectionWrapper sectionKey="things_to_do">
                  <section>
                    {tc.sectionRoles && destinationItems.length === 1 ? (
                      // Exactly one recommendation — Coastal only: an
                      // intentional featured-destination pairing (same
                      // asymmetric "intro beside the one real thing" move as
                      // Schedule's date field), not a small card floating in
                      // a mostly-empty section. Heading/intro keep the same
                      // left-aligned Coastal treatment they already use
                      // everywhere else on the page (Schedule's "Our Day"
                      // included) — never centered, on any viewport.
                      <div className="grid grid-cols-1 @min-[1024px]/wedding:grid-cols-12 gap-8 @min-[1024px]/wedding:gap-14 @min-[1024px]/wedding:items-center">
                        <div className="@min-[1024px]/wedding:col-span-5">
                          <SectionHeader title={ttd.title ?? "Things To Do"} tc={tc} accentColor={color} />
                          {ttd.intro && <p className="opacity-60 leading-relaxed" style={{ color: tc.textMuted }}>{ttd.intro}</p>}
                        </div>
                        <div className="@min-[1024px]/wedding:col-span-7">
                          <DestinationFeature tc={tc} color={color} items={destinationItems} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <SectionHeader title={ttd.title ?? "Things To Do"} tc={tc} accentColor={color} />
                        {ttd.intro && <p className="text-center opacity-60 mb-8 leading-relaxed">{ttd.intro}</p>}
                        {tc.sectionRoles ? (
                          <DestinationFeature tc={tc} color={color} items={destinationItems} />
                        ) : (
                          <SectionComposition recipe={tc} tc={tc} color={color} items={items} />
                        )}
                      </>
                    )}
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Music — a compact romantic interlude for Coastal, never its
            // own section band ──────────────────────────────────────────────
            case "music": {
              const m = content.music;
              if (!m?.ceremony && !m?.cocktail && !m?.reception && !m?.lastDance) return null;
              const tracks = [
                m.ceremony  && { label: "Ceremony",      song: m.ceremony },
                m.cocktail  && { label: "Cocktail Hour", song: m.cocktail },
                m.reception && { label: "Reception",     song: m.reception },
                m.lastDance && { label: "Last Dance",    song: m.lastDance },
              ].filter(Boolean) as { label: string; song: string }[];
              const items: CompositionItem[] = tracks.map(t => ({ label: t.label, heading: t.song }));
              return (
                <SectionCanvas key="music" role={tc.sectionRoles?.music} sparse={items.length <= 1} colors={canvasColors}>
                <SectionWrapper sectionKey="music">
                  <section>
                    {tc.sectionRoles ? (
                      <CompactInterlude tc={tc} color={color} labelColor={tc.accent || color} label={content.music?.title ?? "Our Music"} items={items}
                        footnote={m.doNotPlay ? `Please don't play: ${m.doNotPlay}` : undefined} />
                    ) : (
                      <>
                        <SectionHeader title={content.music?.title ?? "Our Music"} tc={tc} accentColor={color} />
                        <SectionComposition recipe={tc} tc={tc} color={color} items={items} />
                        {m.doNotPlay && (
                          <p className="text-sm opacity-40 text-center pt-4">Please don't play: {m.doNotPlay}</p>
                        )}
                      </>
                    )}
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── Registry (solo fallback — see renderRegistryFaqPair) ──────────
            case "registry": {
              if (!content.registry?.length) return null;
              const items: CompositionItem[] = content.registry.map(r => ({
                heading: r.name, body: r.notes, href: r.url,
              }));
              return (
                <SectionCanvas key="registry" role={tc.sectionRoles?.registry} sparse={items.length <= 1} colors={canvasColors}>
                <SectionWrapper sectionKey="registry">
                  <section>
                    <SectionHeader title="Registry" tc={tc} accentColor={color} />
                    <SectionComposition recipe={tc} tc={tc} color={color} items={items} />
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── FAQ (solo fallback — see renderRegistryFaqPair) ───────────────
            case "faq": {
              if (!content.faq?.length) return null;
              const items: CompositionItem[] = content.faq.map(item => ({
                heading: item.question, body: item.answer,
              }));
              return (
                <SectionCanvas key="faq" role={tc.sectionRoles?.faq} sparse={items.length <= 2} colors={canvasColors}>
                <SectionWrapper sectionKey="faq">
                  <section>
                    <SectionHeader title="FAQ" tc={tc} accentColor={color} />
                    <SectionComposition recipe={tc} tc={tc} color={color} items={items} />
                  </section>
                </SectionWrapper>
                </SectionCanvas>
              );
            }

            // ── RSVP ──────────────────────────────────────────────────────────
            case "rsvp": {
              // rsvpPlacement (Part 1): "inline" keeps the original rounded
              // inset card in the normal section flow; "banner" breaks the
              // card out to full-bleed width, a genuinely different moment
              // in the page rather than just another section. sectionFrame/
              // sectionBand (Visual Expression Pass) shape the surrounding
              // treatment only — RSVP's own business logic is untouched.
              //
              // Coastal Premium Art-Direction Proof Pass (2026-08-03) —
              // presentation only: the banner now echoes the hero's own
              // gradient (same primary/secondary formula from resolveTheme)
              // so the page's closing scene visually rhymes with its
              // opening one, with contrast-checked text for any palette.
              const isBanner = tc.rsvpPlacement === "banner";
              const quiet = tc.sectionComposition === "quiet";
              const rsvpRole = tc.sectionRoles?.rsvp;
              const bannerBg = rsvpRole?.canvas === "strong" ? tc.heroGradient : color;
              // Phase 4A combination-matrix fix (2026-08-07) — this used to
              // re-derive contrast from tc.primary/tc.secondary, but those
              // are not necessarily the colors actually present in
              // tc.heroGradient (e.g. Indigo's primary/secondary resolve to
              // its light `accent` token, #BFB8CE, while its heroGradient is
              // a near-black wash) — on a Color Story where the two diverge,
              // that produced dark-on-dark, nearly invisible RSVP text.
              // tc.heroTextColor is the Color Story's own curated color for
              // exactly this gradient (already used by Hero, above) — reuse
              // it instead of re-deriving contrast from the wrong source.
              const bannerFg = rsvpRole?.canvas === "strong" ? tc.heroTextColor : "white";
              const rsvpCard = (
                <div className={isBanner ? "p-10 @min-[768px]/wedding:p-16" : quiet ? "p-8 @min-[768px]/wedding:p-10" : "p-8 @min-[768px]/wedding:p-12 rounded-3xl"}
                  style={quiet
                    ? { background: "transparent", border: `1px solid ${color}30` }
                    : { background: bannerBg, borderRadius: isBanner ? 0 : tc.cardRadius }}>
                  <div className="text-center mb-8 max-w-xl mx-auto" style={{ color: quiet ? tc.text : bannerFg }}>
                    <h2 style={{ fontFamily: tc.headingFont, color: quiet ? color : bannerFg, fontStyle: tc.headingItalic ? "italic" : "normal", fontSize: isBanner ? "clamp(2rem, 5cqw, 3rem)" : "clamp(1.75rem, 4cqw, 2.5rem)", fontWeight: 600 }}>
                      RSVP
                    </h2>
                    <p className="opacity-70 text-sm mt-2">Enter the code from your invitation to respond.</p>
                    {site.rsvpStats && site.rsvpStats.total > 0 && (
                      <p className="opacity-50 text-xs mt-1">{site.rsvpStats.attending} of {site.rsvpStats.total} guests have responded</p>
                    )}
                  </div>
                  <div className="max-w-xl mx-auto"><RsvpSection accentColor={color} tc={tc} /></div>
                </div>
              );
              return (
                <div key="rsvp" style={{ marginBlock: rsvpRole ? SCALE_MARGIN_RSVP[rsvpRole.scale] : undefined }}>
                <SectionWrapper sectionKey="rsvp">
                  <section className={isBanner ? "relative left-1/2 right-1/2 -mx-[50cqw] w-[100cqw]" : undefined}>
                    {rsvpCard}
                  </section>
                </SectionWrapper>
                </div>
              );
            }

            default: return null;
          }
  }

  return { renderSection: renderSolo, renderSectionPair: renderPair };
}

export function WeddingWebsite({
  site, slug,
  editMode = false,
  disableScrollReveal = false,
  activeSection = null,
  onSectionClick,
}: {
  site: PublicWebsite;
  slug: string;
  editMode?: boolean;
  /** Force sections visible — required inside Studio/wizard phone frames. */
  disableScrollReveal?: boolean;
  activeSection?: string | null;
  onSectionClick?: (key: string) => void;
}) {
  // resolveTheme is pure (no side effects), so it's safe to compute once,
  // up front, and reuse for the password gate too — the gate now shows the
  // couple's actual chosen Typography instead of a hardcoded font (Visual
  // Expression Pass, guardrail #7), by sharing the exact same resolution
  // chain the rest of the page uses rather than duplicating it by hand.
  const tc = resolveTheme(site);
  if (site.requires_password) {
    return <PasswordGate slug={slug} accentColor={tc.primary} headingFont={tc.headingFont} headingItalic={tc.headingItalic} />;
  }

  // Theme supplies a natural accent; a couple's Color Story primary (Part 2)
  // takes precedence, then the legacy single accentColor override, then the
  // Collection/Color-Story-resolved default.
  const color = tc.primary;
  const couple = site.couple;
  const coupleName = couple
    ? [couple.firstName, couple.partnerFirstName].filter(Boolean).join(" & ")
    : "The Couple";
  const eventDate = site.event?.eventDate;
  const eventEndDate = site.event?.eventEndDate;
  const eventDateLabel = eventDate ? formatEventDateRange(eventDate, eventEndDate) : null;
  const du = eventDate ? daysUntil(eventDate) : null;
  const content = site.content ?? {};

  // Section order & visibility: Hosted Experience Platform Phase 2 —
  // prefer the ordered, visibility-filtered `sections` array from
  // experience_sections (the server already excludes hidden sections, so
  // no client-side filtering is needed) over the legacy sectionOrder
  // array. Falls back to the pre-Phase-2 behavior when `sections` is
  // absent or empty, so an experience that predates the Section Model
  // (or a stale cached response) still renders exactly as before.
  const DEFAULT_ORDER = ["story", "event", "gallery", "schedule", "travel", "dress_code", "bridal_party", "things_to_do", "music", "registry", "faq", "rsvp"];
  const sectionOrder = site.sections?.length
    ? site.sections.map(s => s.key).filter(k => k !== "home")
    : (site.sectionOrder?.length ? site.sectionOrder : DEFAULT_ORDER);

  // Load Google Fonts for this theme
  useThemeFonts(tc.fontUrl);

  // Coastal Art-Direction Pass 2 (2026-08-03) — whether each section
  // currently has real content to show, mirroring the exact same
  // null-guards each case below already uses. Computed up front, generically
  // by content shape (never by section index), so the pairing decision below
  // can never disagree with what actually renders.
  const hasContent: Record<string, boolean> = {
    story: !!content.story?.text || editMode,
    event: !!(content.event?.ceremony || content.event?.reception),
    gallery: !!content.gallery?.photos?.length,
    schedule: !!content.schedule?.length,
    travel: !!(content.travel?.message || content.travel?.hotels?.length || content.travel?.transportation?.notes),
    dress_code: !!(content.dress_code?.formality || content.dress_code?.description),
    bridal_party: !!content.bridal_party?.members?.length,
    things_to_do: !!content.things_to_do?.items?.length,
    music: !!(content.music?.ceremony || content.music?.cocktail || content.music?.reception || content.music?.lastDance),
    registry: !!content.registry?.length,
    faq: !!content.faq?.length,
    rsvp: true,
  };

  // Groups adjacent sections into shared passages (Step 6/9) purely from
  // data: both sides must name each other via sectionRoles.pairWith, be
  // immediately adjacent in the couple's OWN section order (never a fixed
  // index), and both currently have content. Reordered apart, hidden, or
  // emptied — each falls back to rendering solo, its normal treatment.
  const renderGroups: (string | [string, string])[] = [];
  {
    const paired = new Set<string>();
    for (let i = 0; i < sectionOrder.length; i++) {
      const key = sectionOrder[i];
      if (paired.has(key)) continue;
      const role = tc.sectionRoles?.[key];
      const next = sectionOrder[i + 1];
      const nextRole = next ? tc.sectionRoles?.[next] : undefined;
      if (role?.pairWith && next && role.pairWith === next && nextRole?.pairWith === key
        && hasContent[key] && hasContent[next]) {
        renderGroups.push([key, next]);
        paired.add(key); paired.add(next);
      } else {
        renderGroups.push(key);
      }
    }
  }

  const { renderSection, renderSectionPair } = createSectionRenderer({
    tc, content, site, color, editMode, disableScrollReveal, activeSection, onSectionClick,
  });

  return (
    // WW-PREVIEW-01 fix (2026-08-06) — this root div is the ONE responsive
    // container for the whole renderer. `@container/wedding` establishes
    // `container-type: inline-size` (a named container, "wedding") here and
    // ONLY here. Every viewport-relative rule below that means "respond to
    // the width WeddingWebsite is actually being rendered at" — full-bleed
    // `cqw` sizing and `@min-[Npx]/wedding:` breakpoint variants — resolves
    // against THIS element's own rendered width, not the outer browser's.
    // That width is already correct in every context that renders this
    // component, with zero Studio-specific code needed here or in Studio:
    // on the public page this div fills the page (cqw ≈ vw, no visual
    // change); in Studio desktop preview it fills the preview pane (already
    // narrower than the app window, since Studio's own sidebar takes space —
    // exactly "the desktop preview surface width", not the full browser);
    // in Studio's simulated phone frame it fills the ~375px frame. Size
    // containment only applies to the inline (horizontal) axis, so the
    // existing `minHeight: "100vh"` below is unaffected.
    <div className="@container/wedding" style={{ background: tc.bg, color: tc.text, fontFamily: tc.bodyFont, minHeight: "100vh" }}>

      {/* ── Hero ── */}
      <Hero site={site} tc={tc} editMode={editMode} onSectionClick={onSectionClick} />

      {/* Welcome message — alignment and scale follow the theme's personality */}
      {content.home?.welcomeMessage && (
        <div className={
          tc.headerStyle === "editorial"
            ? "max-w-4xl mx-auto px-8 py-10"
            : tc.headerStyle === "coastal"
            ? "max-w-3xl mx-auto px-8 py-10"
            : tc.headerStyle === "minimal"
            ? "max-w-xl mx-auto px-8 py-12"
            : "max-w-2xl mx-auto px-6 py-14 text-center"
        }>
          <p style={{
            fontFamily: tc.storyStyle === "quote" || tc.headerStyle === "romantic" ? tc.headingFont : tc.bodyFont,
            fontStyle: tc.headingItalic ? "italic" : "normal",
            fontSize: tc.storyStyle === "quote"
              ? "clamp(1.15rem, 2.5cqw, 1.45rem)"
              : tc.headerStyle === "minimal"
              ? "0.9rem"
              : "clamp(1rem, 2cqw, 1.2rem)",
            lineHeight: 1.8,
            color: tc.headerStyle === "editorial" ? tc.textMuted : tc.headerStyle === "minimal" ? tc.textMuted : tc.text,
            textAlign: (tc.headerStyle === "editorial" || tc.headerStyle === "coastal") ? "left" : "center",
          }}>
            {content.home.welcomeMessage}
          </p>
        </div>
      )}

      {/* ── Sections in couple-defined order ── */}
      {/* Section spacing (Part 1) is the Layout Collection's own call —
          tc.sectionSpacing comes straight from layout_config, real per
          collection, replacing the old headerStyle-keyed guess. */}
      <div
        className="max-w-5xl mx-auto px-6 py-10"
        style={{
          display: "flex",
          flexDirection: "column",
          // sectionRoles (Coastal only, 2026-08-03) replaces the flat gap
          // with each section's own scale-driven margin so Feature/Standard/
          // Interlude sections get genuinely different breathing room —
          // every other Collection keeps the original uniform gap untouched.
          gap: tc.sectionRoles ? "0" : SECTION_SPACING[tc.sectionSpacing],
          scrollSnapType: tc.scrollBehavior === "snap" ? "y proximity" : undefined,
        }}
      >

        {renderGroups.map(group => Array.isArray(group) ? renderSectionPair(group[0], group[1]) : renderSection(group))}

      </div>

      {/* Footer — restrained, never another large empty color band (Step 10) */}
      <div className="text-center py-8 text-xs opacity-30" style={{ fontFamily: tc.bodyFont }}>
        {tc.sectionRoles && <div className="w-6 h-px mx-auto mb-3" style={{ background: tc.accent }} />}
        {coupleName}'s Wedding
      </div>

    </div>
  );
}
