"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createTemplateAction, deleteTemplateAction, seedDefaultTemplateAction } from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlaybookTemplate } from "@/lib/playbooks/types";

export function PlaybooksSection({ initialTemplates }: { initialTemplates: PlaybookTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [showAdd, setShowAdd] = React.useState(false);
  const [name, setName] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [adding, startAdd] = React.useTransition();
  const [seeding, startSeed] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function handleSeed() {
    startSeed(async () => {
      const result = await seedDefaultTemplateAction();
      if (result.ok) { toast.success("Default Wedding template created."); router.refresh(); }
      else toast.error(result.message ?? "Could not create template.");
    });
  }

  function handleAdd() {
    if (!name.trim()) return;
    startAdd(async () => {
      const result = await createTemplateAction(name.trim(), eventType.trim() || null, null);
      if (result.ok) {
        toast.success("Template created.");
        setTemplates((p) => [...p, { id: result.templateId, venueId: "", name: name.trim(), eventType: eventType.trim() || null, isDefault: false, description: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        setName(""); setEventType(""); setShowAdd(false);
        router.refresh();
      } else toast.error(result.message ?? "Could not create template.");
    });
  }

  async function handleDelete(id: string, tname: string) {
    if (!confirm(`Delete "${tname}"? All tasks will be removed.`)) return;
    setDeletingId(id);
    const result = await deleteTemplateAction(id);
    setDeletingId(null);
    if (result.ok) { setTemplates((p) => p.filter((t) => t.id !== id)); router.refresh(); }
    else toast.error(result.message ?? "Could not delete template.");
  }

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center space-y-3">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-heading">No playbook templates yet</p>
          <p className="text-xs text-muted-foreground">Create templates to auto-generate event tasks with real due dates.</p>
          <Button type="button" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Creating…</> : "Create default Wedding template"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <Link href={`/library/playbooks/${t.id}`} className="text-sm font-medium text-heading hover:text-primary transition-colors">
                  {t.name}
                </Link>
                {t.eventType && <span className="ml-2 text-xs text-muted-foreground">· {t.eventType.replace(/_/g, " ")}</span>}
              </div>
              {t.isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
              <button type="button" onClick={() => handleDelete(t.id, t.name)}
                disabled={deletingId === t.id}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive transition-opacity">
                {deletingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="rounded-xl border border-ring bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Template name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard Wedding" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Event type <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="wedding, corporate_event…" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} disabled={adding}>Cancel</Button>
            <Button type="button" size="sm" disabled={!name.trim() || adding} onClick={handleAdd}>
              {adding ? "Creating…" : "Create Template"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New Template
        </Button>
      )}
    </div>
  );
}
