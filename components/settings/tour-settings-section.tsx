"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TourSettings } from "@/lib/tours/types";

function SlotPreview({ tourKey }: { tourKey: string }) {
  const [slots, setSlots] = React.useState<{ start: string; time: string; date: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    setLoading(true);
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
    fetch(`/api/tours/slots?key=${tourKey}&start=${start}&end=${end}`)
      .then(r => r.json())
      .then((d: { slots: { start: string; time: string; date: string }[] }) => setSlots(d.slots ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tourKey]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading available slots…</p>;
  if (!slots.length) return <p className="text-xs text-muted-foreground">No slots available in the next 14 days. Check your business hours in Settings → Hours.</p>;

  const grouped = slots.reduce<Record<string, string[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s.time);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Preview: slots couples would see in the next 14 days ({slots.length} total)</p>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {Object.entries(grouped).slice(0, 5).map(([date, times]) => (
          <div key={date} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-heading min-w-[90px]">
              {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            {times.map(t => <Badge key={t} variant="outline" className="text-[10px] h-5">{t}</Badge>)}
          </div>
        ))}
        {Object.keys(grouped).length > 5 && <p className="text-[10px] text-muted-foreground">+ {Object.keys(grouped).length - 5} more days…</p>}
      </div>
    </div>
  );
}

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
      const { updateTourSettingsAction } = await import("@/app/(app)/settings/tour-actions");
      const result = await updateTourSettingsAction(s);
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

          {/* Available slot preview */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Slot Preview</p>
            <SlotPreview tourKey={s.tourEmbedKey} />
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
