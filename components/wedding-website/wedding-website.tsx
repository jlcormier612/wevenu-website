"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { PublicWebsite, WebsiteTheme } from "@/lib/wedding-website/types";
import { RsvpPage } from "@/components/wedding-website/rsvp-page";
import { GuestConciergeWidget } from "@/components/wedding-website/guest-concierge";
import type { RsvpContext } from "@/app/rsvp/[token]/page";
import {
  SectionComposition, ContentBlock, WeddingPartyComposition, edgeWidthClass,
  SectionCanvas, contrastText, ScheduleTimeline, ScheduleDateMoment, EditorialOpening, PairedPassage, DestinationFeature, CompactInterlude,
  type CompositionItem, type CompositionRecipe, type PartyMember, type SectionRole, type SectionScale, type DestinationItem,
} from "@/components/wedding-website/composition-primitives";

// ── Theme system: Collection (aesthetic DNA) + Palette (color expression) ────
//
// A "collection" is a complete wedding aesthetic: typography, layout, photo
// treatment, decorative elements. A "palette" is a color variation within that
// aesthetic. Couples choose their identity first, then the mood.
//
// Collections: Wildflower · Midnight · Garden Party · Linen · Rosé · Coastal
//              Champagne · Velvet
// Each has 3 palettes. 8 × 3 = 24 distinct experiences.

type CollectionConfig = {
  headingFont: string;
  bodyFont: string;
  headingItalic: boolean;
  fontUrl: string | null;
  heroType: "full-bleed" | "invitation";
  heroMinHeight: string;
  heroAlign: "center" | "left";
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
  // Photo Style — Wedding Website Visual Expression Pass (2026-08-03),
  // gallery-arrangement/per-image treatment, independent of Collection.
  arrangement: "uniform" | "collage" | "scrapbook";
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
type ThemeConfig = CollectionConfig & PaletteConfig & { primary: string; secondary: string };

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

// Scroll-reveal for animationStyle (Part 1) — a couple's Collection choice,
// not per-section. Respects prefers-reduced-motion (architecture spec §11):
// the observer still fires so content always ends visible, it just skips
// straight to the resting state instead of animating into it.
function useScrollReveal(style: CollectionConfig["animationStyle"]) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = React.useState(style === "none");
  React.useEffect(() => {
    if (style === "none" || !ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); io.unobserve(el); }
    }, { threshold: 0.15 });
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

  // Wildflower — English garden party, Playfair Display, pressed botanical elements
  classic: {
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lato', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;600&display=swap",
    heroType: "full-bleed", heroMinHeight: "65vh", heroAlign: "center",
    headerStyle: "romantic", storyStyle: "prose",
    divider: "botanical", cardRadius: "1rem", buttonRadius: "0.75rem", photoRadius: "0.75rem",
    photoFilter: "saturate(0.85) brightness(1.05)",
  },

  // Midnight — atmospheric indigo editorial, DM Sans, Vogue energy
  modern: {
    headingFont: "'DM Sans', system-ui, sans-serif",
    bodyFont: "'DM Sans', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap",
    heroType: "full-bleed", heroMinHeight: "75vh", heroAlign: "left",
    headerStyle: "editorial", storyStyle: "editorial",
    divider: "rule", cardRadius: "0.25rem", buttonRadius: "0", photoRadius: "0",
    photoFilter: "grayscale(0.5) contrast(1.1) brightness(0.9)",
  },

  // Garden Party — English countryside, Georgia, Rifle Paper Co. charm
  garden: {
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "system-ui, sans-serif",
    headingItalic: false,
    fontUrl: null,
    heroType: "full-bleed", heroMinHeight: "60vh", heroAlign: "center",
    headerStyle: "romantic", storyStyle: "prose",
    divider: "dots", cardRadius: "1.5rem", buttonRadius: "99px", photoRadius: "1.5rem",
    photoFilter: "saturate(0.9) brightness(1.08)",
  },

  // Linen — luxury stationery, letterpress, deckled edges, timeless B&W
  // No hero gradient. Like opening a fine invitation suite.
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

  // Coastal — Nantucket, Plus Jakarta Sans, clean airy photography
  coastal: {
    headingFont: "'Plus Jakarta Sans', system-ui, sans-serif",
    bodyFont: "'Plus Jakarta Sans', system-ui, sans-serif",
    headingItalic: false,
    fontUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap",
    heroType: "full-bleed", heroMinHeight: "65vh", heroAlign: "center",
    headerStyle: "coastal", storyStyle: "prose",
    divider: "deco", cardRadius: "0.75rem", buttonRadius: "0.75rem", photoRadius: "0.5rem",
    photoFilter: "saturate(0.75) brightness(1.12) contrast(0.95)",
  },

  // Champagne — Crane & Co. letterpress, Playfair Display, formal portrait tone
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
function resolveTheme(site: PublicWebsite): ThemeConfig {
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

  // Photo Style (Part 4, extended in the Visual Expression Pass) — fully
  // independent of Collection; only touches photoFilter/photoRadius
  // (Collection's own defaults) plus its own fields, never anything Color
  // Story, Typography, or Collection's own sectionComposition/etc. own.
  // `arrangement` (collage/scrapbook) overrides Collection's `galleryLayout`
  // for the Photo Gallery section specifically — the one disclosed
  // exception — nothing else Collection owns is touched.
  const photoOverride = site.photoStyleTokens
    ? { photoFilter: site.photoStyleTokens.photoFilter, photoRadius: site.photoStyleTokens.photoRadius,
        frameStyle: site.photoStyleTokens.frameStyle, captionStyle: site.photoStyleTokens.captionStyle,
        imageScale: site.photoStyleTokens.imageScale,
        arrangement: site.photoStyleTokens.arrangement, scalePattern: site.photoStyleTokens.scalePattern,
        rotation: site.photoStyleTokens.rotation, shadow: site.photoStyleTokens.shadow,
        photoSpacing: site.photoStyleTokens.spacing }
    : null;

  return {
    ...collection, ...layoutOverride, ...palette, ...colorOverride, ...typographyOverride, ...photoOverride,
    primary, secondary,
  };
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

function SectionHeader({ title, tc, accentColor }: { title: string; tc: ThemeConfig; accentColor: string }) {
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
          fontSize: "clamp(0.65rem, 1.1vw, 0.8rem)",
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
          fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
          fontWeight: 600,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
        }}>
          {title}
        </h2>
      </div>
    );
  }

  // Formal — Champagne
  // Thin rules bracketing a tiny all-caps label. Crane & Co. letterpress feeling.
  if (tc.headerStyle === "formal") {
    return (
      <div className="text-center mb-12">
        <div className="mx-auto" style={{ height: "1px", width: "48px", background: `${color}40` }} />
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
        <div className="mx-auto" style={{ height: "1px", width: "48px", background: `${color}40` }} />
      </div>
    );
  }

  // Romantic — Wildflower, Garden Party, Rosé
  // Centered, warm heading in accent color, framed by theme-specific ornamental dividers.
  // Rosé (italic Cormorant Garamond) gets larger — it's breathtaking at size.
  const headingSize = tc.headingItalic
    ? "clamp(1.85rem, 4.5vw, 2.8rem)"
    : "clamp(1.5rem, 3.5vw, 2.2rem)";

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

function GalleryGrid({ photos, tc }: { photos: string[]; tc: ThemeConfig }) {
  const gap = SPACING_GAP[tc.photoSpacing];
  const frame = (i: number, extraRotation = 0): React.CSSProperties => {
    const rot = rotationFor(tc.rotation, i) + extraRotation;
    const base: React.CSSProperties = {
      transform: rot ? `rotate(${rot.toFixed(1)}deg)` : undefined,
      boxShadow: shadowFor(tc.shadow),
    };
    if (tc.frameStyle === "polaroid") return { ...base, background: "#fff", padding: "10px 10px 28px", boxShadow: base.boxShadow === "none" ? "0 6px 20px rgba(0,0,0,0.18)" : base.boxShadow };
    if (tc.frameStyle === "border") return { ...base, border: "6px solid #fff" };
    return base;
  };
  // Two variants: the collage/scrapbook grids give each cell an explicit
  // pixel height (via gridAutoRows), so their images fill it with
  // height:100%. The "uniform" grid/masonry/film-strip paths size rows
  // from the image's own aspect-ratio instead — mixing height:100% with a
  // CSS grid row track sized "auto" is a circular-sizing bug (the row has
  // no independent height to fill, so it collapses towards zero).
  const imgStyleFill: React.CSSProperties = {
    display: "block", width: "100%", height: "100%", objectFit: "cover",
    filter: tc.photoFilter || undefined,
    borderRadius: tc.frameStyle === "polaroid" ? 0 : tc.photoRadius,
  };
  const imgStyle: React.CSSProperties = {
    display: "block", width: "100%", objectFit: "cover",
    filter: tc.photoFilter || undefined,
    borderRadius: tc.frameStyle === "polaroid" ? 0 : tc.photoRadius,
  };

  // ── Magazine: true layered collage — mixed scale, overlap, hierarchy ──
  // Overlapping ranges on a shared grid (not absolute positioning) so it
  // reflows naturally at narrower widths. Hand-designed per photo count,
  // never algorithmic/random, so low counts never look broken.
  //
  // Cropping-safety fix (Coastal Magazine Gallery Remediation): the row
  // unit used to be a fixed rem length (2.75rem) while columns are fluid
  // `1fr` tracks — at this section's ~56rem desktop container that made
  // several slots as wide as 3.5x their height, so `object-fit: cover`
  // cropped portrait-oriented wedding photography (faces, torsos) down to
  // unreadable fragments. Row height is now expressed in `cqw` (a
  // container-query unit — 1% of THIS grid's own rendered width, via
  // `containerType: "inline-size"` below), so row height scales with
  // column width continuously at every viewport, not just at the one
  // width the old rem value happened to look right for. Every pattern
  // below is hand-tuned against that unit so no slot's aspect ratio goes
  // narrower than ~4:5 (portrait) or wider than ~3:2 (landscape) — varied,
  // still editorial, never a sliver.
  if (tc.arrangement === "collage") {
    const n = photos.length;
    const ROW_UNIT = "10cqw";
    const ROW_GAP = "1.5cqw";
    // [gridColumn, gridRow, zIndex] per slot, 6-column grid. Column-span
    // to row-span is held to a safe ratio throughout (2col->3row,
    // 3col->4row, 4col->6row, 5col->7row) so every slot's aspect ratio
    // stays in the ~4:5–3:2 range regardless of which photo lands there —
    // patterns don't know each photo's real orientation, so the bound is
    // symmetric rather than tuned to any one image. Patterns defined for
    // 1-4; 5+ repeats the 4-pattern in successive bands, shifted down by
    // that pattern's own row-track count (computed below, not hardcoded)
    // so bands never collide or overlap into each other.
    const patterns: Record<number, [string, string, number][]> = {
      1: [["1 / 6", "1 / 8", 1]],
      2: [
        ["1 / 5", "1 / 7", 1],
        ["4 / 7", "4 / 8", 2],
      ],
      3: [
        ["1 / 5", "1 / 7", 1],
        ["4 / 7", "1 / 5", 2],
        ["4 / 7", "5 / 9", 3],
      ],
      4: [
        ["1 / 5", "1 / 7", 1],
        ["4 / 7", "1 / 5", 2],
        ["1 / 4", "7 / 11", 2],
        ["4 / 7", "6 / 10", 3],
      ],
    };
    const band4 = patterns[4];
    const bandRowSpan = Math.max(...band4.map(([, row]) => parseInt(row.split(" / ")[1], 10))) - 1;
    const collageImgStyle: React.CSSProperties = { ...imgStyleFill, objectPosition: "50% 35%" };
    // `cqw` on gridAutoRows must resolve against an ANCESTOR's containment,
    // not the grid's own — a container-query length set on the same
    // element that declares containment doesn't resolve against itself
    // (spec-defined, to avoid circularity), it silently falls back to the
    // viewport instead, which reintroduces exactly the container-width-vs-
    // viewport-width mismatch this fix exists to remove. The grid and its
    // `containerType: inline-size` therefore live on two different divs.
    return (
      <div style={{ containerType: "inline-size" }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(6, 1fr)", gridAutoRows: ROW_UNIT,
            columnGap: "0.75rem", rowGap: ROW_GAP,
            overflow: "hidden",
          }}
        >
          {photos.map((url, i) => {
            const band = patterns[Math.min(n, 4) as 1 | 2 | 3 | 4];
            const [col, row, z] = band[i % band.length];
            // Offset each successive band further down so 5+ photos stack in new rows, not on top of earlier ones.
            const bandIndex = Math.floor(i / 4);
            const rowShift = bandIndex * bandRowSpan;
            const [rowStart, rowEnd] = row.split(" / ").map(Number);
            return (
              <div key={i} className="overflow-hidden"
                style={{
                  gridColumn: col, gridRow: `${rowStart + rowShift} / ${rowEnd + rowShift}`, zIndex: z,
                  borderRadius: tc.photoRadius, ...frame(i, i % 2 === 0 ? -1.5 : 1.5),
                }}>
                <img src={url} alt="" style={collageImgStyle} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Scrapbook: collected, tactile, overlapping-adjacent placement ──
  // Every photo polaroid-framed with scattered rotation; slight deliberate
  // overlap between neighbors reads as "photos placed on a table," not a
  // grid with rotated corners.
  if (tc.arrangement === "scrapbook") {
    return (
      <div className="flex flex-wrap justify-center" style={{ rowGap: "2rem", paddingInline: "1.5rem" }}>
        {photos.map((url, i) => (
          <div key={i} className="overflow-hidden shrink-0"
            style={{
              width: "42%", maxWidth: "260px",
              marginTop: i % 3 === 1 ? "1.5rem" : "0",
              marginLeft: i > 0 ? "-1.25rem" : "0",
              zIndex: i,
              ...frame(i),
            }}>
            <img src={url} alt="" style={{ ...imgStyle, aspectRatio: "1 / 1" }} />
          </div>
        ))}
      </div>
    );
  }

  // ── Uniform arrangement — Editorial/Film/Minimal/Modern/Luxury ──
  // Collection's galleryLayout (grid/masonry/film-strip) still picks the
  // outer structure; scalePattern varies per-image size/emphasis within it.
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
    return (
      <div className={`grid ${tc.imageScale === "large" ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`} style={{ gap }}>
        {photos.map((url, i) => (
          <div key={i} className={`overflow-hidden ${spanFor(i, photos.length)}`} style={{ borderRadius: tc.photoRadius, ...frame(i) }}>
            <img src={url} alt="" style={{ ...imgStyle, aspectRatio: aspectFor(i) }} />
          </div>
        ))}
      </div>
    );
  }

  // masonry — the original free-flowing columns treatment
  return (
    <div className={`columns-2 space-y-3 ${tc.imageScale === "large" ? "md:columns-2" : "md:columns-3 lg:columns-4"}`} style={{ columnGap: gap }}>
      {photos.map((url, i) => (
        <div key={i} className="break-inside-avoid overflow-hidden" style={{ borderRadius: tc.photoRadius, marginBottom: gap, ...frame(i) }}>
          <img src={url} alt="" style={imgStyle} />
        </div>
      ))}
    </div>
  );
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

  const inputStyle = {
    background: tc.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
    border: `1px solid ${tc.dark ? "rgba(255,255,255,0.15)" : "#DED6CA"}`,
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
    <div className="p-6 space-y-5" style={{ background: tc.dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)", borderRadius: tc.cardRadius, color: tc.dark ? tc.text : "#333" }}>
      <form onSubmit={handleLookup} className="space-y-3">
        <p className="text-sm font-medium">Enter the RSVP code from your invitation</p>
        <input value={token} onChange={e => setToken(e.target.value)} placeholder="Your RSVP code"
          className="w-full px-4 py-3 text-sm focus:outline-none" style={inputStyle} />
        <button type="submit" disabled={!token.trim() || checking}
          className="w-full py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: accentColor, borderRadius: tc.buttonRadius }}>
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

// ── Category icons for Things To Do ──────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: "🍽",
  cafe:       "☕",
  attraction: "🗺",
  hotel:      "🏨",
  shopping:   "🛍",
  other:      "✦",
};

// Things To Do Sparse/Dense Fix — a text eyebrow for Coastal's own
// DestinationFeature treatment (Step 8: "category as a small editorial
// label"), kept separate from CATEGORY_ICONS above so every other
// Collection's existing emoji-icon rendering (via the shared
// CompositionItem `items` array and SectionComposition) is untouched.
const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe:       "Café",
  attraction: "Attraction",
  hotel:      "Hotel",
  shopping:   "Shopping",
  other:      "Local Favorite",
};

// ── Main public website ───────────────────────────────────────────────────────

export function WeddingWebsite({
  site, slug,
  editMode = false,
  activeSection = null,
  onSectionClick,
}: {
  site: PublicWebsite;
  slug: string;
  editMode?: boolean;
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
  React.useEffect(() => {
    if (!tc.fontUrl) return;
    const existing = document.head.querySelector(`link[data-wevenu-font]`);
    if (existing) existing.remove();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = tc.fontUrl;
    link.setAttribute("data-wevenu-font", "1");
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [tc.fontUrl]);

  // Hero background — the couple's own cover photo always wins when set.
  // venues.hero_image_url (Coastal Premium Art-Direction Proof Pass,
  // 2026-08-03) is a safe fallback only — never replaces a couple-selected
  // hero — and only when no cover photo exists does the theme's personality
  // gradient apply. COUPLE = STORY, VENUE = PLACE.
  const heroImage = content.home?.coverImageUrl || site.venue?.heroImageUrl || null;
  const hascover = !!heroImage;
  const heroStyle: React.CSSProperties = hascover
    ? { backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center",
        filter: tc.photoFilter || undefined }
    : { background: tc.heroGradient };

  // Wraps each section in an edit overlay when editMode=true, and — always,
  // edit mode or not — in the Collection's own scroll-reveal + scroll-snap
  // behavior (Part 1), so every section gets it with zero per-section edits.
  function SectionWrapper({ sectionKey, children }: { sectionKey: string; children: React.ReactNode }) {
    const revealed = (
      <ScrollReveal style={tc.animationStyle} scrollSnap={tc.scrollBehavior === "snap"}>
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

  const canvasColors = { surface: tc.surface, secondary: tc.secondary, accent: tc.accent };

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

              return (
                <SectionCanvas key="story" role={tc.sectionRoles?.story} sparse={storySparse} colors={canvasColors}>
                <SectionWrapper sectionKey="story">
                  <section>
                    {tc.sectionRoles ? (
                      <EditorialOpening tc={tc} color={color} labelColor={tc.accent || color} eyebrow="Our Story" heading={s.title ?? "How it began"} text={s.text} photoUrl={storyPhoto} />
                    ) : (
                      <>
                    <SectionHeader title={s.title ?? "Our Story"} tc={tc} accentColor={color} />

                    {tc.storyStyle === "quote" ? (
                      // Rosé — large italic pull quote, centered, like a love letter
                      <div className="max-w-xl mx-auto text-center px-4">
                        <p style={{
                          fontFamily: tc.headingFont,
                          fontStyle: "italic",
                          fontSize: "clamp(1.35rem, 3vw, 1.9rem)",
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
                    ) : tc.storyStyle === "editorial" ? (
                      // Velvet / Midnight — left-aligned measured prose, body text scale
                      <div className="max-w-2xl">
                        <p style={{
                          fontFamily: tc.bodyFont,
                          fontSize: "1rem",
                          lineHeight: 1.9,
                          color: tc.textMuted,
                          letterSpacing: "0.01em",
                        }}>
                          {s.text}
                        </p>
                      </div>
                    ) : (
                      // prose — Wildflower, Garden Party, Coastal, Champagne
                      <div className="max-w-xl mx-auto text-center px-4">
                        <p style={{
                          fontFamily: tc.headingFont,
                          fontStyle: tc.headingItalic ? "italic" : "normal",
                          fontSize: "clamp(1rem, 2vw, 1.2rem)",
                          lineHeight: 1.85,
                          color: tc.text,
                        }}>
                          {s.text}
                        </p>
                      </div>
                    )}
                      </>
                    )}
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
              const items: CompositionItem[] = [];
              if (e.ceremony) items.push({
                label: "Ceremony",
                heading: e.ceremony.time ?? "Ceremony",
                body: e.ceremony.location,
                meta: e.ceremony.address,
              });
              if (e.reception) items.push({
                label: "Reception",
                heading: e.reception.time ?? "Reception",
                body: e.reception.location,
                meta: e.reception.address,
              });
              const eventRole = tc.sectionRoles?.event;
              const eventStrong = eventRole?.canvas === "strong";
              const eventBg = tc.secondary || tc.accent;
              const eventFg = eventStrong ? contrastText(eventBg) : tc.text;
              const eventTc: ThemeConfig = eventStrong ? { ...tc, text: eventFg, textMuted: `${eventFg}b0` } : tc;
              const venueImage = site.venue?.heroImageUrl;
              return (
                <SectionCanvas key="event" role={eventRole} colors={canvasColors}>
                <SectionWrapper sectionKey="event">
                  <section className={venueImage ? "grid gap-10 md:grid-cols-5 md:items-center" : undefined}>
                    <div className={venueImage ? "md:col-span-3" : undefined}>
                      <SectionHeader title="Event Details" tc={eventTc} accentColor={eventStrong ? eventFg : color} />
                      <SectionComposition recipe={eventTc} tc={eventTc} color={eventStrong ? eventFg : color} items={items} />
                    </div>
                    {venueImage && (
                      <div className="md:col-span-2">
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
                        // `lg:` (1024px viewport) — Schedule's canvas role is
                        // "soft" (see SectionCanvas below), which paints its
                        // full-bleed background using `w-screen`/`-mx-[50vw]`:
                        // an intentional, pre-existing technique that always
                        // measures the true browser viewport, never an
                        // ancestor's rendered width. That makes a container
                        // query no more (and no less) correct here than a
                        // viewport breakpoint — both resolve identically on
                        // the real public page, since `w-screen` guarantees
                        // this section's content width already equals the
                        // viewport at every real width. `lg:` is kept for
                        // consistency with the rest of this file (Our Story's
                        // EditorialOpening etc. all use viewport breakpoints).
                        // Known limitation: Studio's mobile preview fakes
                        // narrowness with a CSS-width-constrained container
                        // inside a full desktop-width browser viewport, which
                        // `w-screen` sees straight through — so this specific
                        // "soft"-canvas section cannot be made to visually
                        // collapse inside Studio's phone frame without either
                        // a Studio-specific prop (explicitly out of scope —
                        // "do not create a Studio-only Schedule renderer") or
                        // changing SectionCanvas's shared full-bleed technique
                        // (touches every "strong"/"soft" section on the page,
                        // not just Schedule — out of this pass's scope). The
                        // real guest-facing mobile page is unaffected — this
                        // is a Studio-preview-only cosmetic gap.
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 lg:items-center">
                          <div className="lg:col-span-7">{scheduleLeft}</div>
                          {/* Mobile/tablet default is clean timeline first (Step 6) —
                              the decorative date moment is a desktop-only field,
                              not a shrunk-down copy stacked underneath. */}
                          <div className="hidden lg:block lg:col-span-5">
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
                <SectionCanvas key="travel" role={tc.sectionRoles?.travel} sparse={items.length <= 1} colors={{ surface: tc.surface, secondary: tc.secondary, accent: tc.accent }}>
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
                label: CATEGORY_ICONS[item.category] ?? "✦",
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
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 lg:items-center">
                        <div className="lg:col-span-5">
                          <SectionHeader title={ttd.title ?? "Things To Do"} tc={tc} accentColor={color} />
                          {ttd.intro && <p className="opacity-60 leading-relaxed" style={{ color: tc.textMuted }}>{ttd.intro}</p>}
                        </div>
                        <div className="lg:col-span-7">
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
              const bannerFg = rsvpRole?.canvas === "strong" ? contrastText(tc.secondary || tc.primary) : "white";
              const rsvpCard = (
                <div className={isBanner ? "p-10 md:p-16" : quiet ? "p-8 md:p-10" : "p-8 md:p-12 rounded-3xl"}
                  style={quiet
                    ? { background: "transparent", border: `1px solid ${color}30` }
                    : { background: bannerBg, borderRadius: isBanner ? 0 : tc.cardRadius }}>
                  <div className="text-center mb-8 max-w-xl mx-auto" style={{ color: quiet ? tc.text : bannerFg }}>
                    <h2 style={{ fontFamily: tc.headingFont, color: quiet ? color : bannerFg, fontStyle: tc.headingItalic ? "italic" : "normal", fontSize: isBanner ? "clamp(2rem, 5vw, 3rem)" : "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 600 }}>
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
                  <section className={isBanner ? "relative left-1/2 right-1/2 -mx-[50vw] w-screen" : undefined}>
                    {rsvpCard}
                  </section>
                </SectionWrapper>
                </div>
              );
            }

            default: return null;
          }
  }

  return (
    <div style={{ background: tc.bg, color: tc.text, fontFamily: tc.bodyFont, minHeight: "100vh" }}>

      {/* ── Hero ── */}
      {/* Linen: invitation layout — no gradient, printed, centered text only */}
      {tc.heroType === "invitation" && !hascover ? (
        <div
          className={`px-8 pt-20 pb-16 text-center ${editMode ? "group cursor-pointer relative" : ""}`}
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
          <div className="max-w-sm mx-auto" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p style={{ fontFamily: tc.bodyFont, fontSize: "0.6rem", letterSpacing: "0.45em", textTransform: "uppercase", color: tc.textMuted, fontWeight: 400 }}>
              {site.event?.eventType?.replace(/_/g, " ") ?? "Wedding"}
            </p>
            <h1 style={{ fontFamily: tc.headingFont, fontSize: "clamp(2.2rem, 6vw, 3.8rem)", fontWeight: 400, lineHeight: 1.1, color: tc.text, letterSpacing: "0.03em" }}>
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
        </div>
      ) : (
      <div
        className={`relative flex flex-col ${tc.heroAlign === "left" ? "items-start justify-end pb-14 pl-8" : "items-center justify-center"} px-6 py-20 ${editMode ? "group cursor-pointer" : ""}`}
        style={{ ...heroStyle, minHeight: tc.heroMinHeight }}
        onClick={editMode ? () => onSectionClick?.("home") : undefined}
      >
        {/* Overlay — softens cover photos; unused for gradient heroes */}
        <div className="absolute inset-0"
          style={{ background: tc.heroOverlayColor, opacity: hascover ? tc.heroOverlayOpacity : 0 }} />

        {editMode && (
          <button type="button" onClick={() => onSectionClick?.("home")}
            className="absolute top-3 right-3 z-20 text-xs font-semibold px-2.5 py-1.5 rounded-xl text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `${color}CC` }}>
            ✏ Edit home
          </button>
        )}

        {tc.heroAlign === "left" ? (
          // Editorial layout — Velvet / Midnight: left-bottom, magazine-cover energy
          <div className="relative z-10 max-w-5xl w-full" style={{ color: tc.heroTextColor }}>
            <div className="mb-4 w-10 h-px" style={{ background: color }} />
            <h1 style={{
              fontFamily: tc.headingFont,
              color: tc.heroTextColor,
              fontStyle: "normal",
              fontSize: "clamp(3rem, 8vw, 6rem)",
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
        ) : (
          // Centered layout — all other themes
          tc.sectionRoles ? (
            // Coastal Art-Direction Pass 2 (2026-08-03) — editorial hierarchy:
            // eyebrow -> atmospheric phrase -> couple names (unmistakable
            // primary identity) -> ONE authoritative date+location line.
            // `subtitle` is a free-text field a couple can type anything
            // into (Studio's own placeholder used to suggest a date, which
            // is exactly the collision this fixes) — it now always reads as
            // a lead-in phrase ahead of the names, never a second date
            // candidate, and eventDate (the synced, authoritative source)
            // is the only place a date is ever rendered in this hero.
            <div className="relative z-10 max-w-3xl mx-auto text-center" style={{ color: tc.heroTextColor }}>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-70 mb-5">
                {site.event?.eventType?.replace(/_/g, " ") ?? "Wedding"}
              </p>
              {content.home?.subtitle && (
                <p className="text-base md:text-lg italic opacity-80 mb-4" style={{ fontFamily: tc.headingFont }}>
                  {content.home.subtitle}
                </p>
              )}
              <h1 style={{
                fontFamily: tc.headingFont,
                color: tc.heroTextColor,
                fontStyle: tc.headingItalic ? "italic" : "normal",
                fontSize: "clamp(2.5rem, 8vw, 5rem)",
                fontWeight: 600,
                lineHeight: 1.1,
                textShadow: "0 2px 20px rgba(0,0,0,0.25)",
              }}>
                {content.home?.title ?? coupleName}
              </h1>
              {(eventDate || content.event?.ceremony?.location || site.venue?.name) && (
                <p className="pt-5 text-base md:text-lg opacity-90" style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal" }}>
                  {[eventDateLabel, content.event?.ceremony?.location ?? site.venue?.name ?? null]
                    .filter(Boolean).join(" · ")}
                </p>
              )}
              {du !== null && du > 0 && (
                <p className="text-sm opacity-60 pt-1">{du} days to go</p>
              )}
            </div>
          ) : (
          <div className="relative z-10 space-y-5 max-w-3xl mx-auto text-center" style={{ color: tc.heroTextColor }}>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-70">
              {site.event?.eventType?.replace(/_/g, " ") ?? "Wedding"}
            </p>
            <h1 style={{
              fontFamily: tc.headingFont,
              color: tc.heroTextColor,
              fontStyle: tc.headingItalic ? "italic" : "normal",
              fontSize: "clamp(2.5rem, 8vw, 5rem)",
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
          )
        )}
      </div>
      )}

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
              ? "clamp(1.15rem, 2.5vw, 1.45rem)"
              : tc.headerStyle === "minimal"
              ? "0.9rem"
              : "clamp(1rem, 2vw, 1.2rem)",
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

        {renderGroups.map(group => Array.isArray(group) ? renderPair(group[0], group[1]) : renderSolo(group))}

      </div>

      {/* Footer — restrained, never another large empty color band (Step 10) */}
      <div className="text-center py-8 text-xs opacity-30" style={{ fontFamily: tc.bodyFont }}>
        {tc.sectionRoles && <div className="w-6 h-px mx-auto mb-3" style={{ background: tc.accent }} />}
        {coupleName}'s Wedding
      </div>

    </div>
  );
}
