"use client";

import * as React from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";

/**
 * Couple photo overlay for the portal hero top-left.
 * Renders nothing when there is no photo — venue hero stays full-bleed.
 */
export function CouplePhotoHeroControl({ token }: { token: string }) {
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [shared, setShared] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

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
      setMenuOpen(true);
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
      setMenuOpen(false);
      toast.success("Photo removed.");
    } catch {
      toast.error("Could not remove your photo.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="absolute top-4 left-4 z-20 sm:top-6 sm:left-6">
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="group relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-full border-2 border-white/90 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Manage your photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35">
              <Camera className="h-5 w-5 text-white opacity-0 transition group-hover:opacity-100" />
            </span>
          </button>

          {menuOpen ? (
            <div
              className="absolute left-0 top-[calc(100%+0.5rem)] w-64 rounded-2xl border border-white/20 bg-black/80 p-3 text-white shadow-xl backdrop-blur-md"
              role="dialog"
              aria-label="Photo options"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Your photo</p>
              <div className="mt-3 flex flex-col gap-2">
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
                      Your venue can use this photo on your client profile.
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
