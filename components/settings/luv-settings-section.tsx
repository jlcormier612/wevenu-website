"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveLuvSettingsAction } from "@/app/(app)/settings/luv-settings-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LuvSettings } from "@/lib/luv/settings";

function OptionButton<T extends string>({
  value, current, onChange, label, description, disabled,
}: {
  value: T;
  current: T;
  onChange: (v: T) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(value)}
      className={`rounded-xl border p-3 text-left transition-colors ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      } ${
        active ? "border-[#D8A7AA] bg-[#D8A7AA]/10" : "border-border hover:border-[#D8A7AA]/40 hover:bg-muted/40"
      }`}
    >
      <p className={`text-sm font-medium ${active ? "text-heading" : "text-foreground"}`}>{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </button>
  );
}

export function LuvSettingsSection({ initialSettings }: { initialSettings: LuvSettings }) {
  const [settings, setSettings] = React.useState(initialSettings);
  const [pending, startSave] = React.useTransition();
  const masterOn = settings.enabled !== false;

  function set<K extends keyof LuvSettings>(key: K, value: LuvSettings[K]) {
    setSettings((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    startSave(async () => {
      const result = await saveLuvSettingsAction(settings);
      if (!result.ok) {
        toast.error(result.message || "Could not save Luv settings.");
        return;
      }
      toast.success("Luv settings saved.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium text-heading">Enable Luv</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Turn this off to hide Luv from your venue workspace and your clients&apos; and guests&apos; experiences. Luv will stop generating suggestions, drafts, and responses. You can turn Luv back on anytime.
            </p>
          </div>
          <Switch checked={masterOn} onCheckedChange={(v) => set("enabled", v)} />
        </div>

        <div className={`space-y-3 ${masterOn ? "" : "opacity-60"}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium text-heading">Dashboard observations</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Show Luv&apos;s quiet dashboard note when she has something useful to say.</p>
            </div>
            <Switch
              checked={settings.observationsEnabled}
              disabled={!masterOn}
              onCheckedChange={(v) => set("observationsEnabled", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium text-heading">Drafting assistance</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Allow Luv to draft messages and answer couple Ask Luv questions. Luv never sends messages on its own.</p>
            </div>
            <Switch
              checked={settings.draftingEnabled}
              disabled={!masterOn}
              onCheckedChange={(v) => set("draftingEnabled", v)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-heading">How Luv works</Label>
        <p className="text-sm text-muted-foreground">
          Luv drafts and suggests. Your team reviews and sends. Luv never sends messages on its own.
        </p>
      </div>

      <div className={`space-y-2 ${masterOn ? "" : "opacity-60"}`}>
        <Label className="text-sm font-medium text-heading">Preferred tone</Label>
        <p className="text-xs text-muted-foreground">How Luv writes drafted content on your behalf.</p>
        <div className="grid gap-2 sm:grid-cols-3 mt-2">
          <OptionButton
            value="warm" current={settings.preferredTone}
            onChange={(v) => set("preferredTone", v)}
            disabled={!masterOn}
            label="Warm & friendly"
            description="Personal, conversational, approachable." />
          <OptionButton
            value="professional" current={settings.preferredTone}
            onChange={(v) => set("preferredTone", v)}
            disabled={!masterOn}
            label="Professional"
            description="Polished, courteous, and business-appropriate." />
          <OptionButton
            value="formal" current={settings.preferredTone}
            onChange={(v) => set("preferredTone", v)}
            disabled={!masterOn}
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
