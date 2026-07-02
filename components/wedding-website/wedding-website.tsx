"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { PublicWebsite, WebsiteTheme } from "@/lib/wedding-website/types";

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
};

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

// ThemeConfig is what the renderer works with: collection DNA + resolved palette
type ThemeConfig = CollectionConfig & PaletteConfig;

// ── Collections ───────────────────────────────────────────────────────────────
const COLLECTIONS: Record<string, CollectionConfig> = {

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

function resolveTheme(collectionKey: string | undefined, paletteKey?: string | null): ThemeConfig {
  const key = collectionKey ?? "classic";
  const collection = COLLECTIONS[key] ?? COLLECTIONS.classic;
  const palettes = PALETTES[key] ?? PALETTES.classic;
  const palette = (paletteKey
    ? palettes.find(p => p.name.toLowerCase() === paletteKey.toLowerCase())
    : null) ?? palettes[0];
  return { ...collection, ...palette };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEventDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
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

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ slug, accentColor }: { slug: string; accentColor: string }) {
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
          <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.25rem", color: "#5D6F5D" }}>
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

function RsvpSection({ accentColor, tc }: { accentColor: string; tc: ThemeConfig }) {
  const [token, setToken] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "found" | "submitted">("idle");
  const [guestName, setGuestName] = React.useState("");
  const [rsvpStatus, setRsvpStatus] = React.useState("attending");
  const [dietary, setDietary] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const inputStyle = {
    background: tc.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
    border: `1px solid ${tc.dark ? "rgba(255,255,255,0.15)" : "#DED6CA"}`,
    color: tc.dark ? "#F5E8D0" : "#333",
    borderRadius: tc.buttonRadius,
  };

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (token.trim().length > 10) setStatus("found");
    else toast.error("Please enter your full RSVP code from your invitation.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/rsvp", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ rsvpToken: token, status: rsvpStatus, dietary }),
      });
      const data = await res.json() as { ok: boolean; guestName?: string };
      if (data.ok) { setGuestName(data.guestName ?? ""); setStatus("submitted"); }
      else toast.error("Could not submit RSVP. Please try again.");
    } catch { toast.error("Something went wrong."); }
    finally { setSubmitting(false); }
  }

  if (status === "submitted") {
    return (
      <div className="p-8 text-center space-y-3" style={{ background: "rgba(255,255,255,0.1)", borderRadius: tc.cardRadius }}>
        <p className="text-3xl">💗</p>
        <p style={{ fontFamily: tc.headingFont, fontSize: "1.25rem", fontStyle: tc.headingItalic ? "italic" : "normal" }}>
          Thank you{guestName ? `, ${guestName}` : ""}!
        </p>
        <p className="text-sm opacity-75">We've received your RSVP and can't wait to celebrate with you.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5" style={{ background: tc.dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)", borderRadius: tc.cardRadius, color: tc.dark ? tc.text : "#333" }}>
      {status === "idle" ? (
        <form onSubmit={handleLookup} className="space-y-3">
          <p className="text-sm font-medium">Enter the RSVP code from your invitation</p>
          <input value={token} onChange={e => setToken(e.target.value)} placeholder="Your RSVP code"
            className="w-full px-4 py-3 text-sm focus:outline-none" style={inputStyle} />
          <button type="submit" disabled={!token.trim()}
            className="w-full py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: accentColor, borderRadius: tc.buttonRadius }}>
            Find My Invitation →
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm font-medium">Will you be attending?</p>
          <div className="grid grid-cols-3 gap-2">
            {[["attending", "Joyfully accepts"], ["declined", "Regretfully declines"], ["maybe", "Maybe"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setRsvpStatus(v)}
                className="py-3 text-sm font-medium transition-colors"
                style={{
                  borderRadius: tc.buttonRadius,
                  border: "1px solid",
                  ...(rsvpStatus === v
                    ? { background: accentColor, borderColor: accentColor, color: "white" }
                    : { background: "transparent", borderColor: "#DED6CA", color: "inherit" }),
                }}>
                {l}
              </button>
            ))}
          </div>
          {rsvpStatus === "attending" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium opacity-70">Dietary restrictions (optional)</p>
              <input value={dietary} onChange={e => setDietary(e.target.value)} placeholder="e.g., vegetarian, nut allergy"
                className="w-full px-4 py-2.5 text-sm focus:outline-none" style={inputStyle} />
            </div>
          )}
          <button type="submit" disabled={submitting}
            className="w-full py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: accentColor, borderRadius: tc.buttonRadius }}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Submit RSVP →"}
          </button>
        </form>
      )}
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
  if (site.requires_password) {
    return <PasswordGate slug={slug} accentColor={site.accentColor ?? "#5D6F5D"} />;
  }

  const tc = resolveTheme(site.theme, site.themePalette);
  // Theme supplies a natural accent; couples can override it with a custom accentColor.
  const color = site.accentColor ?? tc.accent;
  const couple = site.couple;
  const coupleName = couple
    ? [couple.firstName, couple.partnerFirstName].filter(Boolean).join(" & ")
    : "The Couple";
  const eventDate = site.event?.eventDate;
  const du = eventDate ? daysUntil(eventDate) : null;
  const content = site.content ?? {};

  // Section order: use custom order if set, otherwise sensible default
  const DEFAULT_ORDER = ["story", "event", "gallery", "schedule", "travel", "dress_code", "bridal_party", "things_to_do", "music", "registry", "faq", "rsvp"];
  const sectionOrder = site.sectionOrder?.length ? site.sectionOrder : DEFAULT_ORDER;

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

  // Hero background — when no cover photo use the theme's personality gradient
  const hascover = !!content.home?.coverImageUrl;
  const heroStyle: React.CSSProperties = hascover
    ? { backgroundImage: `url(${content.home!.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center",
        filter: tc.photoFilter || undefined }
    : { background: tc.heroGradient };

  // Wraps each section in an edit overlay when editMode=true
  function SectionWrapper({ sectionKey, children }: { sectionKey: string; children: React.ReactNode }) {
    if (!editMode) return <>{children}</>;
    const isActive = activeSection === sectionKey;
    return (
      <div
        className={`relative group cursor-pointer transition-all rounded-2xl ${isActive ? "ring-2 ring-offset-2" : ""}`}
        style={isActive ? { "--tw-ring-color": `${color}60` } as React.CSSProperties : {}}
        onClick={() => onSectionClick?.(sectionKey)}
      >
        {children}
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
                {formatEventDate(eventDate)}
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
                  {formatEventDate(eventDate)}
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
                  {formatEventDate(eventDate)}
                </p>
                {du !== null && du > 0 && (
                  <p className="text-sm opacity-60">{du} days to go</p>
                )}
              </div>
            )}
          </div>
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
      <div
        className="max-w-5xl mx-auto px-6 py-10"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tc.headerStyle === "minimal" ? "6.5rem"
            : tc.headerStyle === "editorial" ? "4rem"
            : tc.headerStyle === "formal" ? "4.5rem"
            : "5rem",
        }}
      >

        {sectionOrder.map(key => {
          switch (key) {

            // ── Our Story ──────────────────────────────────────────────────────
            case "story": {
              const s = content.story;
              if (!s?.text) return editMode ? (
                <SectionWrapper key="story" sectionKey="story">
                  <section className="py-4">
                    <p style={{ fontSize: "0.8rem", opacity: 0.3, fontStyle: "italic" }}>Your story will appear here.</p>
                  </section>
                </SectionWrapper>
              ) : null;

              return (
                <SectionWrapper key="story" sectionKey="story">
                  <section>
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
                  </section>
                </SectionWrapper>
              );
            }

            // ── Event Details ─────────────────────────────────────────────────
            case "event": {
              const e = content.event;
              if (!e?.ceremony && !e?.reception) return null;
              return (
                <SectionWrapper key="event" sectionKey="event">
                  <section>
                    <SectionHeader title="Event Details" tc={tc} accentColor={color} />
                    <div className="grid gap-5 md:grid-cols-2">
                      {e.ceremony && (
                        <div className="p-6 text-center space-y-2"
                          style={{ border: `1px solid ${color}25`, borderRadius: tc.cardRadius, background: tc.surface }}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: `${color}70` }}>Ceremony</p>
                          {e.ceremony.time && <p style={{ fontFamily: tc.headingFont, fontSize: "1.15rem" }}>{e.ceremony.time}</p>}
                          {e.ceremony.location && <p style={{ color: tc.text }}>{e.ceremony.location}</p>}
                          {e.ceremony.address && <p className="text-sm opacity-55">{e.ceremony.address}</p>}
                        </div>
                      )}
                      {e.reception && (
                        <div className="p-6 text-center space-y-2"
                          style={{ border: `1px solid ${color}25`, borderRadius: tc.cardRadius, background: tc.surface }}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: `${color}70` }}>Reception</p>
                          {e.reception.time && <p style={{ fontFamily: tc.headingFont, fontSize: "1.15rem" }}>{e.reception.time}</p>}
                          {e.reception.location && <p style={{ color: tc.text }}>{e.reception.location}</p>}
                          {e.reception.address && <p className="text-sm opacity-55">{e.reception.address}</p>}
                        </div>
                      )}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── Photo Gallery ─────────────────────────────────────────────────
            case "gallery": {
              const g = content.gallery;
              if (!g?.photos?.length) return null;
              return (
                <SectionWrapper key="gallery" sectionKey="gallery">
                  <section>
                    <SectionHeader title={g.title ?? "Our Photos"} tc={tc} accentColor={color} />
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
                      {g.photos.map((url, i) => (
                        <div key={i} className="break-inside-avoid overflow-hidden"
                          style={{ borderRadius: tc.photoRadius }}>
                          <img src={url} alt="" className="w-full object-cover"
                            style={{ display: "block", filter: tc.photoFilter || undefined }} />
                        </div>
                      ))}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── Day-of Schedule ───────────────────────────────────────────────
            case "schedule": {
              if (!content.schedule?.length) return null;
              return (
                <SectionWrapper key="schedule" sectionKey="schedule">
                  <section>
                    <SectionHeader title="Schedule" tc={tc} accentColor={color} />
                    <div className="space-y-6">
                      {content.schedule.map((item, i) => (
                        <div key={i} className="flex gap-5 items-start">
                          <span className="shrink-0 w-20 text-right opacity-50 text-sm pt-0.5"
                            style={{ fontFamily: tc.bodyFont }}>{item.time}</span>
                          <div className="flex-1 pl-5 pb-6" style={{ borderLeft: `2px solid ${color}35` }}>
                            <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal" }}>{item.title}</p>
                            {item.description && <p className="text-sm opacity-55 mt-1">{item.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── Travel & Hotels ───────────────────────────────────────────────
            case "travel": {
              const t = content.travel;
              if (!t?.message && !t?.hotels?.length && !t?.transportation?.notes) return null;
              return (
                <SectionWrapper key="travel" sectionKey="travel">
                  <section>
                    <SectionHeader title="Travel & Accommodations" tc={tc} accentColor={color} />
                    {t.message && <p className="text-center opacity-65 mb-8 leading-relaxed">{t.message}</p>}
                    {t.hotels?.map((h, i) => (
                      <div key={i} className="p-5 mb-4 space-y-1.5"
                        style={{ border: `1px solid ${color}25`, borderRadius: tc.cardRadius, background: tc.surface }}>
                        <p style={{ fontFamily: tc.headingFont }}>{h.name}</p>
                        {h.code && <p className="text-sm opacity-55">Code: <span className="font-mono font-medium">{h.code}</span></p>}
                        {h.notes && <p className="text-sm opacity-55">{h.notes}</p>}
                        {h.url && <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-2" style={{ color }}>{h.url}</a>}
                      </div>
                    ))}
                    {t.transportation?.notes && (
                      <div className="p-5" style={{ border: `1px solid ${color}25`, borderRadius: tc.cardRadius, background: tc.surface }}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2 opacity-50">Transportation</p>
                        <p className="text-sm opacity-65 leading-relaxed">{t.transportation.notes}</p>
                      </div>
                    )}
                  </section>
                </SectionWrapper>
              );
            }

            // ── Dress Code ────────────────────────────────────────────────────
            case "dress_code": {
              const dc = content.dress_code;
              if (!dc?.formality && !dc?.description) return null;
              const formalityLabel = dc.formality ? (FORMALITY_LABELS[dc.formality] ?? "") : "";
              return (
                <SectionWrapper key="dress_code" sectionKey="dress_code">
                  <section>
                    <SectionHeader title="Dress Code" tc={tc} accentColor={color} />
                    <div className="max-w-lg mx-auto text-center space-y-4">
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
                  </section>
                </SectionWrapper>
              );
            }

            // ── Wedding Party ─────────────────────────────────────────────────
            case "bridal_party": {
              const bp = content.bridal_party;
              if (!bp?.members?.length) return null;
              return (
                <SectionWrapper key="bridal_party" sectionKey="bridal_party">
                  <section>
                    <SectionHeader title={bp.title ?? "Our Wedding Party"} tc={tc} accentColor={color} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                      {bp.members.map((m, i) => (
                        <div key={i} className="text-center space-y-2">
                          {m.photoUrl ? (
                            <div className="overflow-hidden mx-auto"
                              style={{ width: "80px", height: "80px", borderRadius: "50%", border: `2px solid ${color}30` }}>
                              <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="mx-auto flex items-center justify-center"
                              style={{ width: "72px", height: "72px", borderRadius: "50%", background: `${color}15`, border: `2px solid ${color}25`, color, fontSize: "1.5rem" }}>
                              {m.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm" style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal" }}>{m.name}</p>
                            <p className="text-[11px] opacity-55">{m.role}</p>
                            {m.note && <p className="text-[11px] opacity-40 mt-0.5 leading-tight">{m.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── Things To Do ──────────────────────────────────────────────────
            case "things_to_do": {
              const ttd = content.things_to_do;
              if (!ttd?.items?.length) return null;
              return (
                <SectionWrapper key="things_to_do" sectionKey="things_to_do">
                  <section>
                    <SectionHeader title={ttd.title ?? "Things To Do"} tc={tc} accentColor={color} />
                    {ttd.intro && <p className="text-center opacity-60 mb-8 leading-relaxed">{ttd.intro}</p>}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {ttd.items.map((item, i) => (
                        <div key={i} className="flex gap-3 p-4"
                          style={{ border: `1px solid ${color}20`, borderRadius: tc.cardRadius, background: tc.surface }}>
                          <span className="text-xl shrink-0 mt-0.5">{CATEGORY_ICONS[item.category] ?? "✦"}</span>
                          <div className="space-y-0.5">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm underline underline-offset-2" style={{ color }}>{item.name}</a>
                            ) : (
                              <p className="font-medium text-sm" style={{ fontFamily: tc.headingFont }}>{item.name}</p>
                            )}
                            {item.description && <p className="text-xs opacity-55 leading-relaxed">{item.description}</p>}
                            {item.address && <p className="text-[11px] opacity-40">{item.address}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── Music ─────────────────────────────────────────────────────────
            case "music": {
              const m = content.music;
              if (!m?.ceremony && !m?.cocktail && !m?.reception && !m?.lastDance) return null;
              const tracks = [
                m.ceremony  && { label: "Ceremony",      song: m.ceremony },
                m.cocktail  && { label: "Cocktail Hour", song: m.cocktail },
                m.reception && { label: "Reception",     song: m.reception },
                m.lastDance && { label: "Last Dance",    song: m.lastDance },
              ].filter(Boolean) as { label: string; song: string }[];
              return (
                <SectionWrapper key="music" sectionKey="music">
                  <section>
                    <SectionHeader title={content.music?.title ?? "Our Music"} tc={tc} accentColor={color} />
                    <div className="space-y-3">
                      {tracks.map((t, i) => (
                        <div key={i} className="flex items-center gap-4 p-4"
                          style={{ border: `1px solid ${color}20`, borderRadius: tc.cardRadius, background: tc.surface }}>
                          <span className="text-xl shrink-0">🎵</span>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-50">{t.label}</p>
                            <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal" }}>{t.song}</p>
                          </div>
                        </div>
                      ))}
                      {m.doNotPlay && (
                        <p className="text-sm opacity-40 text-center pt-2">Please don't play: {m.doNotPlay}</p>
                      )}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── Registry ──────────────────────────────────────────────────────
            case "registry": {
              if (!content.registry?.length) return null;
              return (
                <SectionWrapper key="registry" sectionKey="registry">
                  <section>
                    <SectionHeader title="Registry" tc={tc} accentColor={color} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {content.registry.map((r, i) => (
                        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                          className="block p-5 text-center transition-opacity hover:opacity-80"
                          style={{ border: `1px solid ${color}30`, borderRadius: tc.cardRadius, background: tc.surface, color }}>
                          <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", fontWeight: 600 }}>{r.name}</p>
                          {r.notes && <p className="text-xs opacity-50 mt-1">{r.notes}</p>}
                        </a>
                      ))}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── FAQ ───────────────────────────────────────────────────────────
            case "faq": {
              if (!content.faq?.length) return null;
              return (
                <SectionWrapper key="faq" sectionKey="faq">
                  <section>
                    <SectionHeader title="FAQ" tc={tc} accentColor={color} />
                    <div className="space-y-4">
                      {content.faq.map((item, i) => (
                        <div key={i} className="p-5 space-y-2"
                          style={{ border: `1px solid ${color}20`, borderRadius: tc.cardRadius, background: tc.surface }}>
                          <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", fontWeight: 600 }}>{item.question}</p>
                          <p className="text-sm opacity-65 leading-relaxed">{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            // ── RSVP ──────────────────────────────────────────────────────────
            case "rsvp": {
              return (
                <SectionWrapper key="rsvp" sectionKey="rsvp">
                  <section>
                    <div className="p-8 md:p-12 rounded-3xl" style={{ background: color }}>
                      <div className="text-center text-white mb-8">
                        <h2 style={{ fontFamily: tc.headingFont, color: "white", fontStyle: tc.headingItalic ? "italic" : "normal", fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 600 }}>
                          RSVP
                        </h2>
                        <p className="opacity-70 text-sm mt-2">Enter the code from your invitation to respond.</p>
                        {site.rsvpStats && site.rsvpStats.total > 0 && (
                          <p className="opacity-50 text-xs mt-1">{site.rsvpStats.attending} of {site.rsvpStats.total} guests have responded</p>
                        )}
                      </div>
                      <RsvpSection accentColor={color} tc={tc} />
                    </div>
                  </section>
                </SectionWrapper>
              );
            }

            default: return null;
          }
        })}

      </div>

      {/* Footer */}
      <div className="text-center py-10 text-xs opacity-30" style={{ fontFamily: tc.bodyFont }}>
        {coupleName}'s Wedding · Made with Wevenu
      </div>

    </div>
  );
}
