"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TourSettings } from "@/lib/tours/types";

type Props = { initialSettings: TourSettings };

export function TourSettingsSection({ initialSettings }: Props) {
  const router = useRouter();
  const [s, setS] = React.useState(initialSettings);
  const [saving, startSave] = React.useTransition();

  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${s.tourEmbedKey}`
    : `/book/${s.tourEmbedKey}`;

  function set<K extends keyof TourSettings>(k: K, v: TourSettings[K]) {
    setS((p) => ({ ...p, [k]: v }));
  }

  function handleSave() {
    startSave(async () => {
      const { updateTourSettings } = await import("@/lib/tours/service");
      const result = await updateTourSettings(s);
      if (result.ok) { toast.success("Tour settings saved."); router.refresh(); }
      else toast.error("Could not save settings.");
    });
  }

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center gap-3">
        <Switch checked={s.tourSchedulingEnabled} onCheckedChange={(v) => set("tourSchedulingEnabled", v)} />
        <Label className="cursor-pointer">Enable public tour scheduling</Label>
      </div>

      {s.tourSchedulingEnabled && (
        <>
          {/* Booking link */}
          <div className="space-y-1.5">
            <Label className="text-xs">Booking link</Label>
            <p className="text-xs text-muted-foreground">Share this on your website so couples can schedule a tour directly.</p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <p className="text-[11px] font-mono text-muted-foreground break-all">{bookingUrl}</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0"
                onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success("Copied!"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="outline" size="sm" className="shrink-0"
                onClick={() => window.open(bookingUrl, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Page copy */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Page headline</Label>
              <Input value={s.tourPageHeadline ?? ""} onChange={(e) => set("tourPageHeadline", e.target.value)} placeholder="Schedule a Tour" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea rows={2} value={s.tourPageDescription ?? ""} onChange={(e) => set("tourPageDescription", e.target.value)} placeholder="Tours run Tuesday–Saturday, 10am–4pm. We'd love to show you around." />
            </div>
          </div>

          {/* Scheduling rules */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tour duration (minutes)</Label>
              <Input type="number" min="15" max="480" value={s.tourDurationMinutes}
                onChange={(e) => set("tourDurationMinutes", parseInt(e.target.value) || 60)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Buffer between tours (minutes)</Label>
              <Input type="number" min="0" max="120" value={s.tourBufferMinutes}
                onChange={(e) => set("tourBufferMinutes", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Minimum notice (hours)</Label>
              <p className="text-[10px] text-muted-foreground">Couples can't book tours less than N hours from now.</p>
              <Input type="number" min="0" value={s.tourMinNoticeHours}
                onChange={(e) => set("tourMinNoticeHours", parseInt(e.target.value) || 24)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max advance booking (days)</Label>
              <p className="text-[10px] text-muted-foreground">How far in advance couples can schedule.</p>
              <Input type="number" min="1" max="365" value={s.tourMaxAdvanceDays}
                onChange={(e) => set("tourMaxAdvanceDays", parseInt(e.target.value) || 90)} />
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Tour Settings"}
        </Button>
      </div>
    </div>
  );
}
