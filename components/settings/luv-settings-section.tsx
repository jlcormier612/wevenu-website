"use client";

import * as React from "react";

import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveLuvSettingsAction } from "@/app/(app)/settings/luv-settings-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LuvSettings } from "@/lib/luv/settings";

const DUSTY_ROSE = "#D8A7AA";

function OptionButton<T extends string>({
  value, current, onChange, label, description,
}: { value: T; current: T; onChange: (v: T) => void; label: string; description: string }) {
  const active = value === current;
  return (
    <button type="button" onClick={() => onChange(value)}
      className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-[#D8A7AA] bg-[#D8A7AA]/10" : "border-border hover:border-[#D8A7AA]/40 hover:bg-muted/40"}`}>
      <p className={`text-sm font-medium ${active ? "text-heading" : "text-foreground"}`}>{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </button>
  );
}

export function LuvSettingsSection({ initialSettings }: { initialSettings: LuvSettings }) {
  const [settings, setSettings] = React.useState(initialSettings);
  const [pending, startSave] = React.useTransition();

  function set<K extends keyof LuvSettings>(key: K, value: LuvSettings[K]) {
    setSettings((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    startSave(async () => {
      await saveLuvSettingsAction(settings);
      toast.success("Luv settings saved.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Toggle row */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium text-heading">Dashboard observations</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Show "What Luv noticed today" on the dashboard.</p>
          </div>
          <Switch checked={settings.observationsEnabled} onCheckedChange={(v) => set("observationsEnabled", v)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium text-heading">Drafting assistance</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Enable the "Ask Luv to draft" button on lead and client records.</p>
          </div>
          <Switch checked={settings.draftingEnabled} onCheckedChange={(v) => set("draftingEnabled", v)} />
        </div>
      </div>

      {/* Autonomy level */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-heading">Autonomy level</Label>
        <p className="text-xs text-muted-foreground">How much Luv can do before a coordinator reviews.</p>
        <div className="grid gap-2 sm:grid-cols-2 mt-2">
          <OptionButton
            value="suggest_only" current={settings.autonomyLevel}
            onChange={(v) => set("autonomyLevel", v)}
            label="Suggest only"
            description="Luv notices and highlights — no drafting until you ask." />
          <OptionButton
            value="draft_for_review" current={settings.autonomyLevel}
            onChange={(v) => set("autonomyLevel", v)}
            label="Draft for review"
            description="Luv drafts content. You review, edit, and send it yourself." />
        </div>
        <p className="text-[10px] text-muted-foreground italic">Auto-draft coming in a future update.</p>
      </div>

      {/* Preferred tone */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-heading">Preferred tone</Label>
        <p className="text-xs text-muted-foreground">How Luv writes drafted content on your behalf.</p>
        <div className="grid gap-2 sm:grid-cols-3 mt-2">
          <OptionButton
            value="warm" current={settings.preferredTone}
            onChange={(v) => set("preferredTone", v)}
            label="Warm & friendly"
            description="Personal, conversational, approachable." />
          <OptionButton
            value="professional" current={settings.preferredTone}
            onChange={(v) => set("preferredTone", v)}
            label="Professional"
            description="Polished, courteous, and business-appropriate." />
          <OptionButton
            value="formal" current={settings.preferredTone}
            onChange={(v) => set("preferredTone", v)}
            label="Formal"
            description="Precise and structured — best for corporate clients." />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save Luv settings"}
        </Button>
      </div>
    </div>
  );
}
