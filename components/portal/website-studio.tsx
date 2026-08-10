"use client";

/**
 * WebsiteStudio — Sprint 69
 *
 * "Couples stop filling out forms and start designing their wedding website."
 *
 * Three layers:
 *   1. Guided setup wizard — first-time users walk through Photo → Layout Collection →
 *      Color Story → Typography → Photo Style → Story → Preview
 *   2. Split layout (desktop) — sidebar editor left, live preview right
 *   3. Collection carousel — ← cycle Layout Collections → with instant preview update
 *
 * Mobile: full-screen editor with a "Preview" toggle tab.
 * Desktop: side-by-side studio with scaled live preview.
 *
 * Four independent design dimensions (2026-07-24) — Layout Collection, Color
 * Story, Typography, Photo Style — replace the old single "theme" step. See
 * ThemeStudio in website-editor.tsx for the same catalog data model used here.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight, Eye, Loader2, Monitor, Smartphone, PanelsTopLeft, Palette, CaseSensitive, Image as ImageIcon, Sparkles, Check, Users, MapPin, Heart, Upload } from "lucide-react";
import { toast } from "sonner";

import { ColorPickerTrigger } from "@/components/ui/color-picker";
import { CollectionPreview, ColorStoryPreview, TypographyPreview, PhotoStylePreview } from "@/components/portal/collection-preview";
import { resolveCuratedColorStories, deriveSixRoles, swatchGradient, type SixRoleColors } from "@/lib/wedding-website/curated-color-stories";
import { resolveDesignState } from "@/lib/wedding-website/design-state";
import { resolveStudioPreviewPhotos } from "@/lib/wedding-website/studio-preview-content";
import { collectionDescriptor } from "@/lib/wedding-website/collection-descriptors";
import { PORTRAIT_FACE_FOCAL } from "@/components/wedding-website/composition-primitives";
import type { CoupleWebsite, WebsiteContent, WebsiteSuggestions, HostedExperienceCatalog, CatalogCollection, CatalogColorStory } from "@/lib/wedding-website/types";
import type { PortalContext } from "@/lib/portal/types";
import type { PublicWebsite } from "@/lib/wedding-website/types";

// A save patch for any of the four design dimensions, or the legacy
// theme/themePalette/fontPairing strings sent alongside as a safety net —
// mirrors ThemePatch in website-editor.tsx.
type DesignPatch = Partial<CoupleWebsite & { fontPairing: string; clearCustomColors: boolean }>;

/** WW-AUDIT-02 — Studio phone chrome: size-contain the scrollport so heroes
 * can prefer frame-relative height (cqh), without affecting published pages
 * or desktop Live Preview. */
const PHONE_PREVIEW_FRAME_CSS = `
.ww-phone-frame-scroll {
  container-type: size;
}
.ww-phone-frame-scroll .ww-hero-min-box {
  min-height: min(var(--ww-hero-min-height, 65vh), 78cqh) !important;
}
`;

/**
 * Phone bezel for Studio / Wizard mobile preview.
 * Overflow clips only on the scrollport (bottom corners), not the whole
 * device shell — so first-paint hero titles are not amputated by the top
 * rounded overflow:hidden edge (WW-AUDIT-02).
 *
 * Screen height is explicit (not content-sized) so `container-type: size`
 * can expose cqh to nested heroes without collapsing the scrollport.
 */
function PhonePreviewFrame({
  maxHeight,
  children,
}: {
  maxHeight: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-full max-w-[375px] shrink-0"
      style={{
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        borderRadius: "40px",
        border: "8px solid #1A1A1A",
        background: "white",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PHONE_PREVIEW_FRAME_CSS }} />
      <div className="h-6 flex items-center justify-center shrink-0" style={{ background: "#1A1A1A" }}>
        <div className="h-1.5 w-16 rounded-full" style={{ background: "#3A3A3A" }} />
      </div>
      <div
        className="ww-phone-frame-scroll overflow-y-auto overflow-x-hidden"
        style={{
          height: maxHeight,
          maxHeight,
          borderBottomLeftRadius: "32px",
          borderBottomRightRadius: "32px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function collectionSwatch(c: CatalogCollection): string {
  return c.colorStories[0] ? swatchGradient(c.colorStories[0].tokens)
    : `linear-gradient(160deg, ${c.swatchAccent ?? "#B8AEA1"} 0%, ${c.swatchAccent ?? "#DED6CA"} 100%)`;
}

// Part 10 — what each role actually does in the accepted renderer. Verified
// firsthand (Whole-Page Visual Rhythm pass, 2026-08-05): every role has a
// real, visible job — Primary drives buttons/hero tone, Secondary joins the
// hero gradient and the Event/RSVP "strong" canvas fields, Accent drives
// labels/dividers/schedule markers, Neutral (-> border) drives dividers and
// the "neutral" canvas tint, Background is the page canvas, Text is body copy.
const COLOR_ROLES: { key: keyof SixRoleColors; label: string; helper: string }[] = [
  { key: "colorPrimary", label: "Primary", helper: "Main color moments" },
  { key: "colorSecondary", label: "Secondary", helper: "Supporting color fields" },
  { key: "colorAccent", label: "Accent", helper: "Details, labels & highlights" },
  { key: "colorNeutral", label: "Neutral", helper: "Soft backgrounds & contrast" },
  { key: "colorBackground", label: "Background", helper: "Main page canvas" },
  { key: "colorText", label: "Text", helper: "Primary written content" },
];

// ── Setup wizard ──────────────────────────────────────────────────────────────

type WizardStep = "welcome" | "photo" | "collection" | "color" | "typography" | "photostyle" | "story" | "preview";

const WIZARD_STEPS: WizardStep[] = ["welcome", "photo", "collection", "color", "typography", "photostyle", "story", "preview"];

function WizardProgress({ step }: { step: WizardStep }) {
  const idx = WIZARD_STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {WIZARD_STEPS.filter(s => s !== "welcome").map((s, i) => (
        <div key={s} className={`h-1 rounded-full transition-all ${i <= idx - 1 ? "w-6" : "w-3"}`}
          style={{ background: i <= idx - 1 ? "var(--venue-primary)" : "color-mix(in srgb, var(--venue-primary) 19%, transparent)" }} />
      ))}
    </div>
  );
}

// Wedding Website Setup — Collection + Color Story Selection Experience
// (2026-08-07) — one shared header shape for every design step: a thin
// line icon (never emoji, never a filled/colored icon), an eyebrow label,
// heading, supporting copy, and an optional secondary line. Replaces the
// old "text-3xl emoji + h2 + p" pattern step-by-step below.
function WizardStepHeader({
  icon: Icon, eyebrow, heading, copy, secondaryLine,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  eyebrow: string; heading: string; copy: string; secondaryLine?: string;
}) {
  return (
    <div className="text-center space-y-3">
      <Icon className="h-6 w-6 mx-auto text-muted-foreground/60" strokeWidth={1.25} />
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">{eyebrow}</p>
        <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>{heading}</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">{copy}</p>
      {secondaryLine && <p className="text-xs text-muted-foreground/60 italic">{secondaryLine}</p>}
    </div>
  );
}

function SetupWizard({
  step, setStep, onComplete,
  site, suggestions, token, catalog, livePreviewSite,
  onSaveSection, onSaveDesign, coupleName,
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  onComplete: () => void;
  site: CoupleWebsite;
  suggestions: WebsiteSuggestions | null;
  token: string;
  catalog: HostedExperienceCatalog | null;
  /** Part 18 — the Preview step renders the SAME real WeddingWebsite
   * renderer the Studio's own Live Preview uses, reflecting every design
   * choice made so far (each step's `advance()` already saves to `site`
   * before moving on, and the parent recomputes this from that same `site`
   * — no second preview-building code path). */
  livePreviewSite: PublicWebsite;
  onSaveSection: (key: string, value: object) => Promise<void>;
  onSaveDesign: (patch: DesignPatch) => Promise<void>;
  coupleName: string;
}) {
  const [selectedPhoto, setSelectedPhoto] = React.useState(site.content?.home?.coverImageUrl ?? "");
  const [collectionId, setCollectionId] = React.useState<string | undefined>(site.collectionId ?? undefined);
  const [colorStoryId, setColorStoryId] = React.useState<string | undefined>(site.colorStoryId ?? undefined);
  const [customColors, setCustomColors] = React.useState<Record<string, string>>({
    colorPrimary: site.colorPrimary ?? "", colorSecondary: site.colorSecondary ?? "",
    colorAccent: site.colorAccent ?? "", colorNeutral: site.colorNeutral ?? "",
    colorBackground: site.colorBackground ?? "", colorText: site.colorText ?? "",
  });
  const [wizardPreviewDevice, setWizardPreviewDevice] = React.useState<"mobile" | "desktop">("desktop");
  const [typographyStyleId, setTypographyStyleId] = React.useState<string | undefined>(site.typographyStyleId ?? undefined);
  const [photoStyleId, setPhotoStyleId] = React.useState<string | undefined>(site.photoStyleId ?? undefined);
  const [storyText, setStoryText] = React.useState(site.content?.story?.text ?? "");
  const [saving, setSaving] = React.useState(false);

  // Typography Differentiation Pass (2026-08-09) — the real WeddingWebsite
  // renderer loads exactly one Google Fonts stylesheet at a time (whichever
  // typography style is selected — see its own fontUrl useEffect). Without
  // that same loading here, this step's 8 cards were silently rendering
  // fallback fonts (Georgia/system-ui/generic "cursive") instead of the
  // real assigned typefaces, which made most of them look identical or
  // wrong. Same real mechanism, just all 8 stylesheets at once (deduped by
  // URL) so every card shows its true font — only while this step is open.
  React.useEffect(() => {
    if (step !== "typography" || !catalog?.typographyStyles?.length) return;
    const urls = Array.from(new Set(
      catalog.typographyStyles.map(t => t.tokens.fontUrl).filter((u): u is string => !!u)
    ));
    const links = urls.map(url => {
      const link = document.createElement("link");
      link.rel = "stylesheet"; link.href = url;
      link.setAttribute("data-wevenu-typography-preview", "1");
      document.head.appendChild(link);
      return link;
    });
    return () => { links.forEach(l => l.remove()); };
  }, [step, catalog?.typographyStyles]);

  // Uploaded straight from this step (Studio Wizard photo-upload, 2026-07-22)
  // — before this, the only way to add a photo here was to leave the wizard
  // and go to Profile first. Merged with the suggested engagement photos for
  // display; a freshly uploaded photo is auto-selected.
  const [uploadedPhotos, setUploadedPhotos] = React.useState<{ id: string; url: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const eng = [...uploadedPhotos, ...(suggestions?.engagementPhotos ?? [])];

  // Design System Correction (2026-08-08) — Collection/Photo Style cards
  // now use a real photo instead of abstract placeholders. Prefers whatever
  // the couple just chose in this session, then falls back to their
  // existing site photo, then the first suggested engagement photo — never
  // fabricated, and gracefully absent (Photo helper renders a plain neutral
  // block) if the couple genuinely has none yet.
  const previewPhoto = selectedPhoto || site.content?.home?.coverImageUrl || eng[0]?.url || undefined;

  // Shared Rendering Architecture, Phase 2 — the candidate PublicWebsite
  // every wizard-step preview (Collection, Color Story, Photo Style) builds
  // on via buildPreviewSite(), reflecting this session's in-progress
  // choices (not yet saved) the same way `currentColorStory`/
  // `currentTypography` below already do.
  // Photo Style previews need ≥3 distinct URLs so GalleryGrid can show
  // arrangement / hero-emphasis / circles — never three copies of one face.
  const previewGalleryPhotos = resolveStudioPreviewPhotos({
    galleryPhotos: site.content?.gallery?.photos,
    coverPhoto: previewPhoto,
    engagementPhotos: eng.map(p => p.url),
  });
  const previewBase: PublicWebsite = {
    content: {
      ...site.content,
      home: { ...site.content?.home, title: site.content?.home?.title ?? coupleName, coverImageUrl: previewPhoto },
    },
    colorPrimary: customColors.colorPrimary || site.colorPrimary,
    colorSecondary: customColors.colorSecondary || site.colorSecondary,
    colorAccent: customColors.colorAccent || site.colorAccent,
    colorNeutral: customColors.colorNeutral || site.colorNeutral,
    colorBackground: customColors.colorBackground || site.colorBackground,
    colorText: customColors.colorText || site.colorText,
  };

  const collections = catalog?.collections ?? [];
  const currentCollection = collections.find(c => c.id === collectionId) ?? collections[0];
  // Global search, never scoped to currentCollection's own list — curated
  // Color Stories are all parked under one Collection's collection_id (see
  // curated-color-stories.ts) independent of which real Collection the
  // couple has chosen. See lib/wedding-website/design-state.ts.
  const allColorStories = collections.flatMap(c => c.colorStories);
  const currentColorStory = colorStoryId ? allColorStories.find(cs => cs.id === colorStoryId) : undefined;
  const currentTypography = catalog?.typographyStyles.find(t => t.id === typographyStyleId) ?? catalog?.typographyStyles[0];
  const currentPhotoStyle = catalog?.photoStyles.find(p => p.id === photoStyleId);
  const hasCustomColors = Object.values(customColors).some(v => !!v);

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("token", token); fd.append("file", file);
      fd.append("category", "engagement"); fd.append("visibility", "private");
      const res = await fetch("/api/portal/media", { method: "POST", body: fd });
      const data = await res.json() as { ok: boolean; mediaId?: string; fileUrl?: string; error?: string };
      if (data.ok && data.mediaId && data.fileUrl) {
        setUploadedPhotos(p => [{ id: data.mediaId!, url: data.fileUrl! }, ...p]);
        setSelectedPhoto(data.fileUrl);
      } else {
        toast.error(data.error ?? "Upload failed — please try again.");
      }
    } catch {
      toast.error("Upload failed — please try again.");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function advance(next: WizardStep | "done") {
    setSaving(true);
    try {
      if (step === "photo" && selectedPhoto) {
        await onSaveSection("home", {
          ...(site.content?.home ?? {}),
          title: site.content?.home?.title ?? suggestions?.coupleNames ?? coupleName,
          coverImageUrl: selectedPhoto,
        });
      }
      if (step === "collection") {
        // Design System Correction (2026-08-08) — `currentCollection` falls
        // back to `collections[0]` (Wildflower, sort_order 0) purely for
        // DISPLAY when `collectionId` hasn't resolved yet. That fallback
        // must never reach a save: it silently overwrote a real couple's
        // Coastal selection with Wildflower during a race where this ran
        // before the catalog had loaded. Saving requires an exact,
        // unambiguous match — no match means no save, never a guess.
        const collectionToSave = collections.find(c => c.id === collectionId);
        if (collectionToSave) {
          await onSaveDesign({
            theme: collectionToSave.key as CoupleWebsite["theme"], collectionId: collectionToSave.id,
            ...(colorStoryId ? {} : (collectionToSave.colorStories[0]
              ? { themePalette: collectionToSave.colorStories[0].name, colorStoryId: collectionToSave.colorStories[0].id }
              : {})),
          });
          if (!colorStoryId && collectionToSave.colorStories[0]) setColorStoryId(collectionToSave.colorStories[0].id);
        }
      }
      if (step === "color") {
        // Studio Canonical State Pass (2026-08-11) — colorStoryId must be
        // persisted whenever a curated story is the active, untouched
        // selection (colorStoryId here only ever gets set by picking a
        // curated card, and cleared the moment any individual swatch is
        // edited — see the per-role ColorPickerTrigger below), so every
        // other surface can tell "curated Meadow" apart from "custom
        // colors that happen to match it" after reload. The six raw hex
        // columns are saved either way — the real renderer (resolveTheme)
        // reads those directly, never color_story_id.
        const patch: DesignPatch = {};
        if (hasCustomColors) {
          patch.clearCustomColors = false;
          patch.colorStoryId = colorStoryId ?? null;
          if (colorStoryId) patch.themePalette = currentColorStory?.name;
          if (customColors.colorPrimary) patch.colorPrimary = customColors.colorPrimary;
          if (customColors.colorSecondary) patch.colorSecondary = customColors.colorSecondary;
          if (customColors.colorAccent) patch.colorAccent = customColors.colorAccent;
          if (customColors.colorNeutral) patch.colorNeutral = customColors.colorNeutral;
          if (customColors.colorBackground) patch.colorBackground = customColors.colorBackground;
          if (customColors.colorText) patch.colorText = customColors.colorText;
        }
        if (Object.keys(patch).length > 0) await onSaveDesign(patch);
      }
      if (step === "typography" && currentTypography) {
        await onSaveDesign({ fontPairing: currentTypography.key as CoupleWebsite["fontPairing"], typographyStyleId: currentTypography.id });
      }
      if (step === "photostyle" && photoStyleId) {
        await onSaveDesign({ photoStyleId });
      }
      if (step === "story" && storyText.trim()) {
        // Section content is replaced wholesale on save, not merged — must
        // carry forward any Story photo already set via the Studio's own
        // section editor, or re-running this wizard would silently delete it.
        await onSaveSection("story", { title: "Our Story", text: storyText, imageUrl: site.content?.story?.imageUrl });
      }
    } finally { setSaving(false); }
    if (next === "done") onComplete();
    else setStep(next);
  }

  // ── Welcome ──
  if (step === "welcome") {
    const known: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }[] = [];
    if (suggestions?.coupleNames) known.push({ icon: Users, label: suggestions.coupleNames });
    if (suggestions?.venue?.name) known.push({ icon: MapPin, label: suggestions.venue.name });
    if (suggestions?.story?.text) known.push({ icon: Heart, label: "Your story is ready to use" });
    if (eng.length > 0) known.push({ icon: ImageIcon, label: `${eng.length} engagement photo${eng.length === 1 ? "" : "s"}` });

    return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--venue-primary)" }}>
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.3em]">Website Studio</p>
          <h1 className="text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            Let's build your<br />wedding website.
          </h1>
        </div>
        {known.length > 0 && (
          <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-3 text-left">
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-[0.2em]">Already waiting for you</p>
            <div className="space-y-2.5">
              {known.map((k, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <k.icon className="h-3.5 w-3.5 text-white/60 shrink-0" strokeWidth={1.5} />
                  <p className="text-white text-sm">{k.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={() => setStep("photo")}
          className="w-full rounded-2xl py-4 text-base font-semibold bg-white hover:bg-white/90 transition-colors" style={{ color: "var(--venue-secondary)" }}>
          Let's get started
        </button>
        <button type="button" onClick={onComplete} className="text-white/50 text-sm hover:text-white/80 transition-colors">
          Skip setup — go straight to studio
        </button>
      </div>
    </div>
    );
  }

  // ── Photo ──
  if (step === "photo") {
    // Design System Correction (2026-08-08) — was a small block floating
    // above a mostly-empty desktop viewport regardless of photo count. The
    // grid/large-photo layout below now adapts to how many photos actually
    // exist (1, 2, or many), and the whole block is vertically centered in
    // the available space instead of pinned to the top, so it reads as
    // intentional rather than sparse — same task, same data behavior.
    const photoGrid = () => {
      if (eng.length === 1) {
        const p = eng[0];
        return (
          <button type="button" onClick={() => setSelectedPhoto(p.url)}
            className={`relative rounded-2xl overflow-hidden mx-auto block transition-all hover:scale-[1.01] ${selectedPhoto === p.url ? "ring-2 ring-primary ring-offset-2" : ""}`}
            style={{ aspectRatio: "4/5", maxWidth: 280 }}>
            <img src={p.url} alt="Your photo" className="w-full h-full object-cover" />
            {selectedPhoto === p.url && (
              <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-card flex items-center justify-center shadow">
                <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />
              </div>
            )}
          </button>
        );
      }
      const cols = eng.length === 2 ? "grid-cols-2" : "grid-cols-3";
      return (
        <div className={`grid ${cols} gap-2`}>
          {eng.slice(0, 9).map((p, i) => (
            <button key={p.id} type="button" onClick={() => setSelectedPhoto(p.url)}
              className={`relative rounded-xl overflow-hidden transition-all hover:scale-[1.02] ${selectedPhoto === p.url ? "ring-2 ring-primary ring-offset-2" : ""}`}
              style={{ aspectRatio: eng.length === 2 ? "4/5" : "1/1" }}>
              <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              {selectedPhoto === p.url && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <div className="h-7 w-7 rounded-full bg-card flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      );
    };

    return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("collection")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col justify-center">
        <div className="max-w-lg mx-auto w-full space-y-6">
          <WizardStepHeader
            icon={ImageIcon}
            eyebrow="YOUR PHOTO"
            heading="Choose your favorite photo"
            copy="This will be the first thing guests see."
          />

          <input ref={photoInputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handlePhotoUpload(f); }} disabled={uploadingPhoto} />

          {eng.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your engagement photos</p>
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
                  {uploadingPhoto ? "Uploading…" : "+ Upload a photo"}
                </button>
              </div>
              {photoGrid()}
            </div>
          ) : (
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
              className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors py-14 flex flex-col items-center gap-3 disabled:opacity-50">
              {uploadingPhoto
                ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                : <Upload className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />}
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-heading">{uploadingPhoto ? "Uploading…" : "Upload a photo"}</p>
                <p className="text-xs text-muted-foreground">Or skip this step and add one later.</p>
              </div>
            </button>
          )}
        </div>
      </div>
      <WizardFooter
        onBack={() => setStep("welcome")}
        onNext={() => advance("collection")}
        nextLabel={selectedPhoto ? "Use this photo →" : "Skip for now →"}
        saving={saving}
      />
    </div>
    );
  }

  // ── Step 1: Collection ──
  if (step === "collection") {
    const mainCollections = collections.length % 2 === 1 ? collections.slice(0, -1) : collections;
    const strayCollection = collections.length % 2 === 1 ? collections[collections.length - 1] : null;
    const collectionCard = (c: CatalogCollection) => {
      const isSelected = c.id === currentCollection?.id;
      return (
        <button key={c.id} type="button"
          onClick={() => { setCollectionId(c.id); if (!colorStoryId && c.colorStories[0]) setColorStoryId(c.colorStories[0].id); }}
          className={`relative rounded-2xl overflow-hidden text-left bg-white border transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-primary ring-offset-2 border-primary shadow-md" : "border-border"}`}>
          <div className="relative overflow-hidden" style={{ height: 320 }}>
            {/* Signature Color Story + Collection DNA fonts — not the
                couple's currently selected Color/Typography — so each
                card shows that Collection's authored identity (e.g. Midnight
                stays dark; Linen stays quiet). Typography dimension is independent. */}
            <CollectionPreview base={previewBase} collection={c} colorStory={c.colorStories[0]} sectionKeys={["story"]} width={226} height={340} heroFraction={0.38} />
            {isSelected && (
              <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white flex items-center justify-center shadow border border-primary/30">
                <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />
              </div>
            )}
          </div>
          {/* Clear vertical separation: preview → name → descriptor, never overlapping */}
          <div className="px-3 pt-2.5 pb-3 border-t border-black/5 space-y-0.5">
            <p className="text-xs font-bold text-heading">{c.name}</p>
            <p className="text-[10px] text-muted-foreground leading-snug">{collectionDescriptor(c.key, c.description)}</p>
          </div>
        </button>
      );
    };
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <WizardHeader step={step} onSkip={() => advance("color")} />
        <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
          <WizardStepHeader
            icon={PanelsTopLeft}
            eyebrow="YOUR WEBSITE STYLE"
            heading="Choose your Collection"
            copy="Your Collection shapes how your whole wedding website feels — the opening moment, section composition, type hierarchy, spacing, and the way your story unfolds."
            secondaryLine="Don't worry about colors yet. You'll make those yours next."
          />
          <div className="grid grid-cols-2 gap-3">
            {mainCollections.map(collectionCard)}
          </div>
          {strayCollection && (
            <div className="flex justify-center">
              <div className="w-[calc(50%-0.375rem)]">{collectionCard(strayCollection)}</div>
            </div>
          )}
        </div>
        <WizardFooter onBack={() => setStep("photo")} onNext={() => advance("color")} nextLabel="This is us →" saving={saving} />
      </div>
    );
  }

  // ── Step 2: Color Story ──
  if (step === "color") {
    // Seed value for a role — the couple's own custom override if set,
    // otherwise derived from whichever Color Story is currently active, so
    // the six-swatch card always shows real, currently-applied colors.
    const seeded = currentColorStory ? deriveSixRoles(currentColorStory.tokens) : null;
    const roleValue = (key: keyof SixRoleColors, fallback: string) => customColors[key] || seeded?.[key] || fallback;

    function applyStory(id: string, tokens: CatalogColorStory["tokens"]) {
      const roles = deriveSixRoles(tokens);
      setCustomColors({
        colorPrimary: roles.colorPrimary, colorSecondary: roles.colorSecondary, colorAccent: roles.colorAccent,
        colorNeutral: roles.colorNeutral, colorBackground: roles.colorBackground, colorText: roles.colorText,
      });
      // colorStoryId is the source of truth for "curated, untouched" — set
      // here, cleared the moment any individual swatch below is edited.
      setColorStoryId(id);
    }

    const curated = catalog ? resolveCuratedColorStories(catalog.collections) : [];

    return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("typography")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-7">
        <WizardStepHeader
          icon={Palette}
          eyebrow="YOUR COLORS"
          heading="Create your Color Story"
          copy="Bring your wedding colors into your website. Start with a curated palette or create your own from any colors you love."
          secondaryLine="You can change every color and see it on your website as you go."
        />

        {/* YOUR COLOR STORY — always editable, always real */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-heading uppercase tracking-wide">Your Color Story</p>
          <div className="grid grid-cols-3 gap-3">
            {COLOR_ROLES.map(role => {
              const value = roleValue(role.key, "#BF9089");
              return (
                <div key={role.key} className="space-y-1.5">
                  <div className="relative rounded-lg overflow-hidden aspect-square border border-black/10" style={{ background: value }}>
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }}>
                      <p className="text-[9px] font-semibold text-white uppercase tracking-wide">{role.label}</p>
                    </div>
                  </div>
                  <ColorPickerTrigger value={value} onChange={(v) => {
                    // Editing any single role means this is no longer the
                    // curated story untouched — clear colorStoryId so every
                    // surface correctly reads this as a custom palette from
                    // here on (Studio Canonical State Pass, 2026-08-11).
                    setCustomColors(c => ({ ...c, [role.key]: v }));
                    setColorStoryId(undefined);
                  }} />
                  <p className="text-[9px] text-muted-foreground leading-tight">{role.helper}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Curated inspiration — a starting point, never a lock */}
        {curated.length > 0 && (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-heading">Need a little inspiration?</p>
              <p className="text-xs text-muted-foreground">Start with a curated Color Story, then make it completely yours.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {curated.map(cs => (
                <button key={cs.id} type="button" onClick={() => applyStory(cs.id, cs.tokens)}
                  className={`rounded-xl overflow-hidden text-left bg-white border transition-all hover:scale-[1.01] ${colorStoryId === cs.id ? "ring-2 ring-primary ring-offset-1 border-primary" : "border-border"}`}>
                  <div className="h-9">
                    <ColorStoryPreview colorStory={cs} />
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-[11px] font-bold text-heading">{cs.name}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{cs.mood}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <WizardFooter onBack={() => setStep("collection")} onNext={() => advance("typography")} nextLabel="Love it →" saving={saving} />
    </div>
    );
  }

  // ── Step 3: Typography ──
  if (step === "typography") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("photostyle")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <WizardStepHeader
          icon={CaseSensitive}
          eyebrow="YOUR TYPOGRAPHY"
          heading="Choose your typography"
          copy="Choose the type pairing that sounds most like you — romantic, refined, modern, playful, or beautifully understated."
        />
        <div className="grid grid-cols-2 gap-3">
          {(catalog?.typographyStyles ?? []).map(t => {
            const isSelected = t.id === currentTypography?.id;
            return (
              <button key={t.id} type="button" onClick={() => setTypographyStyleId(t.id)}
                className={`rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-primary ring-offset-2 border-primary" : "border-border"}`}>
                <div className="h-12">
                  <TypographyPreview typography={t} coupleName={suggestions?.coupleNames ?? coupleName} nameSize={20} taglineSize={11} align="left" />
                </div>
                <p className="text-xs font-semibold text-heading mt-2.5">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{t.tokens.sampleLabel}</p>
              </button>
            );
          })}
        </div>
      </div>
      <WizardFooter onBack={() => setStep("color")} onNext={() => advance("photostyle")} nextLabel="Beautiful →" saving={saving} />
    </div>
  );

  // ── Step 4: Photo Style ──
  if (step === "photostyle") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("story")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <WizardStepHeader
          icon={Sparkles}
          eyebrow="YOUR PHOTOS"
          heading="Choose your Photo Style"
          copy="Choose how your photographs are framed, layered, spaced, and filtered inside your website — independent of the Collection you already chose."
        />
        <div className="grid grid-cols-2 gap-3">
          {(catalog?.photoStyles ?? []).map(p => {
            const isSelected = p.id === currentPhotoStyle?.id;
            return (
              <button key={p.id} type="button" onClick={() => setPhotoStyleId(p.id)}
                className={`rounded-2xl border overflow-hidden text-left transition-all hover:scale-[1.01] flex flex-col ${isSelected ? "ring-2 ring-primary ring-offset-2 border-primary" : "border-border"}`}>
                {/* Specimen region — height must equal PhotoStylePreview height so the
                    ScaledThumbnail never paints into the reserved label footer. */}
                <div className="h-[188px] shrink-0 overflow-hidden bg-[#FAF8F4]">
                  {currentCollection && <PhotoStylePreview collection={currentCollection} photoStyle={p} photos={previewGalleryPhotos} width={226} height={188} naturalWidth={480} />}
                </div>
                <div className="px-3 py-2.5 bg-white border-t border-black/5 shrink-0 min-h-[3.5rem]">
                  <p className="text-xs font-bold text-heading line-clamp-1">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <WizardFooter onBack={() => setStep("typography")} onNext={() => advance("story")} nextLabel="Perfect →" saving={saving} />
    </div>
  );

  // ── Story ──
  if (step === "story") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("preview")} />
      {/* Design System Correction (2026-08-08) — was a short block pinned
          to the top of a tall, mostly-empty viewport. Vertically centering
          it (same task, same data behavior) reads as intentional instead
          of sparse; the textarea itself is also taller so it carries real
          visual weight on desktop. */}
      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col justify-center">
        <div className="max-w-lg mx-auto w-full space-y-6">
          <WizardStepHeader
            icon={Heart}
            eyebrow="YOUR STORY"
            heading="Tell the world how you found each other"
            copy="Guests love reading this. Make it yours."
          />

          {suggestions?.story?.text && !storyText && (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--venue-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--venue-primary)_5%,transparent)] p-4 space-y-3">
              <p className="text-xs font-semibold text-[var(--venue-primary)]">From your profile — tap to use</p>
              <p className="text-sm text-foreground/70 leading-relaxed">{suggestions.story.text}</p>
              <button type="button" onClick={() => setStoryText(suggestions.story!.text)}
                className="text-sm font-semibold px-4 py-2 rounded-xl text-white w-full"
                style={{ background: "var(--venue-primary)" }}>
                Use this story
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">{storyText && suggestions?.story?.text ? "Customized story" : "Your story"}</p>
            <textarea
              value={storyText}
              onChange={e => setStoryText(e.target.value)}
              rows={10}
              placeholder="We met at a coffee shop in Nashville on a rainy Tuesday morning…"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">{storyText.length} / 500</p>
          </div>
        </div>
      </div>
      <WizardFooter
        onBack={() => setStep("photostyle")}
        onNext={() => advance("preview")}
        nextLabel={storyText.trim() ? "Love it →" : "Skip for now →"}
        saving={saving}
      />
    </div>
  );

  // ── Preview — Part 18: the real WeddingWebsite renderer, not a mockup ──
  if (step === "preview") {
    const { WeddingWebsite } = require("@/components/wedding-website/wedding-website") as { WeddingWebsite: React.ComponentType<WeddingWebsiteProps> };
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Design System Correction (2026-08-08) — this chrome used to be
            two stacked blocks (~136px) sitting ABOVE the real Hero inside
            the scrollable preview, so the couple saw noticeably less of
            the accepted Hero within their first screen than the public
            page shows at y=0 — not a crop regression (the Hero's own CSS
            is byte-identical to public/Studio at every measured viewport),
            just less of it fit above the fold. One compact row instead of
            two roughly halves that overhead.
            Visual Acceptance Corrections (2026-08-08) — Preview was the one
            step missing the standardized icon+eyebrow header anatomy every
            other step uses. Same icon (h-6 w-6, strokeWidth 1.25, muted)
            reused here, laid out horizontally beside the eyebrow+title
            instead of stacked above it — the toolbar row has to hold a back
            button and device toggle too, so a stacked centered header
            (the other 6 steps' pattern) would blow the chrome budget the
            Hero-crop fix above depends on. Anatomy stays identical: icon,
            eyebrow, title, supporting copy — only the arrangement adapts. */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 gap-3">
          <button type="button" onClick={() => setStep("story")} className="p-2 text-muted-foreground hover:text-foreground shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <Eye className="h-6 w-6 text-muted-foreground/60 shrink-0" strokeWidth={1.25} />
            <div className="text-left min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/70">Preview</p>
              <p className="text-sm font-semibold text-heading truncate">See it all come together</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setWizardPreviewDevice("desktop")}
              className={`p-1.5 rounded-lg transition-colors ${wizardPreviewDevice === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setWizardPreviewDevice("mobile")}
              className={`p-1.5 rounded-lg transition-colors ${wizardPreviewDevice === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 px-4 py-1.5 border-b border-border shrink-0">
          <WizardProgress step={step} />
        </div>
        <p className="text-[10px] text-center text-muted-foreground/70 px-4 py-1.5 border-b border-border shrink-0">
          This is your wedding website — your Collection, colors, typography, and photos working together.
        </p>

        {/* Real renderer, real scroll — enough of the site to actually experience it, never a thumbnail. */}
        {wizardPreviewDevice === "desktop" ? (
          <div className="flex-1 overflow-y-auto min-h-0" style={{ background: "#F0EDE8" }}>
            <WeddingWebsite site={livePreviewSite} slug={livePreviewSite.slug ?? "preview"} editMode={false} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 py-6 px-3 flex justify-center" style={{ background: "#F0EDE8" }}>
            <PhonePreviewFrame maxHeight="calc(100vh - 280px)">
              <WeddingWebsite site={livePreviewSite} slug={livePreviewSite.slug ?? "preview"} editMode={false} />
            </PhonePreviewFrame>
          </div>
        )}

        <div className="shrink-0 px-6 py-4 border-t border-border flex gap-3">
          <button type="button" onClick={() => setStep("collection")}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-muted-foreground border border-border hover:bg-muted/40">
            Keep editing
          </button>
          <button type="button" onClick={() => advance("done")} disabled={saving}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--venue-primary)" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Love it — continue"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function WizardHeader({ step, onSkip }: { step: WizardStep; onSkip: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="w-16" />
      <WizardProgress step={step} />
      <button type="button" onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground w-16 text-right">
        Skip →
      </button>
    </div>
  );
}

function WizardFooter({ onBack, onNext, nextLabel, saving }: {
  onBack: () => void; onNext: () => void; nextLabel: string; saving: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t border-border flex gap-3">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1 px-4 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <button type="button" onClick={onNext} disabled={saving}
        className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--venue-primary)" }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : nextLabel}
      </button>
    </div>
  );
}

// ── Collection carousel (desktop sidebar header) ──────────────────────────────
// Cycles the Layout Collection only — Color Story, Typography, and Photo
// Style are each their own independent choice, untouched by this control
// (Part 1/6/7: Collections are composition, not the whole identity anymore).

function CollectionCarousel({ catalog, site, coupleName, onChange }: {
  catalog: HostedExperienceCatalog | null;
  site: CoupleWebsite;
  coupleName: string;
  onChange: (patch: DesignPatch) => void;
}) {
  const collections = catalog?.collections ?? [];
  const idx = Math.max(0, collections.findIndex(c => c.id === site.collectionId));
  const current = collections[idx] ?? collections[0];
  // Studio Canonical State Pass (2026-08-11) — one resolver, not a local
  // re-derivation: fixes both the "current collection's own colorStories
  // only" scoping bug (curated stories live under one Collection's own
  // collection_id, independent of the couple's actual Collection) and the
  // hardcoded "Emily & James" placeholder below.
  const { colorStory, isCustomColors, typography, photoStyle } = resolveDesignState(site, catalog);
  const previewPhoto = site.content?.home?.coverImageUrl;

  // The couple's own actual resolved colors, live — a curated story's own
  // gradient when that's genuinely what's active, else the same primary/
  // secondary formula resolveTheme itself uses for a custom palette, never
  // a second approximation.
  const gradient = colorStory
    ? swatchGradient(colorStory.tokens)
    : isCustomColors && site.colorPrimary && site.colorSecondary
      ? `linear-gradient(160deg, ${site.colorSecondary} 0%, ${site.colorPrimary} 60%, ${site.colorPrimary} 100%)`
      : current ? collectionSwatch(current) : "#EEE";

  function go(dir: 1 | -1) {
    if (collections.length === 0) return;
    const next = collections[(idx + dir + collections.length) % collections.length];
    const patch: DesignPatch = { theme: next.key as CoupleWebsite["theme"], collectionId: next.id };
    // A Collection change alone must never touch the Color Story (Studio
    // Canonical State Pass, 2026-08-11) — only bootstrap a starting
    // palette the couple has neither a curated selection nor custom colors
    // at all yet.
    if (!colorStory && !isCustomColors && next.colorStories[0]) {
      const roles = deriveSixRoles(next.colorStories[0].tokens);
      patch.themePalette = next.colorStories[0].name;
      patch.colorStoryId = next.colorStories[0].id;
      patch.colorPrimary = roles.colorPrimary; patch.colorSecondary = roles.colorSecondary;
      patch.colorAccent = roles.colorAccent; patch.colorNeutral = roles.colorNeutral;
      patch.colorBackground = roles.colorBackground; patch.colorText = roles.colorText;
    }
    onChange(patch);
  }

  if (!current) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-border">
      {/* Mini preview — a live summary of the couple's actual saved style:
          their own photo (safe-cropped per PORTRAIT_FACE_FOCAL), their
          actual resolved colors as the scrim gradient, their own Photo
          Style filter on the photo, their own Typography on their name —
          the same real ingredients the public Hero itself uses, not a
          second approximation of them. */}
      <div className="h-20 relative flex items-center justify-center overflow-hidden" style={{ background: gradient }}>
        {previewPhoto && (
          <div className="absolute inset-0" style={{
            backgroundImage: `url(${previewPhoto})`, backgroundSize: "cover", backgroundPosition: PORTRAIT_FACE_FOCAL,
            filter: photoStyle?.tokens.photoFilter, opacity: 0.55,
          }} />
        )}
        <div className="absolute inset-0" style={{ background: gradient, opacity: previewPhoto ? 0.55 : 1 }} />
        <p className="relative text-base font-semibold text-white px-2 text-center truncate max-w-full"
          style={{ fontFamily: typography?.tokens.headingFont, fontStyle: typography?.tokens.headingItalic ? "italic" : "normal" }}>
          {coupleName}
        </p>
      </div>
      {/* Collection controls */}
      <div className="flex items-center bg-card px-2 pt-2.5 pb-1">
        <button type="button" onClick={() => go(-1)} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-heading">{current.name}</p>
          <p className="text-[10px] text-muted-foreground leading-tight px-1 line-clamp-1">{current.description}</p>
        </div>
        <button type="button" onClick={() => go(1)} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* Color Story dots — for the current collection's curated shortlist */}
      {current.colorStories.length > 0 && (
        <div className="flex items-center justify-center gap-2.5 pb-3 bg-card">
          {current.colorStories.map(cs => {
            const roles = deriveSixRoles(cs.tokens);
            return (
              <button key={cs.id} type="button"
                onClick={() => onChange({
                  colorStoryId: cs.id, themePalette: cs.name, clearCustomColors: false,
                  colorPrimary: roles.colorPrimary, colorSecondary: roles.colorSecondary, colorAccent: roles.colorAccent,
                  colorNeutral: roles.colorNeutral, colorBackground: roles.colorBackground, colorText: roles.colorText,
                })}
                title={cs.name}
                className={`rounded-full border-2 transition-all ${cs.id === colorStory?.id ? "h-5 w-5 border-foreground scale-110" : "h-4 w-4 border-transparent hover:border-border"}`}
                style={{ background: cs.tokens.accent }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Part 19 — Selected Design Summary. A compact "Your Website Style" strip
// showing all four independent dimensions with an Edit action returning to
// that exact wizard step. Reads only persisted fields (no new DB record for
// custom-palette origin — Part 19 says to use the existing persistence
// model) — a palette with any custom color set reads as "Your Color Story"
// since which preset (if any) seeded it isn't tracked once the wizard
// session ends; a couple's own saved preset name shows otherwise.
function SelectedDesignSummary({
  site, catalog, onEdit,
}: {
  site: CoupleWebsite;
  catalog: HostedExperienceCatalog | null;
  onEdit: (step: WizardStep) => void;
}) {
  const { collection, colorStoryLabel, typography, photoStyle } = resolveDesignState(site, catalog);

  const rows: { label: string; value: string; step: WizardStep }[] = [
    { label: "Collection", value: collection?.name ?? "—", step: "collection" },
    { label: "Color Story", value: colorStoryLabel, step: "color" },
    { label: "Typography", value: typography?.name ?? "—", step: "typography" },
    { label: "Photo Style", value: photoStyle?.name ?? "—", step: "photostyle" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Your Website Style</p>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] text-muted-foreground">{r.label}</p>
              <p className="text-xs font-medium text-heading truncate">{r.value}</p>
            </div>
            <button type="button" onClick={() => onEdit(r.step)}
              className="text-[10px] font-medium text-primary hover:underline shrink-0">
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Studio component ─────────────────────────────────────────────────────

export function WebsiteStudio({
  token, initialSite, origin, initialGuests, context,
}: {
  token: string;
  initialSite: CoupleWebsite;
  origin: string;
  initialGuests?: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[];
  context: PortalContext;
}) {
  // Mirror the site + content for the live preview
  const [previewSite, setPreviewSite] = React.useState<CoupleWebsite>(initialSite);
  const [previewContent, setPreviewContent] = React.useState<WebsiteContent>(initialSite.content ?? {});

  // Wizard
  const [wizardStep, setWizardStep] = React.useState<WizardStep | null>(null);
  const [wizardDismissed, setWizardDismissed] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<WebsiteSuggestions | null>(null);

  // Catalog — the four dimensions' data, shared by the wizard and the carousel
  const [catalog, setCatalog] = React.useState<HostedExperienceCatalog | null>(null);
  React.useEffect(() => {
    fetch("/api/portal/website/catalog").then(r => r.json()).then(setCatalog).catch(() => {});
  }, []);

  // Studio UI state
  const [activeSection, setActiveSection] = React.useState<string | null>(null);
  const [focusSection, setFocusSection] = React.useState<string | null>(null);
  const [mobileView, setMobileView] = React.useState<"edit" | "preview">("edit");
  const [previewDevice, setPreviewDevice] = React.useState<"mobile" | "desktop">("desktop");
  const [savingDesign, setSavingDesign] = React.useState(false);

  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");
  const completedSections = React.useMemo(
    () => ["home", "story", "event", "gallery", "schedule", "travel", "dress_code", "bridal_party", "things_to_do", "music", "registry", "faq"]
      .filter(k => {
        const c = previewContent as Record<string, unknown>;
        if (k === "home") return !!(c.home as { title?: string })?.title || !!(c.home as { coverImageUrl?: string })?.coverImageUrl;
        const v = c[k];
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === "object") return Object.values(v as object).some(x => x && (typeof x !== "object" || (Array.isArray(x) ? x.length > 0 : Object.keys(x).length > 0)));
        return !!v;
      }).length,
    [previewContent]
  );

  // Fetch suggestions + decide whether to show wizard
  React.useEffect(() => {
    fetch(`/api/portal/website/suggestions?token=${token}`)
      .then(r => r.json())
      .then((d: WebsiteSuggestions | null) => {
        setSuggestions(d);
        // Show wizard on first open if less than 2 sections filled
        if (!wizardDismissed && completedSections < 2 && !initialSite.isPublished) {
          setWizardStep("welcome");
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Build PublicWebsite shape for the live preview — all four dimensions'
  // resolved tokens come from the catalog directly (same shape
  // get_wedding_website returns server-side), so the in-studio preview
  // matches the real published page exactly.
  const livePreviewSite = React.useMemo((): PublicWebsite => {
    const collection = catalog?.collections.find(c => c.id === previewSite.collectionId);
    // Global search, not scoped to `collection` — see design-state.ts.
    const colorStory = catalog?.collections.flatMap(c => c.colorStories).find(cs => cs.id === previewSite.colorStoryId);
    const typography = catalog?.typographyStyles.find(t => t.id === previewSite.typographyStyleId);
    const photoStyle = catalog?.photoStyles.find(p => p.id === previewSite.photoStyleId);
    return {
      siteId: previewSite.id,
      slug: previewSite.slug ?? "",
      theme: previewSite.theme,
      themePalette: previewSite.themePalette,
      accentColor: previewSite.accentColor,
      fontPairing: previewSite.fontPairing,
      layoutConfig: collection?.layoutConfig,
      colorTokens: colorStory?.tokens,
      typographyTokens: typography?.tokens,
      photoStyleTokens: photoStyle?.tokens,
      colorPrimary: previewSite.colorPrimary, colorSecondary: previewSite.colorSecondary,
      colorAccent: previewSite.colorAccent, colorNeutral: previewSite.colorNeutral,
      colorBackground: previewSite.colorBackground, colorText: previewSite.colorText,
      sectionOrder: previewSite.sectionOrder,
      sectionsEnabled: previewSite.sectionsEnabled,
      content: previewContent,
      couple: {
        firstName: context.client.firstName,
        lastName: context.client.lastName ?? null,
        partnerFirstName: context.client.partnerFirstName ?? null,
        partnerLastName: context.client.partnerLastName ?? null,
      },
      event: context.event ? {
        id: context.event.id,
        name: context.event.name ?? "",
        eventDate: context.event.eventDate,
        eventType: context.event.eventType ?? null,
      } : null,
      // Coastal Premium Art-Direction Proof Pass (2026-08-03) — reuses the
      // exact same venue read PortalContext already provides (Studio's
      // context prop), same authoritative columns get_wedding_website now
      // also joins for the public page. No second read path.
      venue: context.venue ? {
        name: context.venue.name, heroImageUrl: context.venue.heroImageUrl, story: context.venue.story,
      } : null,
    };
  }, [previewSite, previewContent, context, catalog]);

  async function handleSaveSection(key: string, value: object) {
    setPreviewContent(c => ({ ...c, [key]: value }));
  }

  async function handleAppearanceChanged(patch: DesignPatch) {
    setPreviewSite(s => ({ ...s, ...patch }));
  }

  async function handleSaveDesign(patch: DesignPatch) {
    setSavingDesign(true);
    try {
      await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...patch }),
      });
      setPreviewSite(s => ({ ...s, ...patch }));
    } finally { setSavingDesign(false); }
  }

  function handleSectionClick(key: string) {
    // Switch to edit tab on mobile, scroll section on desktop
    setMobileView("edit");
    setActiveSection(key);
    setFocusSection(key);
    // Reset focusSection after a tick so it can re-trigger if clicked again
    setTimeout(() => setFocusSection(null), 800);
  }

  const { WebsiteEditor } = require("@/components/portal/website-editor") as { WebsiteEditor: React.ComponentType<WebsiteEditorProps> };
  const { WeddingWebsite } = require("@/components/wedding-website/wedding-website") as { WeddingWebsite: React.ComponentType<WeddingWebsiteProps> };

  const showWizard = wizardStep !== null && !wizardDismissed;

  return (
    <>
      {/* ── Guided setup wizard ── */}
      {showWizard && wizardStep && (
        <SetupWizard
          step={wizardStep}
          setStep={setWizardStep}
          onComplete={() => { setWizardStep(null); setWizardDismissed(true); }}
          site={previewSite}
          suggestions={suggestions}
          token={token}
          catalog={catalog}
          livePreviewSite={livePreviewSite}
          onSaveSection={async (key, value) => {
            await fetch("/api/portal/website", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ token, contentKey: key, contentValue: value }),
            });
            setPreviewContent(c => ({ ...c, [key]: value }));
            toast.success("Saved!");
          }}
          onSaveDesign={handleSaveDesign}
          coupleName={coupleName}
        />
      )}

      {/* ── Studio shell ── */}
      <div className="flex flex-col lg:flex-row h-full">

        {/* Mobile view toggle */}
        <div className="lg:hidden flex items-center gap-1 px-4 py-2 border-b border-border bg-card">
          <button type="button" onClick={() => setMobileView("edit")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${mobileView === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            ✏ Edit
          </button>
          <button type="button" onClick={() => setMobileView("preview")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${mobileView === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
        </div>

        {/* ── Sidebar (editor) ── */}
        <div className={`lg:w-[400px] lg:shrink-0 lg:border-r border-border lg:overflow-y-auto ${mobileView === "preview" ? "hidden lg:block" : "block"}`}>

          {/* Studio top bar */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Website Studio</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {completedSections} section{completedSections !== 1 ? "s" : ""} added
                {previewSite.isPublished && " · 🟢 Live"}
              </p>
            </div>
            <button type="button"
              onClick={() => {
                if (wizardDismissed || wizardStep === null) {
                  setWizardStep("welcome");
                  setWizardDismissed(false);
                }
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border hover:bg-muted/40 hidden lg:block">
              Setup guide
            </button>
          </div>

          {/* Collection carousel */}
          <div className="px-4 pt-4 pb-2">
            <CollectionCarousel
              catalog={catalog}
              site={previewSite}
              coupleName={coupleName}
              onChange={handleSaveDesign}
            />
            {savingDesign && (
              <p className="text-[10px] text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating…
              </p>
            )}
          </div>

          {/* Part 19 — Selected Design Summary */}
          <div className="px-4 pb-2">
            <SelectedDesignSummary
              site={previewSite}
              catalog={catalog}
              onEdit={(s) => { setWizardStep(s); setWizardDismissed(false); }}
            />
          </div>

          {/* Editor (sections + full controls, incl. the full Theme Studio) */}
          <div className="px-4 pb-6">
            <WebsiteEditor
              token={token}
              initialSite={previewSite}
              origin={origin}
              initialGuests={initialGuests}
              onSectionSaved={handleSaveSection}
              onAppearanceChanged={handleAppearanceChanged}
              focusSection={focusSection}
              hideStatusHeader={false}
            />
          </div>
        </div>

        {/* ── Live preview panel (desktop only + mobile preview tab) ── */}
        <div className={`flex-1 bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex flex-col ${mobileView === "edit" ? "hidden lg:flex" : "flex"}`}>

          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80 backdrop-blur shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPreviewDevice("mobile")}
                className={`p-1.5 rounded-lg transition-colors ${previewDevice === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <Smartphone className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setPreviewDevice("desktop")}
                className={`p-1.5 rounded-lg transition-colors ${previewDevice === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <Monitor className="h-3.5 w-3.5" />
              </button>
              {previewSite.slug && (
                <a href={previewSite.previewToken ? `${origin}/w/${previewSite.slug}?preview=${previewSite.previewToken}` : `${origin}/w/${previewSite.slug}`}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-1 p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  title="Open the real public page — works even before you publish">
                  <Eye className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Scrollable preview */}
          {previewDevice === "desktop" ? (
            // Desktop: edge-to-edge, browser-chrome feel, no card frame
            <div className="flex-1 overflow-y-auto relative" style={{ background: "#F0EDE8" }}>
              {/* Fake browser chrome */}
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 border-b border-black/10"
                style={{ background: "#E8E4DF" }}>
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full" style={{ background: "#FF5F57" }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: "#FEBC2E" }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: "#28C840" }} />
                </div>
                <div className="flex-1 mx-3 rounded-md px-3 py-1 text-[11px] text-center"
                  style={{ background: "#FAF8F5", color: "#888", fontFamily: "system-ui" }}>
                  {previewSite.slug ? `yourwedding.com/w/${previewSite.slug}` : "yourwedding.com"}
                </div>
              </div>
              {/* Full-width website preview */}
              <div style={{ background: "white" }}>
                <WeddingWebsite
                  site={livePreviewSite}
                  slug={previewSite.slug ?? "preview"}
                  editMode
                  activeSection={activeSection}
                  onSectionClick={handleSectionClick}
                />
              </div>
            </div>
          ) : (
            // Mobile: centered phone frame
            <div className="flex-1 overflow-y-auto py-6 px-3 flex justify-center" style={{ background: "#F0EDE8" }}>
              <PhonePreviewFrame maxHeight="calc(100vh - 240px)">
                <WeddingWebsite
                  site={livePreviewSite}
                  slug={previewSite.slug ?? "preview"}
                  editMode
                  activeSection={activeSection}
                  onSectionClick={handleSectionClick}
                />
              </PhonePreviewFrame>
            </div>
          )}

          {/* Click-to-edit hint */}
          <div className="shrink-0 text-center py-2 text-[10px] text-muted-foreground/60">
            Click any section to edit it
          </div>
        </div>

      </div>
    </>
  );
}

// Types for dynamic requires
type WebsiteEditorProps = {
  token: string;
  initialSite: CoupleWebsite;
  origin: string;
  initialGuests?: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[];
  onSectionSaved?: (key: string, value: object) => void;
  onAppearanceChanged?: (patch: DesignPatch) => void;
  focusSection?: string | null;
  hideStatusHeader?: boolean;
};

type WeddingWebsiteProps = {
  site: PublicWebsite;
  slug: string;
  editMode?: boolean;
  activeSection?: string | null;
  onSectionClick?: (key: string) => void;
};
