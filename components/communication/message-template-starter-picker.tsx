"use client";

/**
 * Message Template starter picker — Template Platform Release Readiness,
 * Phase 3 (Migration Readiness). Reuses the exact Sheet/card interaction
 * pattern Playbooks/Timeline Templates/Floor Plan Templates already use for
 * the identical decision ("how do you want to start this template?").
 *
 * The "Import" path was the actual gap this closes: lib/luv/message-
 * template-import.ts and importTemplateAction were both fully built and
 * fully wired server-side, with zero UI ever calling them — a venue's
 * accumulated email/text wording, the most copy-heavy migration asset in
 * the platform, had a working import pipeline nobody could reach.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import {
  createTemplateAction, duplicateTemplateAction, importTemplateAction,
} from "@/app/(app)/communication/templates/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGE_TEMPLATE_CATEGORIES } from "@/lib/message-templates/constants";
import type { ImportChannel } from "@/lib/luv/message-template-import";
import type { MessageTemplate, MessageTemplateCategory } from "@/lib/message-templates/types";

const CHANNEL_OPTIONS: { value: ImportChannel; label: string }[] = [
  { value: "email", label: "Email only" },
  { value: "sms", label: "Text (SMS) only" },
  { value: "both", label: "Both — propose an SMS version too" },
];

type StarterChoice = "existing" | "scratch" | "import";

// variant="import" is a second, dedicated entry point onto this exact same
// sheet — same state, same submit path — just opened straight to the
// "Bring your existing wording" card instead of making a venue find it among
// three choices. Matches the "Import Leads" / "Import Clients" button
// already established on those list pages.
export function MessageTemplateStarterPicker({
  existingTemplates, variant = "new",
}: { existingTemplates: MessageTemplate[]; variant?: "new" | "import" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<StarterChoice | null>(variant === "import" ? "import" : null);
  const [sourceTemplateId, setSourceTemplateId] = React.useState("");
  const [importName, setImportName] = React.useState("");
  const [importChannel, setImportChannel] = React.useState<ImportChannel>("email");
  const [importCategory, setImportCategory] = React.useState<MessageTemplateCategory>("general");
  const [importText, setImportText] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setSelected(variant === "import" ? "import" : null); setSourceTemplateId("");
    setImportName(""); setImportChannel("email"); setImportCategory("general"); setImportText("");
  }

  function goToEditor(templateId: string) {
    setOpen(false);
    reset();
    router.push(`/communication/templates/${templateId}/edit`);
  }

  function handleApply() {
    if (selected === "existing" && sourceTemplateId) {
      const source = existingTemplates.find((t) => t.id === sourceTemplateId);
      startTransition(async () => {
        const result = await duplicateTemplateAction(sourceTemplateId, `${source?.name ?? "Template"} (Copy)`);
        if (result.ok) { toast.success("Template duplicated."); goToEditor(result.templateId); }
        else toast.error(result.message ?? "Could not duplicate template.");
      });
    } else if (selected === "scratch") {
      setOpen(false);
      reset();
      router.push("/communication/templates/new");
    } else if (selected === "import" && importName.trim() && importText.trim()) {
      startTransition(async () => {
        const proposal = await importTemplateAction(importText, importChannel, importCategory);
        if (!proposal.ok) { toast.error(proposal.message); return; }
        const created = await createTemplateAction({
          name: importName.trim(),
          category: importCategory,
          emailSubject: proposal.emailSubject,
          emailBody: proposal.emailBody,
          smsBody: proposal.smsBody,
        });
        if (created.ok) { toast.success("Imported — review Luv's first pass in the editor."); goToEditor(created.templateId); }
        else toast.error(created.message ?? "Could not create template.");
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <SheetTrigger render={<Button type="button" variant={variant === "import" ? "outline" : "default"} />}>
        {variant === "import" ? "Import Messages" : <><Wand2 className="mr-1.5 h-4 w-4" />New Template</>}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Start a Message Template</SheetTitle>
          <p className="text-sm text-muted-foreground">Everything here is fully editable after — nothing is final until you save it.</p>
        </SheetHeader>

        <div className="space-y-3">
          {existingTemplates.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected("existing")}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                selected === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <p className="font-medium text-foreground">Duplicate one of your own</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Start from an existing template and adjust it from there.</p>
              {selected === "existing" && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                  {existingTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSourceTemplateId(t.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        sourceTemplateId === t.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelected("scratch")}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              selected === "scratch" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <p className="font-medium text-foreground">Start from scratch</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Write a new email or text message from a blank page.</p>
          </button>

          {/* The gap this component closes — lib/luv/message-template-import.ts
              and importTemplateAction were both already built; this is the
              first UI to ever call either. */}
          <button
            type="button"
            onClick={() => setSelected("import")}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              selected === "import" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <p className="font-medium text-foreground">Bring your existing wording</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Already sending something like this? Paste it in — no re-typing.</p>
            {selected === "import" && (
              <div className="mt-3 border-t border-border pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1.5">
                  <Label className="text-xs">Template name</Label>
                  <Input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Tour Follow-Up" className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select value={importCategory} onValueChange={(v) => setImportCategory(v as MessageTemplateCategory)} items={MESSAGE_TEMPLATE_CATEGORIES}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{MESSAGE_TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Channel</Label>
                    <Select value={importChannel} onValueChange={(v) => setImportChannel(v as ImportChannel)} items={CHANNEL_OPTIONS}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNEL_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paste your message</Label>
                  <Textarea
                    value={importText} onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste the email or text you already send — from your inbox, a spreadsheet, anywhere."
                    className="min-h-32 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Luv organizes your own wording into a template — it doesn&apos;t rewrite tone or invent content.</p>
                </div>
              </div>
            )}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !selected || pending
              || (selected === "existing" && !sourceTemplateId)
              || (selected === "import" && (!importName.trim() || !importText.trim()))
            }
            onClick={handleApply}
          >
            {pending
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{selected === "import" ? "Importing…" : "Creating…"}</>
              : selected === "import" ? "Import" : selected === "scratch" ? "Continue" : "Duplicate"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
