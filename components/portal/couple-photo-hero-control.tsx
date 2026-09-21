"use client";

import * as React from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";

function useFinePointerHover(): boolean {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return fine;
}

/**
 * Couple photo overlay for the portal hero top-left.
 * Renders nothing when there is no photo — venue hero stays full-bleed.
 * Controls open on click/tap (and hover on fine pointers); dismissed on
 * outside interaction via a local backdrop + document capture listener.
 */
export function CouplePhotoHeroControl({ token }: { token: string }) {
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [shared, setShared] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const fineHover = useFinePointerHover();

  const controlsVisible = panelOpen || (fineHover && hovered);

  function dismissControls() {
    setPanelOpen(false);
    setHovered(false);
  }

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/portal/relationship-photo?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; photoUrl?: string | null; shared?: boolean }) => {
        if (cancelled || !data?.ok) return;
        setPhotoUrl(data.photoUrl ?? null);
        setShared(Boolean(data.shared));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  React.useEffect(() => {
    const hero = anchorRef.current?.closest("[data-portal-hero]");
    if (!(hero instanceof HTMLElement)) return;
    if (photoUrl) hero.dataset.couplePhoto = "shown";
    else delete hero.dataset.couplePhoto;
    return () => {
      delete hero.dataset.couplePhoto;
    };
  }, [photoUrl, loaded]);

  React.useEffect(() => {
    if (!controlsVisible) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      dismissControls();
    };
    // Capture on document catches outside taps even when the hero gradient /
    // non-interactive layers would otherwise swallow click on some mobile browsers.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [controlsVisible]);

  async function uploadFile(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("token", token);
      form.append("file", file);
      const res = await fetch("/api/portal/relationship-photo", { method: "POST", body: form });
      const data = await res.json() as { ok?: boolean; photoUrl?: string | null; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not upload your photo.");
        return;
      }
      setPhotoUrl(data.photoUrl ?? null);
      setPanelOpen(true);
      toast.success("Photo added.");
    } catch {
      toast.error("Could not upload your photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function setSharing(next: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/portal/relationship-photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, shared: next }),
      });
      const data = await res.json() as { ok?: boolean; shared?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error === "no_photo" ? "Add a photo before sharing." : (data.error ?? "Could not update sharing."));
        return;
      }
      setShared(Boolean(data.shared));
      toast.success(next ? "Shared with your venue." : "No longer shared with your venue.");
    } catch {
      toast.error("Could not update sharing.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    try {
      const res = await fetch("/api/portal/relationship-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not remove your photo.");
        return;
      }
      setPhotoUrl(null);
      setShared(false);
      dismissControls();
      toast.success("Photo removed.");
    } catch {
      toast.error("Could not remove your photo.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <div ref={anchorRef} className="absolute top-4 left-4 z-20 sm:top-6 sm:left-6">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />

      {photoUrl ? (
        <>
          {controlsVisible ? (
            <button
              type="button"
              aria-label="Dismiss photo options"
              className="fixed inset-0 z-10 cursor-default bg-transparent"
              onPointerDown={(event) => {
                event.preventDefault();
                dismissControls();
              }}
            />
          ) : null}
          <div
            ref={rootRef}
            className="relative z-20"
            onPointerEnter={() => {
              if (fineHover) setHovered(true);
            }}
            onPointerLeave={() => {
              if (fineHover) setHovered(false);
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPanelOpen((open) => !open);
              }}
              className="relative h-40 w-40 overflow-hidden rounded-full border-2 border-white/90 shadow-lg sm:h-52 sm:w-52 lg:h-[228px] lg:w-[228px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Manage your photo"
              aria-expanded={controlsVisible}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              {controlsVisible ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Camera className="h-7 w-7 text-white sm:h-8 sm:w-8" />
                </span>
              ) : null}
            </button>

            {controlsVisible ? (
              <div
                className="absolute left-0 top-[calc(100%+0.5rem)] w-64 rounded-2xl border border-white/20 bg-black/80 p-3 text-white shadow-xl backdrop-blur-md"
                role="dialog"
                aria-label="Photo options"
              >
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg bg-white/10 px-3 py-2 text-left text-sm hover:bg-white/20 disabled:opacity-50"
                    onClick={() => inputRef.current?.click()}
                  >
                    Replace photo
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-left text-sm hover:bg-white/20 disabled:opacity-50"
                    onClick={() => void removePhoto()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove photo
                  </button>
                </div>
                <div className="mt-3 border-t border-white/15 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Share with your venue</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-white/65">
                        Your venue can use this photo on your internal client record.
                      </p>
                    </div>
                    <Switch
                      checked={shared}
                      disabled={busy}
                      onCheckedChange={(v) => void setSharing(v)}
                      aria-label="Share this photo with your venue"
                    />
                  </div>
                </div>
                {busy ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/60">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving…
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-11 items-center gap-2 rounded-full border border-white/35 bg-black/35 px-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Add your photo
        </button>
      )}
    </div>
  );
}
