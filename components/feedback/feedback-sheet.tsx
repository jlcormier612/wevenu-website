"use client";

import * as React from "react";
import { ImagePlus, Loader2, MessageCircle, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FEEDBACK_SCREENSHOT_ACCEPT,
  MAX_FEEDBACK_SCREENSHOTS,
  MAX_FEEDBACK_SCREENSHOT_MB,
  type FeedbackAttachment,
} from "@/lib/feedback/attachments";
import { cn } from "@/lib/utils";

export type FeedbackSurface = "venue" | "vendor" | "client";

type FeedbackType = "support" | "bug" | "feature" | "nps" | "general";

type FeatureRequest = {
  id: string;
  subject: string | null;
  body: string;
  vote_count: number;
  i_voted: boolean;
};

type LocalScreenshot = FeedbackAttachment & {
  localId: string;
  previewUrl: string;
};

const TYPES: { value: FeedbackType; label: string; emoji: string; placeholder: string }[] = [
  { value: "support", label: "Get Help",        emoji: "🙋", placeholder: "Describe what you need help with…" },
  { value: "bug",     label: "Report a Bug",    emoji: "🐛", placeholder: "What happened? What did you expect?" },
  { value: "feature", label: "Suggest an Idea", emoji: "💡", placeholder: "What would make Hello to Cheers better for you?" },
  { value: "nps",     label: "Rate Hello to Cheers",     emoji: "⭐", placeholder: "Any comments? (optional)" },
];

const SUBTITLES: Record<FeedbackSurface, string> = {
  venue:  "Help us make Hello to Cheers better for your venue.",
  vendor: "Help us make Hello to Cheers better for your vendor experience.",
  client: "Help us make Hello to Cheers better for your planning experience.",
};

export function FeedbackSheet({
  children,
  surface = "venue",
  relatedVenueId = null,
  portalToken,
  triggerClassName,
}: {
  children?: React.ReactNode;
  surface?: FeedbackSurface;
  /** Related product venue id when known (vendor event context, portal session). */
  relatedVenueId?: string | null;
  /** Portal access token — required when surface is client. */
  portalToken?: string;
  triggerClassName?: string;
}) {
  const [open,             setOpen]             = React.useState(false);
  const [type,             setType]             = React.useState<FeedbackType>("general");
  const [subject,          setSubject]          = React.useState("");
  const [body,             setBody]             = React.useState("");
  const [rating,           setRating]           = React.useState<number | null>(null);
  const [allowPublicShare, setAllowPublicShare] = React.useState(false);
  const [sending,          setSending]          = React.useState(false);
  const [features,         setFeatures]         = React.useState<FeatureRequest[]>([]);
  const [votingId,         setVotingId]         = React.useState<string | null>(null);
  const [screenshots,      setScreenshots]      = React.useState<LocalScreenshot[]>([]);
  const [uploadingShot,    setUploadingShot]    = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const selected = TYPES.find(t => t.value === type) ?? TYPES[0];
  const isNps    = type === "nps";
  const isFeature = type === "feature";
  const isBug    = type === "bug";
  const canSend  = isNps ? rating != null : body.trim().length > 0;

  // Load feature requests when feature tab is selected (authenticated surfaces only)
  React.useEffect(() => {
    if (!isFeature || !open || surface === "client") return;
    fetch("/api/feedback/features")
      .then(r => r.json())
      .then((d: { features?: FeatureRequest[] }) => setFeatures(d.features ?? []))
      .catch(() => {});
  }, [isFeature, open, surface]);

  function clearScreenshots() {
    setScreenshots(prev => {
      for (const s of prev) URL.revokeObjectURL(s.previewUrl);
      return [];
    });
  }

  function reset() {
    setType("general");
    setSubject("");
    setBody("");
    setRating(null);
    setAllowPublicShare(false);
    setSending(false);
    setFeatures([]);
    clearScreenshots();
    setUploadingShot(false);
  }

  async function uploadScreenshot(file: File) {
    if (surface === "client" && !portalToken) {
      toast.error("Couldn't attach screenshot. Please refresh and try again.");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    if (surface === "client" && portalToken) form.append("token", portalToken);

    const endpoint = surface === "client"
      ? "/api/portal/product-feedback/upload"
      : "/api/feedback/upload";

    const res = await fetch(endpoint, { method: "POST", body: form });
    const data = await res.json() as {
      ok?: boolean;
      error?: string;
      url?: string;
      path?: string;
      file_name?: string;
      file_size?: number;
      mime_type?: string;
    };
    if (!res.ok || !data.ok || !data.url || !data.path) {
      throw new Error(data.error ?? "Upload failed.");
    }

    const previewUrl = URL.createObjectURL(file);
    setScreenshots(prev => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        previewUrl,
        url: data.url!,
        path: data.path!,
        file_name: data.file_name ?? file.name,
        mime_type: data.mime_type ?? file.type,
        size: data.file_size ?? file.size,
      },
    ]);
  }

  async function handleScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (files.length === 0) return;

    const remaining = MAX_FEEDBACK_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) {
      toast.error(`You can attach up to ${MAX_FEEDBACK_SCREENSHOTS} screenshots.`);
      return;
    }

    const batch = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.message(`Only ${MAX_FEEDBACK_SCREENSHOTS} screenshots allowed — attached the first ${remaining}.`);
    }

    setUploadingShot(true);
    try {
      for (const file of batch) {
        if (file.size > MAX_FEEDBACK_SCREENSHOT_MB * 1024 * 1024) {
          toast.error(`${file.name} is too large (max ${MAX_FEEDBACK_SCREENSHOT_MB} MB).`);
          continue;
        }
        try {
          await uploadScreenshot(file);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't upload screenshot.");
        }
      }
    } finally {
      setUploadingShot(false);
    }
  }

  function removeScreenshot(localId: string) {
    setScreenshots(prev => {
      const target = prev.find(s => s.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(s => s.localId !== localId);
    });
  }

  async function submit() {
    if (!canSend || sending || uploadingShot) return;
    if (surface === "client" && !portalToken) {
      toast.error("Couldn't send feedback. Please refresh and try again.");
      return;
    }
    setSending(true);
    try {
      const endpoint = surface === "client"
        ? "/api/portal/product-feedback"
        : "/api/feedback";

      const attachments: FeedbackAttachment[] = isBug
        ? screenshots.map(({ url, path, file_name, mime_type, size }) => ({
            url, path, file_name, mime_type, size,
          }))
        : [];

      const payload = surface === "client"
        ? {
            token: portalToken,
            type,
            subject: subject.trim() || null,
            body: body.trim(),
            rating,
            allow_public_share: isNps ? allowPublicShare : false,
            attachments,
            metadata: {
              current_url: window.location.href,
              user_agent: navigator.userAgent,
              surface,
            },
          }
        : {
            type,
            subject: subject.trim() || null,
            body: body.trim(),
            rating,
            surface,
            related_venue_id: relatedVenueId ?? null,
            allow_public_share: isNps ? allowPublicShare : false,
            attachments,
            metadata: {
              current_url: window.location.href,
              user_agent: navigator.userAgent,
              surface,
              related_venue_id: relatedVenueId ?? null,
            },
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Feedback sent — thank you!");
      setOpen(false);
      reset();
    } catch {
      toast.error("Couldn't send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function toggleVote(featureId: string) {
    setVotingId(featureId);
    try {
      const res = await fetch(`/api/feedback/features/${featureId}/vote`, { method: "POST" });
      const d = await res.json() as { ok: boolean; voted: boolean };
      if (d.ok) {
        setFeatures(prev => prev.map(f =>
          f.id === featureId
            ? { ...f, i_voted: d.voted, vote_count: f.vote_count + (d.voted ? 1 : -1) }
            : f
        ));
      }
    } catch {
      toast.error("Couldn't register vote.");
    } finally {
      setVotingId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <SheetTrigger render={<span />} nativeButton={false}>
        {children ?? (
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-[0.95rem] font-medium tracking-wide text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              triggerClassName,
            )}
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>Give feedback</span>
          </button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle>Share Feedback</SheetTitle>
          <SheetDescription>{SUBTITLES[surface]}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Type picker */}
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setType(t.value);
                  if (t.value !== "nps") setAllowPublicShare(false);
                  if (t.value !== "bug") clearScreenshots();
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  type === t.value
                    ? "border-primary bg-primary/8 text-heading"
                    : "border-border bg-background hover:bg-muted text-muted-foreground",
                )}
              >
                <span className="text-base">{t.emoji}</span>
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>

          {/* NPS rating */}
          {isNps && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-heading">How likely are you to recommend Hello to Cheers?</p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={cn(
                      "h-9 w-9 rounded-lg border text-sm font-semibold transition-colors",
                      rating === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted text-muted-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
            </div>
          )}

          {/* Subject — hidden for NPS */}
          {!isNps && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading" htmlFor="fb-subject">
                Subject <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="fb-subject"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Brief summary"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
          )}

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading" htmlFor="fb-body">
              {isNps ? "Any comments?" : "Tell us more"}
              {!isNps && <span className="text-destructive ml-0.5">*</span>}
              {isNps  && <span className="text-muted-foreground font-normal"> (optional)</span>}
            </label>
            <textarea
              id="fb-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder={selected.placeholder}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          {/* Screenshots — bug reports only; optional */}
          {isBug && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-medium text-heading">
                  Screenshots{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {screenshots.length}/{MAX_FEEDBACK_SCREENSHOTS}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Screenshots help us reproduce the issue faster.
              </p>

              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {screenshots.map(s => (
                    <div
                      key={s.localId}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted/40"
                    >
                      <img
                        src={s.previewUrl}
                        alt={s.file_name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeScreenshot(s.localId)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-muted-foreground shadow-sm hover:text-destructive"
                        aria-label={`Remove ${s.file_name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {screenshots.length < MAX_FEEDBACK_SCREENSHOTS && (
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 w-fit",
                    uploadingShot && "cursor-not-allowed opacity-50",
                  )}
                >
                  {uploadingShot ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {uploadingShot ? "Uploading…" : "Attach screenshots"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={FEEDBACK_SCREENSHOT_ACCEPT}
                    multiple
                    className="sr-only"
                    disabled={uploadingShot || sending}
                    onChange={e => void handleScreenshotSelect(e)}
                  />
                </label>
              )}
              <p className="text-[11px] text-muted-foreground">
                PNG, JPG, WEBP, or HEIC · up to {MAX_FEEDBACK_SCREENSHOT_MB} MB each
              </p>
            </div>
          )}

          {/* Outward-share consent — NPS only; optional, default off */}
          {isNps && (
            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 cursor-pointer">
              <Checkbox
                checked={allowPublicShare}
                onCheckedChange={(v) => setAllowPublicShare(v === true)}
                className="mt-0.5"
                aria-describedby="fb-public-share-hint"
              />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-medium text-heading">
                  Okay to share this publicly
                </span>
                <span id="fb-public-share-hint" className="block text-xs text-muted-foreground leading-snug">
                  I give Hello to Cheers permission to share this feedback publicly — anonymized, or with attribution if we ask first.
                </span>
              </span>
            </label>
          )}

          {/* Feature voting — shown when type = feature (venue/vendor only) */}
          {isFeature && features.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {surface === "vendor" ? "Other vendors have requested" : "Other venues have requested"}
              </p>
              <div className="space-y-2">
                {features.map(f => (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 rounded-xl border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        {f.subject ?? f.body.slice(0, 80)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={votingId === f.id}
                      onClick={() => void toggleVote(f.id)}
                      className={cn(
                        "shrink-0 flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                        f.i_voted
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      <span>{f.vote_count}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-5 pb-5 pt-3 border-t">
          <Button
            className="w-full"
            disabled={!canSend || sending || uploadingShot}
            onClick={() => void submit()}
          >
            {sending ? "Sending…" : "Send Feedback"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
