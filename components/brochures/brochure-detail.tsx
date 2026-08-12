"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { deleteBrochureAction, sendBrochureToLeadAction, updateBrochureAction } from "@/app/(app)/library/brochures/actions";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { LibrarySaveStatus } from "@/components/library/library-save-status";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { leadDisplayName } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";
import type { BrochureWithActivity } from "@/lib/brochures/types";

function SendToLead({ brochureId, leads }: { brochureId: string; leads: Lead[] }) {
  const [leadId, setLeadId] = React.useState("");
  const leadsWithEmail = leads.filter((l) => l.email);
  const selected = leadsWithEmail.find((l) => l.id === leadId) ?? null;

  const recipient = selected
    ? { name: leadDisplayName(selected.firstName, selected.lastName, selected.partnerFirstName, selected.partnerLastName), contact: selected.email, relationshipLabel: "Prospect" }
    : null;

  async function handleSend(message: string) {
    return sendBrochureToLeadAction(brochureId, leadId, message);
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={leadId} onValueChange={setLeadId} items={leadsWithEmail.map((l) => ({ value: l.id, label: leadDisplayName(l.firstName, l.lastName, l.partnerFirstName, l.partnerLastName) }))}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Choose a prospect" /></SelectTrigger>
        <SelectContent>
          {leadsWithEmail.map((l) => (
            <SelectItem key={l.id} value={l.id}>{leadDisplayName(l.firstName, l.lastName, l.partnerFirstName, l.partnerLastName)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ShareDialog
        trigger={<Button type="button" size="sm" disabled={!recipient}><Send className="mr-1.5 h-3.5 w-3.5" />Share</Button>}
        title="Share Brochure"
        recipient={recipient}
        whatHappensNext="They'll get an email with a link to view this brochure — no account needed. Editing the brochure later updates what that link shows; there is no separate revoke action today."
        defaultMessage=""
        sendLabel="Send"
        onSend={handleSend}
      />
    </div>
  );
}

export function BrochureDetail({ brochure, leads }: { brochure: BrochureWithActivity; leads: Lead[] }) {
  const router = useRouter();
  const [name, setName] = React.useState(brochure.name);
  const [welcomeText, setWelcomeText] = React.useState(brochure.welcomeText ?? "");
  const [includePackages, setIncludePackages] = React.useState(brochure.includePackages);
  const [includeFaqs, setIncludeFaqs] = React.useState(brochure.includeFaqs);
  const [closingText, setClosingText] = React.useState(brochure.closingText ?? "");
  const [dirty, setDirty] = React.useState(false);
  const [saving, startSave] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();
  const { confirmLeave } = useLibraryUnsavedGuard(dirty);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  function handleSave() {
    startSave(async () => {
      const result = await updateBrochureAction(brochure.id, { name, welcomeText, includePackages, includeFaqs, closingText });
      if (result.ok) { toast.success(librarySavedToastMessage()); setDirty(false); }
      else toast.error(result.message ?? "Could not save.");
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${brochure.name}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteBrochureAction(brochure.id);
      if (result.ok) { toast.success("Brochure deleted."); router.push("/library/brochures"); }
      else toast.error(result.message ?? "Could not delete.");
    });
  }

  return (
    <div className="space-y-6">
      <BusinessAssetHeader
        backHref="/library/brochures"
        backLabel="Brochures"
        beforeNavigate={confirmLeave}
        whatIsThis="Brochure"
        title={brochure.name}
        status={brochure.isArchived ? <Badge variant="muted">Archived</Badge> : <Badge variant="outline">Active</Badge>}
        lastUpdated={new Date(brochure.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        primaryAction={
          <div className="flex items-center gap-2">
            <a href={`/api/brochures/${brochure.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" size="sm"><Eye className="mr-1.5 h-3.5 w-3.5" />Preview</Button>
            </a>
            <a href={`/api/brochures/${brochure.id}/pdf`} download>
              <Button type="button" variant="ghost" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" /></Button>
            </a>
          </div>
        }
      />

      <Card>
        <CardHeader><p className="text-sm font-medium text-heading">Content</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Name</Label>
            <Input value={name} onChange={(e) => markDirty(setName)(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Welcome text</Label>
            <p className="text-xs text-muted-foreground">Leave blank to use your venue's own story from Settings.</p>
            <Textarea value={welcomeText} onChange={(e) => markDirty(setWelcomeText)(e.target.value)} rows={4} placeholder="Tell prospective couples about your venue…" />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Switch checked={includePackages} onCheckedChange={markDirty(setIncludePackages)} />
            <Label className="cursor-pointer">
              Include Packages
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">Your active packages, pulled in automatically — always up to date.</span>
            </Label>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Switch checked={includeFaqs} onCheckedChange={markDirty(setIncludeFaqs)} />
            <Label className="cursor-pointer">
              Include FAQs
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">The client-facing questions from your Venue Guide.</span>
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Next steps <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea value={closingText} onChange={(e) => markDirty(setClosingText)(e.target.value)} rows={3} placeholder="How should they get in touch?" />
          </div>
          <div className="flex items-center justify-end gap-3">
            <LibrarySaveStatus status={saving ? "saving" : dirty ? "dirty" : "idle"} model="explicit" className="mr-auto" />
            <Button type="button" disabled={!dirty || !name.trim() || saving} onClick={handleSave}>
              {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><p className="text-sm font-medium text-heading">Share with a prospect</p></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Share sends an email with a view link. The public link for this brochure stays the same after you send —
            there is no separate revoke action. Archive hides the brochure from your Library list; previously shared
            links keep working until you delete the brochure.
          </p>
          {leads.filter((l) => l.email).length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads with an email address yet.</p>
          ) : (
            <SendToLead brochureId={brochure.id} leads={leads} />
          )}
        </CardContent>
      </Card>

      {brochure.activities.length > 0 && (
        <Card>
          <CardHeader><p className="text-sm font-medium text-heading">Activity</p></CardHeader>
          <CardContent><ActivityTimeline activities={brochure.activities} /></CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deleting} onClick={handleDelete}>
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete Brochure"}
        </Button>
      </div>
    </div>
  );
}
