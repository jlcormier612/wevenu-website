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
import { ChevronLeft, ChevronRight, Eye, Loader2, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { ColorPickerTrigger } from "@/components/ui/color-picker";
import type { CoupleWebsite, WebsiteContent, WebsiteSuggestions, HostedExperienceCatalog, CatalogCollection } from "@/lib/wedding-website/types";
import type { PortalContext } from "@/lib/portal/types";
import type { PublicWebsite } from "@/lib/wedding-website/types";

// A save patch for any of the four design dimensions, or the legacy
// theme/themePalette/fontPairing strings sent alongside as a safety net —
// mirrors ThemePatch in website-editor.tsx.
type DesignPatch = Partial<CoupleWebsite & { fontPairing: string; clearCustomColors: boolean }>;

function collectionSwatch(c: CatalogCollection): string {
  return c.colorStories[0]?.tokens.heroGradient
    ?? `linear-gradient(160deg, ${c.swatchAccent ?? "#B8AEA1"} 0%, ${c.swatchAccent ?? "#DED6CA"} 100%)`;
}

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

function SetupWizard({
  step, setStep, onComplete,
  site, suggestions, token, catalog,
  onSaveSection, onSaveDesign, coupleName,
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  onComplete: () => void;
  site: CoupleWebsite;
  suggestions: WebsiteSuggestions | null;
  token: string;
  catalog: HostedExperienceCatalog | null;
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
  const [typographyStyleId, setTypographyStyleId] = React.useState<string | undefined>(site.typographyStyleId ?? undefined);
  const [photoStyleId, setPhotoStyleId] = React.useState<string | undefined>(site.photoStyleId ?? undefined);
  const [storyText, setStoryText] = React.useState(site.content?.story?.text ?? "");
  const [saving, setSaving] = React.useState(false);

  // Uploaded straight from this step (Studio Wizard photo-upload, 2026-07-22)
  // — before this, the only way to add a photo here was to leave the wizard
  // and go to Profile first. Merged with the suggested engagement photos for
  // display; a freshly uploaded photo is auto-selected.
  const [uploadedPhotos, setUploadedPhotos] = React.useState<{ id: string; url: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const eng = [...uploadedPhotos, ...(suggestions?.engagementPhotos ?? [])];

  const collections = catalog?.collections ?? [];
  const currentCollection = collections.find(c => c.id === collectionId) ?? collections[0];
  const currentColorStory = currentCollection?.colorStories.find(cs => cs.id === colorStoryId);
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
      if (step === "collection" && currentCollection) {
        await onSaveDesign({
          theme: currentCollection.key as CoupleWebsite["theme"], collectionId: currentCollection.id,
          ...(colorStoryId ? {} : (currentCollection.colorStories[0]
            ? { themePalette: currentCollection.colorStories[0].name, colorStoryId: currentCollection.colorStories[0].id }
            : {})),
        });
        if (!colorStoryId && currentCollection.colorStories[0]) setColorStoryId(currentCollection.colorStories[0].id);
      }
      if (step === "color") {
        const patch: DesignPatch = {};
        if (hasCustomColors) {
          patch.clearCustomColors = false;
          if (customColors.colorPrimary) patch.colorPrimary = customColors.colorPrimary;
          if (customColors.colorSecondary) patch.colorSecondary = customColors.colorSecondary;
          if (customColors.colorAccent) patch.colorAccent = customColors.colorAccent;
          if (customColors.colorNeutral) patch.colorNeutral = customColors.colorNeutral;
          if (customColors.colorBackground) patch.colorBackground = customColors.colorBackground;
          if (customColors.colorText) patch.colorText = customColors.colorText;
        } else if (colorStoryId) {
          patch.colorStoryId = colorStoryId;
          patch.themePalette = currentColorStory?.name;
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
        await onSaveSection("story", { title: "Our Story", text: storyText });
      }
    } finally { setSaving(false); }
    if (next === "done") onComplete();
    else setStep(next);
  }

  // ── Welcome ──
  if (step === "welcome") return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(160deg, var(--venue-primary) 0%, var(--venue-secondary) 60%, var(--venue-accent) 100%)" }}>
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.3em]">Website Studio</p>
          <h1 className="text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            Let's build your<br />wedding website.
          </h1>
        </div>
        {(suggestions?.story?.text || suggestions?.venue?.name || (eng.length > 0)) && (
          <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-2 text-left">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-[0.15em]">Already waiting for you</p>
            <div className="space-y-1.5">
              {suggestions?.coupleNames && <p className="text-white text-sm">✦ Your names: {suggestions.coupleNames}</p>}
              {suggestions?.venue?.name && <p className="text-white text-sm">📍 {suggestions.venue.name}</p>}
              {suggestions?.story?.text && <p className="text-white text-sm">💗 Your story</p>}
              {eng.length > 0 && <p className="text-white text-sm">📸 {eng.length} engagement photo{eng.length === 1 ? "" : "s"}</p>}
            </div>
          </div>
        )}
        <button type="button" onClick={() => setStep("photo")}
          className="w-full rounded-2xl py-4 text-base font-semibold bg-white hover:bg-white/90 transition-colors" style={{ color: "var(--venue-secondary)" }}>
          ✨ Let's get started
        </button>
        <button type="button" onClick={onComplete} className="text-white/50 text-sm hover:text-white/80 transition-colors">
          Skip setup — go straight to studio
        </button>
      </div>
    </div>
  );

  // ── Photo ──
  if (step === "photo") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("collection")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">📸</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Choose your favorite photo.</h2>
          <p className="text-sm text-muted-foreground">This will be the first thing guests see.</p>
        </div>

        <input ref={photoInputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handlePhotoUpload(f); }} disabled={uploadingPhoto} />

        {eng.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your engagement photos</p>
              <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
                {uploadingPhoto ? "Uploading…" : "+ Upload a photo"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {eng.slice(0, 9).map((p, i) => (
                <button key={p.id} type="button" onClick={() => setSelectedPhoto(p.url)}
                  className={`relative rounded-xl overflow-hidden transition-all hover:scale-[1.02] ${selectedPhoto === p.url ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ aspectRatio: "1/1" }}>
                  <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {selectedPhoto === p.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                      <div className="h-7 w-7 rounded-full bg-card flex items-center justify-center">
                        <span className="text-primary text-sm font-bold">✓</span>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {eng.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <p className="text-4xl">🌿</p>
            <p className="text-sm text-muted-foreground">No engagement photos uploaded yet.</p>
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--venue-primary)" }}>
              {uploadingPhoto ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</> : "📤 Upload a photo"}
            </button>
            <p className="text-xs text-muted-foreground">Or skip this step and add photos later.</p>
          </div>
        )}
      </div>
      <WizardFooter
        onBack={() => setStep("welcome")}
        onNext={() => advance("collection")}
        nextLabel={selectedPhoto ? "Use this photo →" : "Skip for now →"}
        saving={saving}
      />
    </div>
  );

  // ── Step 1: Layout Collection ──
  if (step === "collection") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("color")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">🖼</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Choose your Layout Collection.</h2>
          <p className="text-sm text-muted-foreground">This shapes your whole website — composition, hero, gallery, motion. Not just colors.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {collections.map(c => {
            const isSelected = c.id === currentCollection?.id;
            return (
              <button key={c.id} type="button"
                onClick={() => { setCollectionId(c.id); if (!colorStoryId && c.colorStories[0]) setColorStoryId(c.colorStories[0].id); }}
                className={`relative rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                <div className="h-20 relative flex items-center justify-center" style={{ background: collectionSwatch(c) }}>
                  <p className="text-sm font-semibold text-white text-center px-2" style={{ fontFamily: catalog?.typographyStyles[0]?.tokens.headingFont }}>
                    {suggestions?.coupleNames ?? coupleName}
                  </p>
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <span className="text-[10px] text-[var(--venue-primary)] font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 bg-white border-t border-black/5">
                  <p className="text-xs font-bold text-heading">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <WizardFooter onBack={() => setStep("photo")} onNext={() => advance("color")} nextLabel="This is us →" saving={saving} />
    </div>
  );

  // ── Step 2: Color Story ──
  if (step === "color") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("typography")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">🎨</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Choose your Color Story.</h2>
          <p className="text-sm text-muted-foreground">Start from a curated palette, or pick every color yourself.</p>
        </div>

        {currentCollection && currentCollection.colorStories.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick start · {currentCollection.name}</p>
            <div className="flex gap-3">
              {currentCollection.colorStories.map(cs => {
                const isActive = !hasCustomColors && cs.id === colorStoryId;
                return (
                  <button key={cs.id} type="button"
                    onClick={() => { setColorStoryId(cs.id); setCustomColors({ colorPrimary: "", colorSecondary: "", colorAccent: "", colorNeutral: "", colorBackground: "", colorText: "" }); }}
                    className="flex flex-col items-center gap-1.5">
                    <div className={`rounded-full border-2 transition-all ${isActive ? "h-10 w-10 border-[var(--venue-primary)] scale-110 shadow-md" : "h-8 w-8 border-transparent hover:border-border"}`}
                      style={{ background: cs.tokens.heroGradient }} />
                    <p className={`text-[10px] ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{cs.name}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Or design your own</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "colorPrimary", label: "Primary", fallback: currentColorStory?.tokens.accent },
              { key: "colorSecondary", label: "Secondary", fallback: currentColorStory?.tokens.accent },
              { key: "colorAccent", label: "Accent", fallback: currentColorStory?.tokens.accent },
              { key: "colorNeutral", label: "Neutral", fallback: "#DED6CA" },
              { key: "colorBackground", label: "Background", fallback: currentColorStory?.tokens.bg },
              { key: "colorText", label: "Text", fallback: currentColorStory?.tokens.dark ? "#F5F0E8" : "#2E2A24" },
            ].map(r => (
              <div key={r.key} className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">{r.label}</p>
                <ColorPickerTrigger
                  value={customColors[r.key] || r.fallback || "#BF9089"}
                  onChange={(v) => setCustomColors(c => ({ ...c, [r.key]: v }))}
                />
              </div>
            ))}
          </div>
          {hasCustomColors && (
            <button type="button" onClick={() => setCustomColors({ colorPrimary: "", colorSecondary: "", colorAccent: "", colorNeutral: "", colorBackground: "", colorText: "" })}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
              Clear custom colors — use the preset instead
            </button>
          )}
        </div>
      </div>
      <WizardFooter onBack={() => setStep("collection")} onNext={() => advance("typography")} nextLabel="Love it →" saving={saving} />
    </div>
  );

  // ── Step 3: Typography ──
  if (step === "typography") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("photostyle")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">🔤</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Choose your Typography.</h2>
          <p className="text-sm text-muted-foreground">Independent of your Collection — carries through every heading, quote, and button.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(catalog?.typographyStyles ?? []).map(t => {
            const isSelected = t.id === currentTypography?.id;
            return (
              <button key={t.id} type="button" onClick={() => setTypographyStyleId(t.id)}
                className={`rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-primary ring-offset-2 border-primary" : "border-border"}`}>
                <p className="text-lg" style={{ fontFamily: t.tokens.headingFont, fontStyle: t.tokens.headingItalic ? "italic" : "normal" }}>
                  {suggestions?.coupleNames ?? coupleName}
                </p>
                <p className="text-xs font-semibold text-heading mt-2">{t.name}</p>
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
        <div className="text-center space-y-2">
          <p className="text-3xl">📷</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Choose your Photo Style.</h2>
          <p className="text-sm text-muted-foreground">How your photos are presented — independent of everything else.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(catalog?.photoStyles ?? []).map(p => {
            const isSelected = p.id === currentPhotoStyle?.id;
            return (
              <button key={p.id} type="button" onClick={() => setPhotoStyleId(p.id)}
                className={`rounded-2xl border overflow-hidden text-left transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-primary ring-offset-2 border-primary" : "border-border"}`}>
                <div className="h-16 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C9B89A 0%, #97AC9E 100%)" }}>
                  <div style={{
                    width: p.tokens.imageScale === "large" ? "70%" : "45%", aspectRatio: "1/1",
                    filter: p.tokens.photoFilter, borderRadius: p.tokens.photoRadius,
                    background: "linear-gradient(160deg, #D8CFC2 0%, #EBE5DB 100%)",
                    border: p.tokens.frameStyle === "border" ? "3px solid #fff" : p.tokens.frameStyle === "polaroid" ? "4px solid #fff" : undefined,
                    boxShadow: p.tokens.frameStyle === "polaroid" ? "0 2px 6px rgba(0,0,0,0.25)" : undefined,
                  }} />
                </div>
                <div className="px-3 py-2.5 bg-white border-t border-black/5">
                  <p className="text-xs font-bold text-heading">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
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
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">💗</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Tell the world how you found each other.</h2>
          <p className="text-sm text-muted-foreground">Guests love reading this. Make it yours.</p>
        </div>

        {suggestions?.story?.text && !storyText && (
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--venue-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--venue-primary)_5%,transparent)] p-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--venue-primary)]">✦ From your profile — tap to use</p>
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
            rows={6}
            placeholder="We met at a coffee shop in Nashville on a rainy Tuesday morning…"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">{storyText.length} / 500</p>
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

  // ── Preview ──
  if (step === "preview") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button type="button" onClick={() => setStep("story")} className="p-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-heading">Here's your website.</p>
          <WizardProgress step={step} />
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-6">
        {/* Mini website preview card — driven live by all four dimensions */}
        <div className="w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl border border-border">
          <div className="h-44 flex flex-col items-center justify-center text-center px-4 relative"
            style={{ background: currentColorStory?.tokens.heroGradient ?? (currentCollection ? collectionSwatch(currentCollection) : undefined) }}>
            {selectedPhoto && (
              <div className="absolute inset-0 opacity-50"
                style={{ backgroundImage: `url(${selectedPhoto})`, backgroundSize: "cover", backgroundPosition: "center", filter: currentPhotoStyle?.tokens.photoFilter }} />
            )}
            <div className="relative z-10 space-y-2">
              <p className="text-[9px] text-white/60 uppercase tracking-[0.25em]">Wedding</p>
              <p className="text-xl font-bold text-white" style={{ fontFamily: currentTypography?.tokens.headingFont, fontStyle: currentTypography?.tokens.headingItalic ? "italic" : "normal" }}>
                {suggestions?.coupleNames ?? coupleName}
              </p>
              {suggestions?.event?.eventDate && (
                <p className="text-xs text-white/70">
                  {new Date(suggestions.event.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
          <div className="p-4 bg-white space-y-2">
            {storyText ? (
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2" style={{ fontFamily: currentTypography?.tokens.bodyFont }}>{storyText}</p>
            ) : (
              <p className="text-xs text-gray-300 italic">Your story will appear here…</p>
            )}
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-heading">
            {currentCollection?.name} · {suggestions?.coupleNames ?? coupleName}
          </p>
          <p className="text-xs text-muted-foreground">Looking beautiful. You can keep building in the studio.</p>
        </div>

        <div className="w-full max-w-xs space-y-2">
          <button type="button" onClick={() => advance("done")} disabled={saving}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--venue-primary)" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "✨ Open Website Studio"}
          </button>
        </div>
      </div>
    </div>
  );

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

function CollectionCarousel({ catalog, currentCollectionId, currentColorStoryId, onChange }: {
  catalog: HostedExperienceCatalog | null;
  currentCollectionId?: string | null;
  currentColorStoryId?: string | null;
  onChange: (patch: DesignPatch) => void;
}) {
  const collections = catalog?.collections ?? [];
  const idx = Math.max(0, collections.findIndex(c => c.id === currentCollectionId));
  const current = collections[idx] ?? collections[0];
  const currentStory = current?.colorStories.find(cs => cs.id === currentColorStoryId) ?? current?.colorStories[0];

  function go(dir: 1 | -1) {
    if (collections.length === 0) return;
    const next = collections[(idx + dir + collections.length) % collections.length];
    onChange({
      theme: next.key as CoupleWebsite["theme"], collectionId: next.id,
      ...(next.colorStories[0] ? { themePalette: next.colorStories[0].name, colorStoryId: next.colorStories[0].id } : {}),
    });
  }

  if (!current) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-border">
      {/* Mini preview */}
      <div className="h-20 relative flex items-center justify-center" style={{ background: currentStory?.tokens.heroGradient ?? collectionSwatch(current) }}>
        <p className="text-base font-semibold text-white">Emily &amp; James</p>
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
          {current.colorStories.map(cs => (
            <button key={cs.id} type="button"
              onClick={() => onChange({ colorStoryId: cs.id, themePalette: cs.name })}
              title={cs.name}
              className={`rounded-full border-2 transition-all ${cs.id === currentStory?.id ? "h-5 w-5 border-foreground scale-110" : "h-4 w-4 border-transparent hover:border-border"}`}
              style={{ background: cs.tokens.accent }} />
          ))}
        </div>
      )}
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
    const colorStory = collection?.colorStories.find(cs => cs.id === previewSite.colorStoryId);
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
              currentCollectionId={previewSite.collectionId}
              currentColorStoryId={previewSite.colorStoryId}
              onChange={handleSaveDesign}
            />
            {savingDesign && (
              <p className="text-[10px] text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating…
              </p>
            )}
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
              <div className="w-full max-w-[375px] shrink-0"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderRadius: "40px", overflow: "hidden", border: "8px solid #1A1A1A", background: "white" }}>
                {/* Phone notch */}
                <div className="h-6 flex items-center justify-center" style={{ background: "#1A1A1A" }}>
                  <div className="h-1.5 w-16 rounded-full" style={{ background: "#3A3A3A" }} />
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
                  <WeddingWebsite
                    site={livePreviewSite}
                    slug={previewSite.slug ?? "preview"}
                    editMode
                    activeSection={activeSection}
                    onSectionClick={handleSectionClick}
                  />
                </div>
              </div>
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
