"use client";

/**
 * WebsiteEditor — Wedding Website Studio.
 *
 * "Choose a beautiful theme. Upload photos. Add your story.
 *  Preview the experience exactly as guests will see it. Fall in love with it. Publish it."
 *
 * Sprint 68: Theme Studio foundation — 8 named themes with distinct visual personalities,
 * studio-first entry, gallery, dress code, bridal party, things to do, music, section ordering.
 */

import * as React from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Image, Loader2, Mail, Palette, Plus, Smartphone, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ColorPickerTrigger } from "@/components/ui/color-picker";
import type { CoupleWebsite, WebsiteContent, WebsiteSuggestions, HostedExperienceCatalog, PublicWebsite } from "@/lib/wedding-website/types";
import { celebrateLuv } from "@/lib/luv/celebrate";
import { coupleCelebrationMessage } from "@/lib/luv/celebrations";
import { resolveDesignState } from "@/lib/wedding-website/design-state";
import { deriveSixRoles, swatchGradient, type SixRoleColors } from "@/lib/wedding-website/curated-color-stories";
import { resolveStudioPreviewPhotos } from "@/lib/wedding-website/studio-preview-content";
import { collectionDescriptor } from "@/lib/wedding-website/collection-descriptors";
import { CollectionPreview, ColorStoryPreview, TypographyPreview, PhotoStylePreview } from "@/components/portal/collection-preview";

// ── Theme Studio (2026-07-24) ─────────────────────────────────────────────────
// Four independent dimensions, catalog-driven end to end — no more hardcoded
// THEME_LIBRARY/FONT_PAIRINGS duplicating collections/typography_styles.
// See ThemeStudio below.

// ── Section definitions ───────────────────────────────────────────────────────

export type SectionDef = {
  key: string;
  title: string;
  emoji: string;
  description: string;
  preview?: (content: WebsiteContent) => string | null;
};

// Exported so the couple portal dashboard's Website launch card (Program 5,
// 2026-07-24) can compute the exact same completion % shown inside the
// Studio itself — one source of truth for "what counts as a filled
// section," not a second copy that could drift.
export const ALL_SECTIONS: SectionDef[] = [
  { key: "home",         emoji: "🌿", title: "Home & Welcome",   description: "Your headline, cover photo, and welcome message.", preview: c => c.home?.title || c.home?.welcomeMessage || null },
  { key: "story",        emoji: "💗", title: "Your Story",        description: "How you met — the most personal part of your website.", preview: c => (c as any).story?.text?.slice(0, 60) || null },
  { key: "event",        emoji: "📍", title: "Event Details",     description: "Ceremony and reception times, locations, and addresses.", preview: c => c.event?.ceremony?.location || c.event?.reception?.location || null },
  { key: "gallery",      emoji: "📸", title: "Photo Gallery",     description: "A beautiful grid of your photos, visible to all guests.", preview: c => c.gallery?.photos?.length ? `${c.gallery.photos.length} photo${c.gallery.photos.length === 1 ? "" : "s"}` : null },
  { key: "schedule",     emoji: "📋", title: "Day-of Schedule",   description: "A timeline for your guests.", preview: c => c.schedule?.length ? `${c.schedule.length} schedule items` : null },
  { key: "travel",       emoji: "🏨", title: "Travel & Hotels",   description: "Hotel blocks, transportation notes, and travel info.", preview: c => c.travel?.hotels?.[0]?.name || c.travel?.message?.slice(0, 50) || null },
  { key: "dress_code",   emoji: "👗", title: "Dress Code",        description: "Help guests know what to wear.", preview: c => c.dress_code?.formality ? ({ casual: "Casual", smart_casual: "Smart Casual", cocktail: "Cocktail Attire", black_tie: "Black Tie", custom: "Custom" }[c.dress_code.formality] ?? null) : null },
  { key: "bridal_party", emoji: "💐", title: "Wedding Party",     description: "Introduce the people standing by your side.", preview: c => c.bridal_party?.members?.length ? `${c.bridal_party.members.length} members` : null },
  { key: "things_to_do", emoji: "🗺",  title: "Things To Do",     description: "Local restaurants, hotels, and attractions for your guests.", preview: c => c.things_to_do?.items?.length ? `${c.things_to_do.items.length} recommendations` : null },
  { key: "music",        emoji: "🎵", title: "Music",             description: "Share the songs that will fill your celebration.", preview: c => c.music?.ceremony || c.music?.reception || null },
  { key: "registry",     emoji: "🎁", title: "Registry",          description: "Links to your registries.", preview: c => c.registry?.length ? `${c.registry.length} registr${c.registry.length === 1 ? "y" : "ies"}` : null },
  { key: "faq",          emoji: "❓", title: "FAQ",               description: "Common guest questions and answers.", preview: c => c.faq?.length ? `${c.faq.length} question${c.faq.length === 1 ? "" : "s"}` : null },
];

const DEFAULT_SECTION_ORDER = ALL_SECTIONS.map(s => s.key);

// ── Photo upload helper ───────────────────────────────────────────────────────

function PhotoUpload({ token, type, label, currentUrl, onUploaded }: {
  token: string; type: string; label: string;
  currentUrl?: string; onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("token", token); form.append("file", file); form.append("type", type);
      const res = await fetch("/api/portal/upload", { method: "POST", body: form });
      const data = await res.json() as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) { onUploaded(data.url); toast.success(`${label} uploaded!`); }
      else toast.error(data.error ?? "Upload failed.");
    } catch { toast.error("Upload failed. Please try again."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {currentUrl && (
        <div className="relative rounded-xl overflow-hidden h-24 bg-muted">
          <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer px-3 py-2.5 rounded-xl border border-dashed border-border hover:bg-muted/40 transition-colors">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Image className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{uploading ? "Uploading…" : currentUrl ? "Change photo" : `Upload ${label.toLowerCase()}`}</span>
        <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
    </div>
  );
}

function Actions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="text-sm text-muted-foreground px-3 py-1.5 rounded-xl hover:bg-muted">Cancel</button>
      <button type="button" onClick={onSave} className="text-sm font-medium px-4 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90">Save</button>
    </div>
  );
}

// ── Section editors ───────────────────────────────────────────────────────────

// Hosted Experience Platform Phase 5 — visible "Sourced from Planning ·
// synced [date]" indicator + explicit Refresh action for guided sections
// (§3/§4). Refresh re-pulls live via onRefresh; accepting a proposed value
// never auto-saves — the couple still reviews it in the form and presses
// Save, at which point onSynced stamps last_synced_at.
function SyncBadge({ lastSyncedAt, onRefresh, refreshing }: {
  lastSyncedAt?: string | null; onRefresh?: () => void; refreshing?: boolean;
}) {
  if (!onRefresh) return null;
  return (
    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
      <span>
        Sourced from Planning{lastSyncedAt
          ? ` · synced ${new Date(lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : " · not yet synced"}
      </span>
      <button type="button" onClick={onRefresh} disabled={refreshing}
        className="underline underline-offset-2 hover:text-foreground disabled:opacity-50">
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}

function HomeEditor({ content, onSave, onCancel, token, suggestions, lastSyncedAt, onRefresh, onSynced }: {
  content: WebsiteContent; onSave: (v: object) => void | Promise<void>; onCancel: () => void; token: string;
  suggestions?: WebsiteSuggestions | null;
  lastSyncedAt?: string | null;
  onRefresh?: () => Promise<WebsiteSuggestions | null>;
  onSynced?: () => void;
}) {
  const suggestedTitle    = suggestions?.coupleNames ?? null;
  const suggestedSubtitle = React.useMemo(() => {
    const date = suggestions?.event?.eventDate
      ? new Date(suggestions.event.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    const city = suggestions?.venue?.city ?? null;
    return date && city ? `${date} · ${city}` : date ?? null;
  }, [suggestions]);

  const [title, setTitle] = React.useState(content.home?.title ?? suggestedTitle ?? "");
  const [subtitle, setSubtitle] = React.useState(content.home?.subtitle ?? suggestedSubtitle ?? "");
  const [welcome, setWelcome] = React.useState(content.home?.welcomeMessage ?? "");
  const [coverUrl, setCoverUrl] = React.useState(content.home?.coverImageUrl ?? "");
  const [refreshing, setRefreshing] = React.useState(false);
  const [justAccepted, setJustAccepted] = React.useState(false);

  const engagementPhotos = suggestions?.engagementPhotos ?? [];
  const hasCoverSuggestions = engagementPhotos.length > 0 && !coverUrl;

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    const fresh = await onRefresh();
    setRefreshing(false);
    if (!fresh) { toast.info("Nothing new found in Planning."); return; }
    const changed = fresh.coupleNames !== suggestedTitle || (fresh.engagementPhotos?.length ?? 0) > engagementPhotos.length;
    toast.success(changed ? "Refreshed — review the suggestions below." : "You're up to date with Planning.");
  }

  async function handleSave() {
    await onSave({ title, subtitle, welcomeMessage: welcome, coverImageUrl: coverUrl || undefined });
    if (justAccepted) onSynced?.();
  }

  return (
    <div className="space-y-3">

      <SyncBadge lastSyncedAt={lastSyncedAt} onRefresh={onRefresh ? handleRefresh : undefined} refreshing={refreshing} />

      {/* ── Cover photo suggestion ── */}
      {hasCoverSuggestions && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">
            📸 {engagementPhotos.length} engagement photo{engagementPhotos.length === 1 ? "" : "s"} found — tap one to use as your cover
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {engagementPhotos.slice(0, 6).map((p, i) => (
              <button key={p.id} type="button" onClick={() => { setCoverUrl(p.url); setJustAccepted(true); }}
                className={`shrink-0 h-16 w-16 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${coverUrl === p.url ? "border-primary" : "border-transparent"}`}>
                <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Pre-filled names notice ── */}
      {!content.home?.title && suggestedTitle && title === suggestedTitle && (
        <div className="flex items-center gap-2 text-[10px] text-primary bg-primary/5 rounded-xl px-3 py-2">
          <span>✦</span>
          <span>Headline pre-filled from your profile — customize it below.</span>
        </div>
      )}

      {coverUrl && (
        <div className="relative rounded-xl overflow-hidden h-24 bg-muted group">
          <img src={coverUrl} alt="Cover photo" className="w-full h-full object-cover" />
          <button type="button" onClick={() => setCoverUrl("")}
            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 items-center justify-center text-white hidden group-hover:flex">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <PhotoUpload token={token} type="cover" label={coverUrl ? "Change cover photo" : "Upload cover photo"} onUploaded={setCoverUrl} />
      <Field label="Page headline" value={title} onChange={setTitle} placeholder="Emily & James" />
      {/* Coastal Art-Direction Pass 2 (2026-08-03) — used to suggest a
          date+location example, which collided with the wedding date
          already shown automatically below it (the actual bug found in
          the Coastal fixture: a hand-typed date that drifted from the
          real one). Your date/location are always synced from Planning —
          this is for a short phrase instead. */}
      <Field label="Subtitle" value={subtitle} onChange={setSubtitle} placeholder="Two hearts, one beautiful beginning" />
      <p className="text-[11px] text-muted-foreground -mt-2">Your wedding date and location are shown automatically — use this for a short phrase instead.</p>
      <TextareaField label="Welcome message" value={welcome} onChange={setWelcome} placeholder="We're so excited to celebrate with you!" rows={3} />
      <Actions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function StoryEditor({ content, onSave, onCancel, token, suggestions, lastSyncedAt, onRefresh, onSynced }: {
  content: WebsiteContent; onSave: (v: object) => void | Promise<void>; onCancel: () => void; token: string;
  suggestions?: WebsiteSuggestions | null;
  lastSyncedAt?: string | null;
  onRefresh?: () => Promise<WebsiteSuggestions | null>;
  onSynced?: () => void;
}) {
  const story = (content as any).story ?? {};
  const [title, setTitle] = React.useState(story.title ?? "How We Met");
  const [text, setText] = React.useState(story.text ?? "");
  const [imageUrl, setImageUrl] = React.useState(story.imageUrl ?? "");
  const [refreshing, setRefreshing] = React.useState(false);
  const [justAccepted, setJustAccepted] = React.useState(false);

  const profileStory = suggestions?.story?.text ?? null;
  // Show sync prompt when: profile has a story AND the website hasn't been customized yet
  const showSyncPrompt = !!profileStory && !story.text;

  function useProfileStory() {
    setText(profileStory!);
    setJustAccepted(true);
    toast.success("Story synced from your profile.");
  }

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    const fresh = await onRefresh();
    setRefreshing(false);
    if (!fresh?.story?.text) { toast.info("Nothing new found in Planning."); return; }
    toast.success(fresh.story.text !== profileStory ? "Refreshed — review the suggestion below." : "You're up to date with Planning.");
  }

  async function handleSave() {
    await onSave({ title, text, imageUrl: imageUrl || undefined });
    if (justAccepted) onSynced?.();
  }

  return (
    <div className="space-y-3">

      <SyncBadge lastSyncedAt={lastSyncedAt} onRefresh={onRefresh ? handleRefresh : undefined} refreshing={refreshing} />

      {/* ── Sync from Profile prompt ── */}
      {showSyncPrompt && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-start gap-2">
            <span className="text-sm mt-0.5">✦</span>
            <div>
              <p className="text-xs font-semibold text-primary">Sync from Profile</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">You already wrote your story in your profile. Use it here.</p>
            </div>
          </div>
          <div className="rounded-lg bg-card/60 border border-primary/20 px-3 py-2.5">
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{profileStory}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={useProfileStory}
              className="flex-1 text-xs font-semibold py-2 rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90">
              Use this story
            </button>
            <button type="button" onClick={() => setText("")}
              className="text-xs text-muted-foreground py-2 px-3 rounded-xl border border-border hover:bg-muted/40">
              Write my own
            </button>
          </div>
        </div>
      )}

      <Field label="Section title" value={title} onChange={setTitle} placeholder="How We Met" />
      <TextareaField label="Your story" value={text} onChange={setText} placeholder="We met at a coffee shop in Nashville on a rainy Tuesday morning…" rows={5} />

      {/* ── Story photo — its own dedicated, optional image. Never the
          gallery's first photo, never the cover/hero photo: a couple
          shouldn't have to know "my first gallery photo secretly becomes
          my Our Story photo." ── */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">Story photo (optional)</p>
        <p className="text-[10px] text-muted-foreground -mt-1">Add a favorite photo to appear with your story.</p>
        {imageUrl && (
          <div className="relative rounded-xl overflow-hidden h-24 bg-muted group">
            <img src={imageUrl} alt="Story photo" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setImageUrl("")}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 items-center justify-center text-white hidden group-hover:flex">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <PhotoUpload token={token} type="story" label="a photo" onUploaded={setImageUrl} />
      </div>

      {/* ── Re-sync prompt when editing a customized story ── */}
      {!showSyncPrompt && profileStory && story.text && story.text !== profileStory && (
        <button type="button" onClick={useProfileStory}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <span>↺</span> Reset to profile story
        </button>
      )}

      <Actions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function EventEditor({ content, onSave, onCancel, suggestions }: {
  content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void;
  suggestions?: WebsiteSuggestions | null;
}) {
  // Derive venue-based suggestion strings
  const suggestedLocation = suggestions?.venue?.name ?? null;
  const suggestedAddress  = React.useMemo(() => {
    const v = suggestions?.venue;
    if (!v) return null;
    return [v.address, v.city, v.state].filter(Boolean).join(", ") || null;
  }, [suggestions]);

  const [cTime, setCTime] = React.useState(content.event?.ceremony?.time ?? "");
  const [cLocation, setCLocation] = React.useState(
    content.event?.ceremony?.location ?? suggestedLocation ?? ""
  );
  const [cAddress, setCAddress] = React.useState(
    content.event?.ceremony?.address ?? suggestedAddress ?? ""
  );
  const [rTime, setRTime] = React.useState(content.event?.reception?.time ?? "");
  const [rLocation, setRLocation] = React.useState(
    content.event?.reception?.location ?? suggestedLocation ?? ""
  );
  const [rAddress, setRAddress] = React.useState(
    content.event?.reception?.address ?? suggestedAddress ?? ""
  );

  // Show the "pre-filled from venue" notice when fields came from suggestions
  const wasPreFilled = !!(
    suggestedLocation && !content.event?.ceremony?.location && cLocation === suggestedLocation
  );

  function applyVenueSuggestion() {
    if (suggestedLocation) { setCLocation(suggestedLocation); setRLocation(suggestedLocation); }
    if (suggestedAddress) { setCAddress(suggestedAddress); setRAddress(suggestedAddress); }
    toast.success("Filled from venue details.");
  }

  return (
    <div className="space-y-4">

      {/* ── Venue pre-fill notice or button ── */}
      {suggestedLocation && (
        wasPreFilled ? (
          <div className="flex items-center gap-2 text-[10px] text-primary bg-primary/5 rounded-xl px-3 py-2">
            <span>✦</span>
            <span>Location pre-filled from your venue — customize the times below.</span>
          </div>
        ) : (
          !content.event?.ceremony?.location && (
            <button type="button" onClick={applyVenueSuggestion}
              className="w-full flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-left hover:bg-primary/10 transition-colors">
              <div>
                <p className="text-xs font-semibold text-primary">Fill from venue details</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{suggestedLocation}{suggestedAddress ? ` · ${suggestedAddress}` : ""}</p>
              </div>
              <span className="text-primary text-xs font-medium">Use →</span>
            </button>
          )
        )
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ceremony</p>
        <Field label="Time" value={cTime} onChange={setCTime} placeholder="4:00 PM" />
        <Field label="Location" value={cLocation} onChange={setCLocation} placeholder="The Wildflower Estate" />
        <Field label="Address" value={cAddress} onChange={setCAddress} placeholder="123 Meadow Lane, Nashville, TN" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reception</p>
        <Field label="Time" value={rTime} onChange={setRTime} placeholder="6:00 PM" />
        <Field label="Location" value={rLocation} onChange={setRLocation} placeholder="The Wildflower Estate Garden" />
        <Field label="Address" value={rAddress} onChange={setRAddress} placeholder="123 Meadow Lane, Nashville, TN" />
      </div>
      <Actions onSave={() => onSave({ ceremony: { time: cTime, location: cLocation, address: cAddress }, reception: { time: rTime, location: rLocation, address: rAddress } })} onCancel={onCancel} />
    </div>
  );
}

function GalleryEditor({ content, onSave, onCancel, token }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void; token: string }) {
  const [title, setTitle] = React.useState(content.gallery?.title ?? "Our Photos");
  const [photos, setPhotos] = React.useState<string[]>(content.gallery?.photos ?? []);
  const [loadingImport, setLoadingImport] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function importEngagementPhotos() {
    setLoadingImport(true);
    try {
      const res = await fetch(`/api/portal/profile?token=${token}`);
      const data = await res.json() as { engagementPhotos?: { fileUrl: string }[] };
      const available = data.engagementPhotos ?? [];
      const newUrls = available.map(p => p.fileUrl).filter(u => !photos.includes(u));
      if (newUrls.length > 0) {
        setPhotos(p => [...p, ...newUrls]);
        toast.success(`${newUrls.length} photo${newUrls.length === 1 ? "" : "s"} imported!`);
      } else if (available.length === 0) {
        // Previously said "already in your gallery" here too — factually
        // wrong when there's nothing to import in the first place (client
        // portal feedback, 2026-07-22).
        toast.info("You haven't uploaded any engagement photos yet — add some from your Profile first.");
      } else {
        toast.info("All engagement photos are already in your gallery.");
      }
    } catch { toast.error("Could not import photos."); }
    finally { setLoadingImport(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("token", token); form.append("file", file); form.append("type", "gallery");
      const res = await fetch("/api/portal/upload", { method: "POST", body: form });
      const data = await res.json() as { ok: boolean; url?: string };
      if (data.ok && data.url) setPhotos(p => [...p, data.url!]);
      else toast.error("Upload failed.");
    } catch { toast.error("Upload failed."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <div className="space-y-4">
      <Field label="Gallery title" value={title} onChange={setTitle} placeholder="Our Photos" />

      {/* Beautiful-by-default guidance (Coastal Art-Direction Pass 2) —
          contextual only, never a validation error; publishing is never
          blocked by this. A Magazine-style layout needs real range to look
          intentional rather than a single lonely photo. */}
      {photos.length > 0 && photos.length < 3 && (
        <p className="text-[11px] text-muted-foreground">Add a few more photos to bring your gallery to life.</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={importEngagementPhotos} disabled={loadingImport}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors disabled:opacity-50">
          {loadingImport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
          Import engagement photos
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors disabled:opacity-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Upload photo
        </button>
        <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleUpload} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "1/1" }}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No photos yet. Import from engagement photos or upload new ones.</p>
      )}
      <Actions onSave={() => onSave({ title, photos })} onCancel={onCancel} />
    </div>
  );
}

function ScheduleEditor({ content, onSave, onCancel, token, scheduleSync, onToggleSync }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void; token?: string; scheduleSync?: boolean; onToggleSync?: (v: boolean) => void }) {
  const [items, setItems] = React.useState<{ time: string; title: string; description: string }[]>(
    content.schedule?.map(i => ({ ...i, description: i.description ?? "" })) ?? []
  );
  const [guestTimeline, setGuestTimeline] = React.useState<{ time: string; title: string }[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(false);

  React.useEffect(() => {
    if (!token || scheduleSync === false) return;
    setLoadingTimeline(true);
    fetch(`/api/portal/website/guest-timeline?token=${token}`)
      .then(r => r.json())
      .then((d: { entries?: { time: string; title: string }[] }) => setGuestTimeline(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoadingTimeline(false));
  }, [token, scheduleSync]);

  const isSync = scheduleSync !== false;

  return (
    <div className="space-y-4">
      {onToggleSync && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-heading">
                {isSync ? "☑ Syncing from Event Timeline" : "○ Using custom content"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isSync ? "Timeline entries tagged 🌿 Guests appear here automatically." : "You've overridden with custom schedule items below."}
              </p>
            </div>
            <button type="button" onClick={() => onToggleSync(!isSync)} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0">
              {isSync ? "Use custom" : "Sync from timeline"}
            </button>
          </div>
          {isSync && (loadingTimeline ? (
            <p className="text-[10px] text-muted-foreground">Loading timeline entries…</p>
          ) : guestTimeline.length > 0 ? (
            <div className="space-y-1">
              {guestTimeline.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-16 shrink-0">{e.time?.slice(0, 5) ?? ""}</span>
                  <span className="text-heading">{e.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">No guest-facing timeline entries yet. Go to the event's Timeline tab and tag entries 🌿 Guests.</p>
          ))}
        </div>
      )}
      {!isSync && (
        <>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input value={item.time} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, time: e.target.value } : it))} placeholder="4:00 PM" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <input value={item.title} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, title: e.target.value } : it))} placeholder="Ceremony begins" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <input value={item.description} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, description: e.target.value } : it))} placeholder="Description (optional)" className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              </div>
              <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setItems(p => [...p, { time: "", title: "", description: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Add schedule item
          </button>
          <Actions onSave={() => onSave(items.filter(i => i.title.trim()))} onCancel={onCancel} />
        </>
      )}
      {isSync && <div className="flex justify-end"><button type="button" onClick={onCancel} className="text-sm text-muted-foreground px-3 py-1.5 rounded-xl hover:bg-muted">Close</button></div>}
    </div>
  );
}

function TravelEditor({ content, onSave, onCancel, suggestions }: {
  content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void;
  suggestions?: WebsiteSuggestions | null;
}) {
  const [message, setMessage] = React.useState(content.travel?.message ?? "");
  const [hotels, setHotels] = React.useState<{ name: string; url: string; code: string; notes: string }[]>(
    content.travel?.hotels?.map(h => ({ name: h.name, url: h.url ?? "", code: h.code ?? "", notes: h.notes ?? "" })) ?? []
  );
  const [transport, setTransport] = React.useState(content.travel?.transportation?.notes ?? "");

  // Fill from the venue's own hotel blocks / transportation info
  // (venue_operational_info, Sprint 75) — same one-click, non-destructive
  // "Fill from venue details" pattern as EventEditor's venue-address
  // suggestion, not auto-applied.
  const suggestedHotels = suggestions?.travel?.hotels ?? [];
  const suggestedTransport = suggestions?.travel?.transportation?.notes ?? null;
  const hasTravelSuggestion = (suggestedHotels.length > 0 || !!suggestedTransport) && hotels.length === 0 && !transport.trim();

  function applyTravelSuggestion() {
    if (suggestedHotels.length > 0) {
      setHotels(suggestedHotels.map(h => ({ name: h.name, url: h.url ?? "", code: h.code ?? "", notes: h.notes ?? "" })));
    }
    if (suggestedTransport) setTransport(suggestedTransport);
    toast.success("Filled from venue details.");
  }

  return (
    <div className="space-y-4">
      {hasTravelSuggestion && (
        <button type="button" onClick={applyTravelSuggestion}
          className="w-full flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-left hover:bg-primary/10 transition-colors">
          <div>
            <p className="text-xs font-semibold text-primary">Fill from venue details</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {suggestedHotels.length > 0 ? `${suggestedHotels.length} hotel block${suggestedHotels.length === 1 ? "" : "s"}` : ""}
              {suggestedHotels.length > 0 && suggestedTransport ? " · " : ""}
              {suggestedTransport ? "Transportation notes" : ""}
            </p>
          </div>
          <span className="text-primary text-xs font-medium">Use →</span>
        </button>
      )}
      <TextareaField label="Travel message" value={message} onChange={setMessage} placeholder="We've reserved a room block at the Marriott. Use code CARTER2027 for 20% off." rows={2} />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hotel blocks</p>
        {hotels.map((h, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <input value={h.name} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, name: e.target.value } : it))} placeholder="Hotel name *" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={h.code} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, code: e.target.value } : it))} placeholder="Booking code" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              <input value={h.url} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, url: e.target.value } : it))} placeholder="Booking URL" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <input value={h.notes} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, notes: e.target.value } : it))} placeholder="Notes" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              <button type="button" onClick={() => setHotels(p => p.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setHotels(p => [...p, { name: "", url: "", code: "", notes: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add hotel block
        </button>
      </div>
      <TextareaField label="Transportation notes" value={transport} onChange={setTransport} placeholder="Shuttle buses will run from the Marriott every 30 minutes starting at 3:30 PM." rows={2} />
      <Actions onSave={() => onSave({ message, hotels: hotels.filter(h => h.name.trim()), transportation: { notes: transport } })} onCancel={onCancel} />
    </div>
  );
}

function DressCodeEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const dc = content.dress_code;
  const [formality, setFormality] = React.useState<string>(dc?.formality ?? "cocktail");
  const [description, setDescription] = React.useState(dc?.description ?? "");
  const [colorNote, setColorNote] = React.useState(dc?.colorNote ?? "");

  const LEVELS = [
    { value: "casual",       label: "Casual",        note: "Comfortable and relaxed" },
    { value: "smart_casual", label: "Smart Casual",  note: "Polished but not formal" },
    { value: "cocktail",     label: "Cocktail",      note: "Elegant party attire" },
    { value: "black_tie",    label: "Black Tie",     note: "Formal evening wear" },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground">Formality</p>
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map(l => (
            <button key={l.value} type="button" onClick={() => setFormality(l.value)}
              className={`rounded-xl border p-3 text-left transition-colors ${formality === l.value ? "ring-2 ring-ring ring-offset-1 border-ring" : "border-border"}`}>
              <p className="text-sm font-medium text-heading">{l.label}</p>
              <p className="text-[10px] text-muted-foreground">{l.note}</p>
            </button>
          ))}
        </div>
      </div>
      <TextareaField label="Description (optional)" value={description} onChange={setDescription} placeholder="We'd love for guests to dress in cocktail attire. Think elegant evening wear — the venue is beautiful and we want you to feel wonderful." rows={3} />
      <Field label="Color note (optional)" value={colorNote} onChange={setColorNote} placeholder="Feel free to wear blush, dusty rose, or sage green!" />
      <Actions onSave={() => onSave({ formality, description, colorNote })} onCancel={onCancel} />
    </div>
  );
}

function BridalPartyEditor({ content, onSave, onCancel, token }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void; token: string }) {
  const bp = content.bridal_party;
  const [title, setTitle] = React.useState(bp?.title ?? "Our Wedding Party");
  const [members, setMembers] = React.useState<{ name: string; role: string; note: string; photoUrl: string }[]>(
    bp?.members?.map(m => ({ name: m.name, role: m.role, note: m.note ?? "", photoUrl: m.photoUrl ?? "" })) ?? []
  );

  // Mirrors `members` synchronously (updated in the exact same place every
  // `setMembers` call is made, never inside a React updater callback) so
  // `setPhotoAndPersist` always has an accurate "latest members" value to
  // build its save payload from, without needing to read one back out of
  // React state. Plain state alone can't do this safely — see the note below.
  const membersRef = React.useRef(members);
  function add() { const next = [...membersRef.current, { name: "", role: "", note: "", photoUrl: "" }]; membersRef.current = next; setMembers(next); }
  function remove(i: number) { const next = membersRef.current.filter((_, j) => j !== i); membersRef.current = next; setMembers(next); }
  function set(i: number, k: string, v: string) { const next = membersRef.current.map((m, j) => j === i ? { ...m, [k]: v } : m); membersRef.current = next; setMembers(next); }

  // Upload-widgets-must-autosave (same bug class already fixed once in the
  // vendor logo uploader, 2026-07-23): the upload itself succeeds against
  // Supabase Storage immediately, but a handler that only does `set(...)`
  // stages the URL into this form's local state and nothing else — if
  // anything remounts this editor before the couple happens to press Save
  // below, the upload is silently lost even though the file object really
  // exists.
  //
  // Two bugs already found and fixed in earlier versions of this fix
  // (2026-08-04): (1) persisting from the `bp` prop — a stale snapshot from
  // whenever this editor mounted — let two uploads saved close together
  // clobber each other back to empty; (2) calling the persist fetch *inside*
  // a `setMembers` updater function violated React's rule that updater
  // functions must be pure — React (Strict Mode, concurrent rendering) can
  // invoke an updater more than once for a single state update, which fired
  // duplicate saves and produced the indefinite white-screen hang. Neither
  // problem exists with `membersRef`: it's read/written synchronously
  // in plain event-handler code, never inside React's own update machinery.
  async function persistMembers(nextMembers: typeof members) {
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, contentKey: "bridal_party", contentValue: { title, members: nextMembers } }),
      });
      const data = await res.json() as { ok?: boolean };
      if (!data.ok) toast.error("Photo uploaded, but couldn't save it yet — press Save below to keep it.");
    } catch {
      toast.error("Photo uploaded, but couldn't save it yet — press Save below to keep it.");
    }
  }
  // Only meaningful for a member that's already saved server-side — a
  // brand-new not-yet-saved person has nothing to attach the photo to
  // until the couple saves the person first (still stages into local
  // state via `set` either way, so the upload itself is never lost from
  // the UI, just not durable until the next explicit Save for that case).
  function setPhotoAndPersist(i: number, url: string) {
    const next = membersRef.current.map((m, j) => j === i ? { ...m, photoUrl: url } : m);
    membersRef.current = next;
    setMembers(next);
    if (bp?.members && i < bp.members.length) void persistMembers(next);
  }

  const COMMON_ROLES = ["Maid of Honor", "Best Man", "Bridesmaid", "Groomsman", "Flower Girl", "Ring Bearer", "Mother of the Bride", "Father of the Bride", "Officiant"];

  return (
    <div className="space-y-4">
      <Field label="Section title" value={title} onChange={setTitle} placeholder="Our Wedding Party" />
      <div className="space-y-3">
        {members.map((m, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-3">
              {/* Photo affordance — the data model has always carried
                  photoUrl (published portrait falls back to initials when
                  absent), but this editor never exposed a way to set it.
                  Reuses the same PhotoUpload pattern/endpoint as the cover
                  photo, just a different `type` prefix. */}
              <div className="shrink-0 w-16">
                {m.photoUrl ? (
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-muted">
                      <img src={m.photoUrl} alt={m.name || "Portrait"} className="w-full h-full object-cover" />
                    </div>
                    <button type="button" onClick={() => set(i, "photoUrl", "")}
                      className="absolute -top-1 -right-1 rounded-full bg-background border border-border p-0.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <PartyPhotoUpload token={token} onUploaded={url => setPhotoAndPersist(i, url)} />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input value={m.name} onChange={e => set(i, "name", e.target.value)} placeholder="Name *" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <select value={m.role} onChange={e => set(i, "role", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none text-muted-foreground">
                  <option value="">Role *</option>
                  {COMMON_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="custom">Other…</option>
                </select>
                {m.role === "custom" && (
                  <input value={m.role} onChange={e => set(i, "role", e.target.value)} placeholder="Custom role" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                )}
                <input value={m.note} onChange={e => set(i, "note", e.target.value)} placeholder="Fun fact or how you met (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                {!m.photoUrl && (
                  <p className="text-[11px] text-muted-foreground">Add a photo to make your wedding party feel more personal.</p>
                )}
              </div>
              <button type="button" onClick={() => remove(i)} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive mt-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add person
        </button>
      </div>
      <Actions onSave={() => onSave({ title, members: members.filter(m => m.name.trim()) })} onCancel={onCancel} />
    </div>
  );
}

// Compact variant of PhotoUpload — a small circular tap target instead of
// the full-width dashed dropzone, sized for a member row.
function PartyPhotoUpload({ token, onUploaded }: { token: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = React.useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("token", token); form.append("file", file); form.append("type", "party");
      const res = await fetch("/api/portal/upload", { method: "POST", body: form });
      const data = await res.json() as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) onUploaded(data.url);
      else toast.error(data.error ?? "Upload failed.");
    } catch { toast.error("Upload failed. Please try again."); }
    finally { setUploading(false); e.target.value = ""; }
  }

  return (
    <label className="flex flex-col items-center justify-center w-16 h-16 rounded-full border border-dashed border-border hover:bg-muted/40 cursor-pointer transition-colors">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Image className="h-4 w-4 text-muted-foreground" />}
      <input type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

function ThingsToDoEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const ttd = content.things_to_do;
  const [title, setTitle] = React.useState(ttd?.title ?? "Things To Do");
  const [intro, setIntro] = React.useState(ttd?.intro ?? "");
  const [items, setItems] = React.useState<{ name: string; category: string; description: string; address: string; url: string }[]>(
    ttd?.items?.map(it => ({ name: it.name, category: it.category, description: it.description ?? "", address: it.address ?? "", url: it.url ?? "" })) ?? []
  );

  const CATEGORIES = [
    { value: "restaurant", label: "🍽 Restaurant" },
    { value: "cafe",       label: "☕ Café" },
    { value: "attraction", label: "🗺 Attraction" },
    { value: "hotel",      label: "🏨 Hotel" },
    { value: "shopping",   label: "🛍 Shopping" },
    { value: "other",      label: "✦ Other" },
  ];

  function add() { setItems(p => [...p, { name: "", category: "restaurant", description: "", address: "", url: "" }]); }
  function remove(i: number) { setItems(p => p.filter((_, j) => j !== i)); }
  function set(i: number, k: string, v: string) { setItems(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it)); }

  return (
    <div className="space-y-4">
      <Field label="Section title" value={title} onChange={setTitle} placeholder="Things To Do" />
      <TextareaField label="Intro message (optional)" value={intro} onChange={setIntro} placeholder="Nashville has so much to offer! Here are a few of our favorite spots near the venue." rows={2} />
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input value={item.name} onChange={e => set(i, "name", e.target.value)} placeholder="Name *" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                  <select value={item.category} onChange={e => set(i, "category", e.target.value)} className="w-36 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:outline-none">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <input value={item.description} onChange={e => set(i, "description", e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={item.address} onChange={e => set(i, "address", e.target.value)} placeholder="Address" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                  <input value={item.url} onChange={e => set(i, "url", e.target.value)} placeholder="Website URL" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <button type="button" onClick={() => remove(i)} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive mt-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add recommendation
        </button>
      </div>
      <Actions onSave={() => onSave({ title, intro, items: items.filter(it => it.name.trim()) })} onCancel={onCancel} />
    </div>
  );
}

function MusicEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const m = content.music;
  const [title, setTitle] = React.useState(m?.title ?? "Our Music");
  const [ceremony, setCeremony] = React.useState(m?.ceremony ?? "");
  const [cocktail, setCocktail] = React.useState(m?.cocktail ?? "");
  const [reception, setReception] = React.useState(m?.reception ?? "");
  const [lastDance, setLastDance] = React.useState(m?.lastDance ?? "");
  const [doNotPlay, setDoNotPlay] = React.useState(m?.doNotPlay ?? "");
  return (
    <div className="space-y-3">
      <Field label="Section title" value={title} onChange={setTitle} placeholder="Our Music" />
      <Field label="🎵 Ceremony song" value={ceremony} onChange={setCeremony} placeholder="Canon in D — Pachelbel" />
      <Field label="🥂 Cocktail hour vibe" value={cocktail} onChange={setCocktail} placeholder="Acoustic jazz, soft indie" />
      <Field label="🎉 First dance song" value={reception} onChange={setReception} placeholder="Can't Help Falling in Love — Elvis" />
      <Field label="🌟 Last dance song" value={lastDance} onChange={setLastDance} placeholder="September — Earth, Wind & Fire" />
      <Field label="🚫 Please don't play" value={doNotPlay} onChange={setDoNotPlay} placeholder="Any song by that one ex (you know who)" />
      <Actions onSave={() => onSave({ title, ceremony, cocktail, reception, lastDance, doNotPlay })} onCancel={onCancel} />
    </div>
  );
}

function RegistryEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const [items, setItems] = React.useState<{ name: string; url: string; notes: string }[]>(
    content.registry?.map(r => ({ name: r.name, url: r.url, notes: r.notes ?? "" })) ?? []
  );
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex-1 space-y-2">
            <input value={item.name} onChange={e => setItems(p => p.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} placeholder="Registry name (e.g., Crate & Barrel)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
            <input value={item.url} onChange={e => setItems(p => p.map((r, j) => j === i ? { ...r, url: e.target.value } : r))} placeholder="URL" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
          </div>
          <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => setItems(p => [...p, { name: "", url: "", notes: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add registry
      </button>
      <Actions onSave={() => onSave(items.filter(i => i.name.trim() && i.url.trim()))} onCancel={onCancel} />
    </div>
  );
}

function FaqEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const [items, setItems] = React.useState<{ question: string; answer: string }[]>(content.faq ?? []);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <input value={item.question} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, question: e.target.value } : it))} placeholder="Question" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              <textarea value={item.answer} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, answer: e.target.value } : it))} placeholder="Answer" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none resize-none" />
            </div>
            <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive mt-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setItems(p => [...p, { question: "", answer: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add FAQ
      </button>
      <Actions onSave={() => onSave(items.filter(i => i.question.trim()))} onCancel={onCancel} />
    </div>
  );
}

// ── Section accordion ─────────────────────────────────────────────────────────

function SectionAccordion({
  section, content, onSaveSection, saving, token, scheduleSync, onToggleSync,
  onMoveUp, onMoveDown, isFirst, isLast, suggestions, forceOpen,
  lastSyncedAt, onRefreshSuggestions, onSectionSynced,
}: {
  section: SectionDef;
  content: WebsiteContent;
  onSaveSection: (key: string, value: object) => Promise<void>;
  saving: string | null;
  token: string;
  scheduleSync?: boolean;
  onToggleSync?: (v: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  suggestions?: WebsiteSuggestions | null;
  forceOpen?: boolean;
  lastSyncedAt?: string | null;
  onRefreshSuggestions?: () => Promise<WebsiteSuggestions | null>;
  onSectionSynced?: (sectionKey: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const accordionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (forceOpen && !open) {
      setOpen(true);
      setTimeout(() => accordionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);
  const previewText = section.preview?.(content);
  const hasContent = !!previewText;

  // Show a "✦ Ready to sync" hint when suggestions are available and section is empty
  const hasSuggestion =
    !hasContent && (
      (section.key === "story"  && !!suggestions?.story?.text) ||
      (section.key === "home"   && (!!suggestions?.coupleNames || (suggestions?.engagementPhotos?.length ?? 0) > 0)) ||
      (section.key === "event"  && !!suggestions?.venue?.name) ||
      (section.key === "travel" && !!suggestions?.travel)
    );

  function EditorFor() {
    const props = {
      content,
      onSave: async (v: object) => { await onSaveSection(section.key, v); setOpen(false); },
      onCancel: () => setOpen(false),
    };
    switch (section.key) {
      case "home":         return <HomeEditor {...props} token={token} suggestions={suggestions}
                                     lastSyncedAt={lastSyncedAt} onRefresh={onRefreshSuggestions}
                                     onSynced={() => onSectionSynced?.("home")} />;
      case "story":        return <StoryEditor {...props} token={token} suggestions={suggestions}
                                     lastSyncedAt={lastSyncedAt} onRefresh={onRefreshSuggestions}
                                     onSynced={() => onSectionSynced?.("story")} />;
      case "event":        return <EventEditor {...props} suggestions={suggestions} />;
      case "gallery":      return <GalleryEditor {...props} token={token} />;
      case "schedule":     return <ScheduleEditor {...props} token={token} scheduleSync={scheduleSync} onToggleSync={onToggleSync} />;
      case "travel":       return <TravelEditor {...props} suggestions={suggestions} />;
      case "dress_code":   return <DressCodeEditor {...props} />;
      case "bridal_party": return <BridalPartyEditor {...props} token={token} />;
      case "things_to_do": return <ThingsToDoEditor {...props} />;
      case "music":        return <MusicEditor {...props} />;
      case "registry":     return <RegistryEditor {...props} />;
      case "faq":          return <FaqEditor {...props} />;
      default:             return null;
    }
  }

  return (
    <div ref={accordionRef} className={`rounded-2xl border transition-colors ${open ? "border-ring bg-card" : "border-border bg-card"}`}>
      <div className="flex items-center">
        {/* Order controls */}
        <div className="flex flex-col pl-2 py-1 gap-0.5 shrink-0">
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ArrowUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        {/* Main accordion button */}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 px-3 py-3.5 text-left min-w-0">
          <span className="text-lg shrink-0">{section.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-heading">{section.title}</p>
              {hasContent ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">✓ Added</span>
              ) : hasSuggestion ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">✦ Ready to sync</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Tap to add</span>
              )}
              {saving === section.key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {hasContent && !open && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{previewText}</p>
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-border/50 pt-4">
          <p className="text-xs text-muted-foreground mb-3">{section.description}</p>
          <EditorFor />
        </div>
      )}
    </div>
  );
}

// ── Completion meter ──────────────────────────────────────────────────────────

function CompletionMeter({ completed, total, syncableSections }: {
  completed: number; total: number; syncableSections: number;
}) {
  const pct = Math.round((completed / total) * 100);

  const { emoji, headline, sub } = React.useMemo(() => {
    if (completed === 0 && syncableSections > 0)
      return { emoji: "✨", headline: "Your website is already taking shape", sub: `We found ${syncableSections} section${syncableSections === 1 ? "" : "s"} ready to sync from your profile.` };
    if (completed === 0)
      return { emoji: "🌿", headline: "Start building your website", sub: "Choose a theme and start adding your story." };
    if (pct < 30)
      return { emoji: "✨", headline: "Off to a beautiful start", sub: `${completed} of ${total} sections added.` };
    if (pct < 60)
      return { emoji: "💗", headline: `Your website is ${pct}% ready`, sub: `${total - completed} section${total - completed === 1 ? "" : "s"} left to add.` };
    if (pct < 85)
      return { emoji: "🌿", headline: "Looking beautiful", sub: `Almost there — ${total - completed} more section${total - completed === 1 ? "" : "s"} to go.` };
    if (completed < total)
      return { emoji: "✦", headline: "Nearly perfect", sub: `Just ${total - completed} section${total - completed === 1 ? "" : "s"} left. You've got this.` };
    return { emoji: "🎉", headline: "Your website is complete!", sub: "Every section is filled. Ready to share with guests." };
  }, [completed, total, pct, syncableSections]);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-heading">{headline}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
        {completed > 0 && (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">
            {completed}/{total}
          </span>
        )}
      </div>
      {completed > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? "var(--venue-primary)" : "linear-gradient(90deg, var(--venue-primary), #D8A7AA)" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Theme Studio — replaces the old Appearance accordion ─────────────────────

// Four independent dimensions (2026-07-24) — each patch below fires
// immediately via onUpdate → updateAppearance, so every one of these is a
// real live save, not just local preview state.
type ThemePatch = Partial<CoupleWebsite & { fontPairing: string; clearCustomColors: boolean }>;

const COLOR_ROLES: { key: "colorPrimary" | "colorSecondary" | "colorAccent" | "colorNeutral" | "colorBackground" | "colorText"; label: string; hint: string }[] = [
  { key: "colorPrimary",    label: "Primary",    hint: "Buttons, RSVP, hero accents" },
  { key: "colorSecondary",  label: "Secondary",  hint: "Joins Primary in gradients" },
  { key: "colorAccent",     label: "Accent",     hint: "Dividers, icons, small details" },
  { key: "colorNeutral",    label: "Neutral",    hint: "Borders and hairlines" },
  { key: "colorBackground", label: "Background", hint: "Page background" },
  { key: "colorText",       label: "Text",       hint: "Body copy color" },
];

function DimensionCard({ eyebrow, title, subtitle, swatch, isOpen, onToggle, children }: {
  eyebrow: string; title: string; subtitle?: string | null;
  swatch: React.ReactNode; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border transition-colors overflow-hidden ${isOpen ? "border-ring bg-card" : "border-border bg-card"}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-4 p-4 text-left group">
        {swatch}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          <p className="text-sm font-semibold text-heading truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">{subtitle}</p>}
        </div>
        <p className="text-xs font-medium shrink-0 text-primary">{isOpen ? "Close" : "Change →"}</p>
      </button>
      {isOpen && <div className="border-t border-border/50 p-4 space-y-4">{children}</div>}
    </div>
  );
}

// The Theme Studio — four fully independent pickers, catalog-driven end to
// end (Part 1–4): Layout Collection, Color Story (curated quick-start +
// full custom 6-color picker, reusing the exact venue ColorPickerTrigger),
// Typography, Photo Style. Choosing one never changes another.
function ThemeStudio({ site, onUpdate }: { site: CoupleWebsite; onUpdate: (patch: ThemePatch) => void }) {
  const [open, setOpen] = React.useState<"collection" | "color" | "typography" | "photo" | null>(null);
  const [catalog, setCatalog] = React.useState<HostedExperienceCatalog | null>(null);
  React.useEffect(() => {
    fetch("/api/portal/website/catalog").then(r => r.json()).then(setCatalog).catch(() => {});
  }, []);

  // Theme Studio Preview Polish (2026-08-14) — the Typography row's own
  // closed swatch now renders a real font sample (not just "Aa" in the
  // fallback font), which means it needs that font actually loaded even
  // while collapsed — same real gap the Wizard's own Typography step had
  // before its font-preloading fix. Always load the current selection's
  // font; additionally load every option's font while the picker itself is
  // open, so the full comparison grid below also shows real fonts.
  const currentTypographyId = site.typographyStyleId;
  React.useEffect(() => {
    if (!catalog?.typographyStyles?.length) return;
    const current = catalog.typographyStyles.find(t => t.id === currentTypographyId)
      ?? catalog.typographyStyles.find(t => t.key === (site.fontPairing ?? "classic_serif"));
    const urls = Array.from(new Set(
      (open === "typography" ? catalog.typographyStyles : (current ? [current] : []))
        .map(t => t.tokens.fontUrl).filter((u): u is string => !!u)
    ));
    const links = urls.map(url => {
      const link = document.createElement("link");
      link.rel = "stylesheet"; link.href = url;
      link.setAttribute("data-wevenu-typography-preview", "1");
      document.head.appendChild(link);
      return link;
    });
    return () => { links.forEach(l => l.remove()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog?.typographyStyles, currentTypographyId, site.fontPairing, open]);

  if (!catalog) {
    return <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">Loading design options…</div>;
  }

  const collections = catalog.collections;
  const currentCollection = collections.find(c => c.id === site.collectionId)
    ?? collections.find(c => c.key === (site.theme ?? "classic")) ?? collections[0];
  // Studio Canonical State Pass (2026-08-11) — one resolver, not a local
  // re-derivation (see lib/wedding-website/design-state.ts for why the old
  // `currentCollection?.colorStories.find(...)` scoping and raw-hex-
  // presence `hasCustomColors` check were both wrong).
  const { colorStory: currentColorStory, isCustomColors: hasCustomColors } = resolveDesignState(site, catalog);
  const currentTypography = catalog.typographyStyles.find(t => t.id === site.typographyStyleId)
    ?? catalog.typographyStyles.find(t => t.key === (site.fontPairing ?? "classic_serif"));
  const currentPhotoStyle = catalog.photoStyles.find(p => p.id === site.photoStyleId);

  // Theme Studio Preview Polish (2026-08-14) — the six roles actually
  // driving the site right now (curated story if one's selected and
  // untouched, else the couple's own custom values), and the same real
  // photo/title/subtitle the public Hero itself reads — shared by the
  // Collection, Color Story, and Typography swatches below so all three
  // (and the real website) always agree, never a second approximation.
  const displayRoles: SixRoleColors = currentColorStory
    ? deriveSixRoles(currentColorStory.tokens)
    : {
        colorPrimary: site.colorPrimary || "#DDD6C9", colorSecondary: site.colorSecondary || "#DDD6C9",
        colorAccent: site.colorAccent || "#DDD6C9", colorNeutral: site.colorNeutral || "#DDD6C9",
        colorBackground: site.colorBackground || "#DDD6C9", colorText: site.colorText || "#DDD6C9",
      };
  const previewPhoto = site.content?.home?.coverImageUrl || undefined;
  const previewCoupleName = site.content?.home?.title || "Your Names";
  const previewGalleryPhotos = resolveStudioPreviewPhotos({
    galleryPhotos: site.content?.gallery?.photos,
    coverPhoto: previewPhoto,
  });
  const previewBase: PublicWebsite = { content: site.content, colorPrimary: site.colorPrimary, colorSecondary: site.colorSecondary,
    colorAccent: site.colorAccent, colorNeutral: site.colorNeutral, colorBackground: site.colorBackground, colorText: site.colorText };

  function clearColors(): ThemePatch {
    return { clearCustomColors: true, colorPrimary: null, colorSecondary: null, colorAccent: null, colorNeutral: null, colorBackground: null, colorText: null };
  }

  return (
    <div className="space-y-3">

      {/* ── Part 1: Layout Collection ── */}
      <DimensionCard
        eyebrow="Layout Collection" title={currentCollection?.name ?? "Choose a collection"}
        subtitle={currentCollection?.description}
        swatch={
          <div key={`${currentCollection?.id}-${displayRoles.colorPrimary}-${currentTypography?.id}`}
            className="h-14 w-20 rounded-xl shrink-0 overflow-hidden animate-in fade-in duration-300">
            {currentCollection ? (
              <CollectionPreview base={previewBase} collection={currentCollection} colorStory={currentColorStory} typography={currentTypography} width={80} height={56} />
            ) : <div className="w-full h-full bg-muted" />}
          </div>
        }
        isOpen={open === "collection"} onToggle={() => setOpen(o => o === "collection" ? null : "collection")}
      >
        <p className="text-[11px] text-muted-foreground -mt-1">
          How your whole website feels — opening moment, section composition, type hierarchy, spacing, and the way your story unfolds. Not just colors.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {collections.map(c => {
            const isSelected = c.id === currentCollection?.id;
            return (
              <button key={c.id} type="button"
                onClick={() => {
                  // First-time pick of a collection also seeds its own
                  // default Color Story / Typography as a starting point —
                  // never overwrites a couple's own choice once one exists.
                  const patch: ThemePatch = { theme: c.key as CoupleWebsite["theme"], collectionId: c.id };
                  if (!site.colorStoryId && !hasCustomColors && c.colorStories[0]) {
                    const roles = deriveSixRoles(c.colorStories[0].tokens);
                    patch.themePalette = c.colorStories[0].name;
                    patch.colorStoryId = c.colorStories[0].id;
                    patch.colorPrimary = roles.colorPrimary; patch.colorSecondary = roles.colorSecondary;
                    patch.colorAccent = roles.colorAccent; patch.colorNeutral = roles.colorNeutral;
                    patch.colorBackground = roles.colorBackground; patch.colorText = roles.colorText;
                  }
                  onUpdate(patch);
                }}
                className={`relative rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-offset-2 ring-ring" : ""}`}>
                <div className="relative overflow-hidden" style={{ height: 248 }}>
                  <CollectionPreview
                    base={previewBase}
                    collection={c}
                    colorStory={c.colorStories[0]}
                    sectionKeys={["story"]}
                    width={170}
                    height={248}
                    heroFraction={0.38}
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <Check className="h-3 w-3 text-foreground" />
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 bg-card">
                  <p className="text-xs font-bold text-heading">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{collectionDescriptor(c.key, c.description)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DimensionCard>

      {/* ── Part 2: Color Story ── */}
      <DimensionCard
        eyebrow="Color Story" title={hasCustomColors ? "Custom colors" : (currentColorStory?.name ?? "Choose your colors")}
        subtitle={hasCustomColors ? "Your own palette" : "Tap to customize every color"}
        swatch={
          <div key={`${currentColorStory?.id}-${displayRoles.colorPrimary}`}
            className="h-14 w-20 rounded-xl shrink-0 overflow-hidden animate-in fade-in duration-300">
            <ColorStoryPreview base={previewBase} />
          </div>
        }
        isOpen={open === "color"} onToggle={() => setOpen(o => o === "color" ? null : "color")}
      >
        {currentCollection && currentCollection.colorStories.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick start · {currentCollection.name}</p>
            <div className="flex gap-3">
              {currentCollection.colorStories.map(cs => {
                const isActive = !hasCustomColors && cs.id === site.colorStoryId;
                return (
                  <button key={cs.id} type="button"
                    onClick={() => {
                      // Studio Canonical State Pass (2026-08-11) — must set
                      // BOTH colorStoryId (so every summary can name this
                      // story after reload) AND the six raw hex columns
                      // (the real renderer reads those directly, never
                      // colorStoryId — see resolveTheme). Previously this
                      // set colorStoryId but nulled the six columns via
                      // clearColors(), so the curated pick never actually
                      // reached the real website.
                      const roles = deriveSixRoles(cs.tokens);
                      onUpdate({
                        colorStoryId: cs.id, themePalette: cs.name, clearCustomColors: false,
                        colorPrimary: roles.colorPrimary, colorSecondary: roles.colorSecondary, colorAccent: roles.colorAccent,
                        colorNeutral: roles.colorNeutral, colorBackground: roles.colorBackground, colorText: roles.colorText,
                      });
                    }}
                    className="flex flex-col items-center gap-1.5">
                    <div className={`rounded-full border-2 transition-all ${isActive ? "h-10 w-10 border-foreground shadow-md" : "h-8 w-8 border-transparent hover:border-border"}`}
                      style={{ background: swatchGradient(cs.tokens) }} />
                    <p className={`text-[10px] ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{cs.name}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Custom colors</p>
            {hasCustomColors && (
              <button type="button" onClick={() => onUpdate(clearColors())} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                Reset to preset
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">Any color set here overrides the preset — reused across the entire website: buttons, backgrounds, highlights, icons, links, RSVP, dividers, cards.</p>
          <div className="grid grid-cols-2 gap-2.5">
            {(() => {
              // Studio Canonical State Pass (2026-08-11) — this used to
              // fall back to one hardcoded "#BF9089" for colorPrimary,
              // colorSecondary, AND colorNeutral alike (only colorAccent/
              // colorBackground/colorText had their own real fallback),
              // which is exactly how a couple could see all six roles
              // collapse to the same value: the moment currentColorStory
              // failed to resolve (the collection-scoping bug above), every
              // role missing its own raw column landed on that one shared
              // literal. Each role now gets its own real fallback, derived
              // from the correctly-resolved current Color Story.
              const seeded = currentColorStory ? deriveSixRoles(currentColorStory.tokens) : null;
              return COLOR_ROLES.map(r => (
                <div key={r.key} className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground" title={r.hint}>{r.label}</p>
                  <ColorPickerTrigger
                    value={(site[r.key] as string | undefined) || seeded?.[r.key] || "#BF9089"}
                    onChange={(v) => {
                      // Editing any single role diverges from the curated
                      // story, if one was active — clear colorStoryId so
                      // every surface reads this as a custom palette.
                      onUpdate({ [r.key]: v, colorStoryId: null });
                    }}
                  />
                </div>
              ));
            })()}
          </div>
        </div>
      </DimensionCard>

      {/* ── Part 3: Typography ── */}
      <DimensionCard
        eyebrow="Typography" title={currentTypography?.name ?? "Choose your typography"}
        subtitle={currentTypography?.tokens.sampleLabel}
        swatch={
          <div key={currentTypography?.id} className="h-14 w-20 rounded-xl shrink-0 bg-muted overflow-hidden animate-in fade-in duration-300">
            {currentTypography ? (
              <TypographyPreview typography={currentTypography} coupleName={previewCoupleName} tagline={site.content?.home?.subtitle} nameSize={10} taglineSize={6.5} />
            ) : <div className="w-full h-full bg-muted" />}
          </div>
        }
        isOpen={open === "typography"} onToggle={() => setOpen(o => o === "typography" ? null : "typography")}
      >
        <p className="text-[11px] text-muted-foreground -mt-1">Independent of Collection — affects headings, subheadings, body, quotes, buttons, and navigation throughout the entire website.</p>
        <div className="grid grid-cols-2 gap-2">
          {catalog.typographyStyles.map(t => {
            const isSelected = t.id === currentTypography?.id;
            return (
              <button key={t.id} type="button"
                onClick={() => onUpdate({ fontPairing: t.key as CoupleWebsite["fontPairing"], typographyStyleId: t.id })}
                className={`rounded-xl border p-3 text-left transition-all ${isSelected ? "ring-2 ring-ring ring-offset-1 border-ring" : "border-border"}`}>
                <div className="h-6">
                  <TypographyPreview typography={t} coupleName={previewCoupleName} showTagline={false} nameSize={15} align="left" />
                </div>
                <p className="text-[10px] font-semibold text-heading mt-1.5">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{t.tokens.sampleLabel}</p>
              </button>
            );
          })}
        </div>
      </DimensionCard>

      {/* ── Part 4: Photo Style ── */}
      <DimensionCard
        eyebrow="Photo Style" title={currentPhotoStyle?.name ?? "Choose your photo style"}
        subtitle={currentPhotoStyle?.description}
        swatch={
          <div key={currentPhotoStyle?.id} className="h-14 w-20 rounded-xl shrink-0 overflow-hidden bg-[#FAF8F4] animate-in fade-in duration-300">
            {currentPhotoStyle && currentCollection ? (
              <PhotoStylePreview collection={currentCollection} photoStyle={currentPhotoStyle} photos={previewGalleryPhotos} width={80} height={56} />
            ) : <div className="w-full h-full bg-muted" />}
          </div>
        }
        isOpen={open === "photo"} onToggle={() => setOpen(o => o === "photo" ? null : "photo")}
      >
        <p className="text-[11px] text-muted-foreground -mt-1">How your photographs are framed, layered, spaced, and filtered — independent of Collection, Color Story, and Typography.</p>
        <div className="grid grid-cols-2 gap-2">
          {catalog.photoStyles.map(p => {
            const isSelected = p.id === currentPhotoStyle?.id;
            return (
              <button key={p.id} type="button" onClick={() => onUpdate({ photoStyleId: p.id })}
                className={`rounded-xl border overflow-hidden text-left transition-all flex flex-col ${isSelected ? "ring-2 ring-ring ring-offset-1 border-ring" : "border-border"}`}>
                {/* Specimen region — height must equal PhotoStylePreview height so the
                    ScaledThumbnail never paints into the reserved label footer. */}
                <div className="h-[180px] shrink-0 overflow-hidden bg-[#FAF8F4]">
                  {currentCollection && <PhotoStylePreview collection={currentCollection} photoStyle={p} photos={previewGalleryPhotos} width={170} height={180} naturalWidth={480} />}
                </div>
                <div className="px-3 py-2 bg-card border-t border-border/50 shrink-0 min-h-[3.25rem]">
                  <p className="text-xs font-semibold text-heading line-clamp-1">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DimensionCard>

    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function WebsiteEditor({
  token, initialSite, origin, initialGuests,
  onSectionSaved, onAppearanceChanged, focusSection, hideStatusHeader,
}: {
  token: string;
  initialSite: CoupleWebsite;
  origin: string;
  initialGuests?: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[];
  // Studio mode hooks — used by WebsiteStudio to keep preview in sync
  onSectionSaved?: (key: string, value: object) => void;
  onAppearanceChanged?: (patch: Partial<CoupleWebsite & { fontPairing: string; clearCustomColors: boolean }>) => void;
  focusSection?: string | null;
  hideStatusHeader?: boolean;
}) {
  const [site, setSite] = React.useState(initialSite);
  const [content, setContent] = React.useState<WebsiteContent>(initialSite.content ?? {});

  // Studio Canonical State Pass (2026-08-11) — `site` above is seeded once
  // from `initialSite` and otherwise self-managed, which is correct for
  // fields only this component owns (isPublished, hasPendingChanges, …).
  // But the couple's four design dimensions can ALSO be saved by the
  // sibling SetupWizard (WebsiteStudio renders both at once), which
  // updates the parent's own copy directly without this component ever
  // knowing — so ThemeStudio below kept showing whatever was selected
  // before the wizard ran, stale until a full page reload. Re-sync just
  // those fields whenever the parent's copy of them changes; every other
  // locally-owned field is left alone.
  React.useEffect(() => {
    setSite(s => ({
      ...s,
      theme: initialSite.theme, collectionId: initialSite.collectionId, colorStoryId: initialSite.colorStoryId,
      themePalette: initialSite.themePalette, fontPairing: initialSite.fontPairing,
      typographyStyleId: initialSite.typographyStyleId, photoStyleId: initialSite.photoStyleId,
      colorPrimary: initialSite.colorPrimary, colorSecondary: initialSite.colorSecondary, colorAccent: initialSite.colorAccent,
      colorNeutral: initialSite.colorNeutral, colorBackground: initialSite.colorBackground, colorText: initialSite.colorText,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialSite.theme, initialSite.collectionId, initialSite.colorStoryId, initialSite.themePalette,
    initialSite.fontPairing, initialSite.typographyStyleId, initialSite.photoStyleId,
    initialSite.colorPrimary, initialSite.colorSecondary, initialSite.colorAccent,
    initialSite.colorNeutral, initialSite.colorBackground, initialSite.colorText,
  ]);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<"desktop" | "mobile">("mobile");
  const [showPreview, setShowPreview] = React.useState(false);
  const [showQR, setShowQR] = React.useState(false);
  const [scheduleSync, setScheduleSync] = React.useState(
    (initialSite as CoupleWebsite & { scheduleSync?: boolean }).scheduleSync !== false
  );
  const [showInvite, setShowInvite] = React.useState(false);
  const [selectedGuests, setSelectedGuests] = React.useState<string[]>([]);
  const [sendingInvites, setSendingInvites] = React.useState(false);
  const [views, setViews] = React.useState<{ totalViews: number; weekViews: number } | null>(null);
  const [nudges, setNudges] = React.useState<{ id: string; sectionKey: string; changeSummary: string; detectedAt: string; notifiedAt: string | null }[]>([]);
  const [notifyingNudge, setNotifyingNudge] = React.useState<string | null>(null);

  // Pre-population suggestions — fetched once on mount
  const [suggestions, setSuggestions] = React.useState<WebsiteSuggestions | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = React.useState(false);

  // Section order state — initialize from site or use default
  const [sectionOrder, setSectionOrder] = React.useState<string[]>(
    initialSite.sectionOrder?.length ? initialSite.sectionOrder : DEFAULT_SECTION_ORDER
  );

  const guests = initialGuests ?? [];
  const websiteUrl = site.slug ? `${origin}/w/${site.slug}` : null;
  // Preview-only: get_wedding_website 404s an unpublished site unless the
  // request carries its own preview_token — the normal state while a
  // couple is still building, since nothing requires them to publish
  // first. websiteUrl itself stays the clean, tokenless link everywhere
  // it's meant for guests (Copy link, Share via email, RSVP link, QR
  // code) — an unpublished site correctly should NOT open for a guest
  // holding that link (2026-07-23: confirmed real bug — the preview
  // iframe and "Open full site" link were using the guest-facing URL and
  // 404ing for exactly this reason).
  const previewUrl = websiteUrl ? (site.previewToken ? `${websiteUrl}?preview=${site.previewToken}` : websiteUrl) : undefined;
  const completedSections = ALL_SECTIONS.filter(s => s.preview?.(content)).length;

  React.useEffect(() => {
    fetch(`/api/portal/website/suggestions?token=${token}`)
      .then(r => r.json())
      .then((d: WebsiteSuggestions | null) => setSuggestions(d))
      .catch(() => {});
  }, [token]);

  // Hosted Experience Platform Phase 5 — explicit Refresh for guided
  // sections (home/story): re-pulls the current source value rather than
  // relying on the once-on-mount fetch above, so "Refresh" actually
  // reflects what's in Planning right now.
  async function refreshSuggestions(): Promise<WebsiteSuggestions | null> {
    const res = await fetch(`/api/portal/website/suggestions?token=${token}`);
    const d = await res.json() as WebsiteSuggestions | null;
    setSuggestions(d);
    return d;
  }

  async function markSectionSynced(sectionKey: string) {
    await fetch("/api/portal/website/sync-section", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, sectionKey }),
    }).catch(() => {});
  }

  React.useEffect(() => {
    if (!site.isPublished) return;
    fetch(`/api/portal/website/analytics?token=${token}`)
      .then(r => r.json())
      .then((d: { totalViews?: number; weekViews?: number }) => {
        if (d.totalViews !== undefined) setViews({ totalViews: d.totalViews, weekViews: d.weekViews ?? 0 });
      })
      .catch(() => {});
  }, [token, site.isPublished]);

  // Hosted Experience Platform Phase 5 — a live-synced source (Schedule)
  // changed after publish; nudge the couple to let already-RSVP'd guests
  // know, rather than leaving them to discover the change on their own.
  React.useEffect(() => {
    if (!site.isPublished) return;
    fetch(`/api/portal/website/change-nudges?token=${token}`)
      .then(r => r.json())
      .then((d: { nudges?: typeof nudges }) => setNudges(d.nudges ?? []))
      .catch(() => {});
  }, [token, site.isPublished]);

  async function dismissNudge(nudgeId: string) {
    setNudges(n => n.filter(x => x.id !== nudgeId));
    await fetch("/api/portal/website/change-nudges", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, nudgeId }),
    });
  }

  async function notifyGuestsOfChange(nudgeId: string) {
    const alreadyResponded = guests.filter(g => g.rsvpStatus !== "pending" && g.email);
    if (!alreadyResponded.length) {
      toast.info("No RSVP'd guests with email addresses to notify.");
      await dismissNudge(nudgeId);
      return;
    }
    setNotifyingNudge(nudgeId);
    try {
      const res = await fetch("/api/portal/invite", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, guestIds: alreadyResponded.map(g => g.id), emailType: "update" }),
      });
      const data = await res.json() as { ok: boolean; sent?: number };
      if (data.ok) {
        toast.success(`Update sent to ${data.sent ?? alreadyResponded.length} guest${alreadyResponded.length !== 1 ? "s" : ""}.`);
        setNudges(n => n.filter(x => x.id !== nudgeId));
        await fetch("/api/portal/website/change-nudges", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, nudgeId, notified: true }),
        });
      } else toast.error("Could not send the update. Please try again.");
    } finally { setNotifyingNudge(null); }
  }

  // How many sections have ready-to-sync suggestions
  const syncableSections = suggestions
    ? [
        suggestions.story?.text               && "story",
        (suggestions.coupleNames || (suggestions.engagementPhotos?.length ?? 0) > 0) && "home",
        suggestions.venue?.name               && "event",
        suggestions.travel                    && "travel",
      ].filter(Boolean).length
    : 0;

  async function saveSection(key: string, value: object) {
    setSaving(key);
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, contentKey: key, contentValue: value }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setContent(c => ({ ...c, [key]: value }));
        onSectionSaved?.(key, value);
        toast.success(`${ALL_SECTIONS.find(s => s.key === key)?.title ?? "Section"} saved.`);
      } else toast.error("Could not save. Please try again.");
    } finally { setSaving(null); }
  }

  async function saveSectionOrder(order: string[]) {
    setSectionOrder(order);
    await fetch("/api/portal/website", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, sectionOrder: order }),
    });
  }

  function moveSection(key: string, dir: "up" | "down") {
    const idx = sectionOrder.indexOf(key);
    if (idx < 0) return;
    const next = [...sectionOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    saveSectionOrder(next);
  }

  async function updateAppearance(patch: Partial<CoupleWebsite & { fontPairing: string; clearCustomColors: boolean }>) {
    setSaving("appearance");
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...patch }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setSite(s => ({ ...s, ...patch, hasPendingChanges: s.isPublished ? true : s.hasPendingChanges }));
        onAppearanceChanged?.(patch);
        toast.success("Design updated.");
      }
    } finally { setSaving(null); }
  }

  async function togglePublish() {
    setPublishing(true);
    const next = !site.isPublished;
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, isPublished: next }),
      });
      const data = await res.json() as { ok: boolean; celebrated?: boolean };
      if (data.ok) {
        setSite(s => ({ ...s, isPublished: next, status: next ? "published" : "draft", hasPendingChanges: false }));
        if (next && data.celebrated) {
          celebrateLuv(coupleCelebrationMessage("website_published"));
        } else {
          toast.success(next ? "Your website is live!" : "Website set to draft.");
        }
      }
    } finally { setPublishing(false); }
  }

  // Publishing is a commitment, not a save (Hosted Experience Platform
  // Phase 3) — edits made after the first publish land in the draft only;
  // guests keep seeing the version frozen at the last publish until this
  // is called again. Always sends isPublished: true, even though the site
  // is already published, since that's what makes update_my_website write
  // a new experience_versions snapshot and move guests onto the latest draft.
  async function publishUpdates() {
    setPublishing(true);
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, isPublished: true }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setSite(s => ({ ...s, hasPendingChanges: false }));
        toast.success("Updates are live.");
      }
    } finally { setPublishing(false); }
  }

  // Ordered sections for rendering
  const orderedSections = React.useMemo(() => {
    return sectionOrder
      .map(key => ALL_SECTIONS.find(s => s.key === key))
      .filter((s): s is SectionDef => s != null);
  }, [sectionOrder]);

  return (
    <div className="space-y-4">

      {/* ── Status header ── */}
      {!hideStatusHeader && <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {site.isPublished ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <div>
                <p className="text-sm font-semibold text-heading">Your wedding website is live!</p>
                <p className="text-xs text-muted-foreground">Share the link with your guests.</p>
              </div>
            </div>
            {websiteUrl && (
              <div className="flex gap-2">
                <div className="flex-1 bg-muted/40 rounded-xl px-3 py-2 text-[11px] font-mono text-muted-foreground truncate">{websiteUrl}</div>
                <button type="button" onClick={() => { navigator.clipboard.writeText(websiteUrl); toast.success("Link copied!"); }}
                  className="shrink-0 px-3 py-1.5 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Copy</button>
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 rounded-xl border border-border text-xs hover:bg-muted transition-colors flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        ) : (
          <CompletionMeter
            completed={completedSections}
            total={ALL_SECTIONS.length}
            syncableSections={syncableSections}
          />
        )}

        {/* Publishing is a commitment (Hosted Experience Platform Phase 3) —
            guests keep seeing the last published version; edits made since
            then sit in the draft until this is pressed again. */}
        {site.isPublished && site.hasPendingChanges && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            You&apos;ve made changes since your website last went live. Guests are still seeing the previous version.
          </div>
        )}
        {site.isPublished && site.hasPendingChanges ? (
          <button type="button" onClick={publishUpdates} disabled={publishing}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 bg-primary text-primary-foreground">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Publish updates"}
          </button>
        ) : (
          <button type="button" onClick={togglePublish} disabled={publishing}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${site.isPublished ? "border border-border text-muted-foreground hover:bg-muted/40" : "bg-primary text-primary-foreground"}`}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              : site.isPublished ? "Unpublish website" : "🚀 Publish website"}
          </button>
        )}
      </div>}

      {/* ── Change-notification nudges (Hosted Experience Platform Phase 5) ── */}
      {!hideStatusHeader && nudges.map(nudge => (
        <div key={nudge.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5">💗</span>
            <p className="text-sm text-heading leading-relaxed">{nudge.changeSummary}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => notifyGuestsOfChange(nudge.id)} disabled={notifyingNudge === nudge.id}
              className="flex-1 text-xs font-semibold py-2 rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
              {notifyingNudge === nudge.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Notify guests who've RSVP'd"}
            </button>
            <button type="button" onClick={() => dismissNudge(nudge.id)} disabled={notifyingNudge === nudge.id}
              className="text-xs text-muted-foreground py-2 px-3 rounded-xl border border-border hover:bg-muted/40">
              Not now
            </button>
          </div>
        </div>
      ))}

      {/* ── "Already here" welcome banner ── */}
      {/* Shown on first open when the platform already knows things about the couple */}
      {!welcomeDismissed && completedSections === 0 && syncableSections > 0 && (
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-[#D8A7AA]/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">💗</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-heading">Your website is already taking shape.</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                We found your story, venue details
                {(suggestions?.engagementPhotos?.length ?? 0) > 0 ? `, and ${suggestions!.engagementPhotos!.length} engagement photo${suggestions!.engagementPhotos!.length === 1 ? "" : "s"}` : ""}
                {" "}already in Hello to Cheers. Open any section marked{" "}
                <span className="font-semibold text-primary">✦ Ready to sync</span>{" "}
                below to bring it in.
              </p>
            </div>
            <button type="button" onClick={() => setWelcomeDismissed(true)}
              className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick preview of what's available */}
          <div className="flex gap-2 flex-wrap">
            {suggestions?.story?.text && (
              <div className="flex items-center gap-1.5 rounded-xl bg-card/60 border border-primary/20 px-2.5 py-1.5">
                <span className="text-xs">💗</span>
                <span className="text-[11px] font-medium text-heading">Your Story</span>
              </div>
            )}
            {suggestions?.venue?.name && (
              <div className="flex items-center gap-1.5 rounded-xl bg-card/60 border border-primary/20 px-2.5 py-1.5">
                <span className="text-xs">📍</span>
                <span className="text-[11px] font-medium text-heading">{suggestions.venue.name}</span>
              </div>
            )}
            {(suggestions?.engagementPhotos?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-card/60 border border-primary/20 px-2.5 py-1.5">
                <span className="text-xs">📸</span>
                <span className="text-[11px] font-medium text-heading">{suggestions!.engagementPhotos!.length} photos</span>
              </div>
            )}
            {suggestions?.coupleNames && (
              <div className="flex items-center gap-1.5 rounded-xl bg-card/60 border border-primary/20 px-2.5 py-1.5">
                <span className="text-xs">✨</span>
                <span className="text-[11px] font-medium text-heading">{suggestions.coupleNames}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Analytics ── */}
      {!hideStatusHeader && site.isPublished && views !== null && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-heading">{views.totalViews}</p>
              <p className="text-[10px] text-muted-foreground">Total visits</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-heading">{views.weekViews}</p>
              <p className="text-[10px] text-muted-foreground">This week</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-heading">{completedSections}</p>
              <p className="text-[10px] text-muted-foreground">Sections</p>
            </div>
          </div>
          {views.totalViews > 0 && (
            <p className="text-center text-xs mt-3 text-primary">
              ✨ {views.totalViews === 1 ? "1 guest has visited your website." : `${views.totalViews} guests have visited your website.`}
            </p>
          )}
        </div>
      )}

      {/* ── Share & Preview ── */}
      {!hideStatusHeader && websiteUrl && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Share your website</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { navigator.clipboard.writeText(websiteUrl); toast.success("Link copied!"); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium hover:bg-muted/40 transition-colors">
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
            <a href={`mailto:?subject=Our Wedding Website&body=Join us for our wedding! ${websiteUrl}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium hover:bg-muted/40 transition-colors">
              <Mail className="h-3.5 w-3.5" /> Share via email
            </a>
            <button type="button" onClick={() => { navigator.clipboard.writeText(`${websiteUrl}#rsvp`); toast.success("RSVP link copied!"); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium hover:bg-muted/40 transition-colors">
              💗 Copy RSVP link
            </button>
            <button type="button" onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${showPreview ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/40"}`}>
              <Smartphone className="h-3.5 w-3.5" /> {showPreview ? "Hide" : "Preview"}
            </button>
            <button type="button" onClick={() => setShowQR(!showQR)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${showQR ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/40"}`}>
              ▦ QR Code
            </button>
          </div>

          {showQR && websiteUrl && (
            <div className="space-y-2 text-center">
              <img src={`/api/portal/website/qr?url=${encodeURIComponent(websiteUrl)}`}
                alt="Website QR code" className="h-40 w-40 mx-auto rounded-xl border border-border" />
              <p className="text-xs text-muted-foreground">Share on save-the-dates, invitations, and signage.</p>
              <a href={`/api/portal/website/qr?url=${encodeURIComponent(websiteUrl)}`} download="wedding-qr.svg"
                className="inline-block text-xs font-medium px-4 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors">
                Download QR Code
              </a>
            </div>
          )}

          {guests.filter(g => g.email).length > 0 && (
            <div className="space-y-3">
              <button type="button" onClick={() => setShowInvite(!showInvite)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${showInvite ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/40"}`}>
                <span>💌 Send Invitations</span>
                <span className="text-xs opacity-70">{guests.filter(g => g.email && !g.rsvpSentAt).length} guests not yet invited</span>
              </button>
              {showInvite && (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select guests to invite</p>
                    <button type="button" onClick={() => setSelectedGuests(
                      selectedGuests.length === guests.filter(g => g.email).length ? [] : guests.filter(g => g.email).map(g => g.id)
                    )} className="text-xs text-muted-foreground hover:text-foreground">
                      {selectedGuests.length === guests.filter(g => g.email).length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {guests.filter(g => g.email).map(g => (
                      <label key={g.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                        <input type="checkbox" checked={selectedGuests.includes(g.id)}
                          onChange={e => setSelectedGuests(prev => e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id))}
                          className="rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-heading truncate">{[g.firstName, g.lastName].filter(Boolean).join(" ")}</p>
                          <p className="text-xs text-muted-foreground truncate">{g.email}</p>
                        </div>
                        {g.rsvpSentAt && <span className="text-[10px] text-muted-foreground">Sent</span>}
                        {g.rsvpStatus === "attending" && <span className="text-[10px] text-green-600">✓ Attending</span>}
                      </label>
                    ))}
                  </div>
                  <button type="button" disabled={selectedGuests.length === 0 || sendingInvites}
                    onClick={async () => {
                      setSendingInvites(true);
                      try {
                        const res = await fetch("/api/portal/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, guestIds: selectedGuests }) });
                        const data = await res.json() as { ok: boolean; sent?: number };
                        if (data.ok) { toast.success(`${data.sent} invitation${data.sent !== 1 ? "s" : ""} sent!`); setShowInvite(false); setSelectedGuests([]); }
                        else toast.error("Some invitations failed.");
                      } finally { setSendingInvites(false); }
                    }}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50">
                    {sendingInvites ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `Send ${selectedGuests.length > 0 ? selectedGuests.length + " " : ""}Invitation${selectedGuests.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {showPreview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  <button type="button" onClick={() => setPreviewMode("mobile")}
                    className={`px-2.5 py-1 transition-colors ${previewMode === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>📱</button>
                  <button type="button" onClick={() => setPreviewMode("desktop")}
                    className={`px-2.5 py-1 transition-colors ${previewMode === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>🖥</button>
                </div>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Open full site
                </a>
              </div>
              <div className={`rounded-2xl overflow-hidden border border-border bg-muted/10 mx-auto transition-all ${previewMode === "mobile" ? "max-w-[320px]" : "w-full"}`}
                style={{ height: previewMode === "mobile" ? "560px" : "400px" }}>
                <iframe src={previewUrl} className="w-full h-full border-0 rounded-2xl" title="Website preview"
                  style={previewMode === "desktop" ? { transform: "scale(0.7)", transformOrigin: "top left", width: "143%", height: "143%" } : {}} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Theme Studio ── */}
      <ThemeStudio site={site} onUpdate={updateAppearance} />

      {/* ── Section editors ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground px-1 pb-1">
          Your sections <span className="font-normal opacity-60">· drag ↕ to reorder</span>
        </p>
        {orderedSections.map((section, idx) => (
          <SectionAccordion
            key={section.key}
            section={section}
            content={content}
            onSaveSection={saveSection}
            saving={saving}
            token={token}
            suggestions={suggestions}
            lastSyncedAt={site.sections?.find(s => s.key === section.key)?.lastSyncedAt}
            onRefreshSuggestions={refreshSuggestions}
            onSectionSynced={markSectionSynced}
            scheduleSync={section.key === "schedule" ? scheduleSync : undefined}
            onToggleSync={section.key === "schedule" ? async (v) => {
              setScheduleSync(v);
              await fetch("/api/portal/website", {
                method: "POST", headers: { "content-type": "application/json" },
                body: JSON.stringify({ token, scheduleSync: v }),
              });
            } : undefined}
            onMoveUp={() => moveSection(section.key, "up")}
            onMoveDown={() => moveSection(section.key, "down")}
            isFirst={idx === 0}
            isLast={idx === orderedSections.length - 1}
            forceOpen={focusSection === section.key}
          />
        ))}
      </div>

    </div>
  );
}
