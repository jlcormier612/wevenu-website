"use client";

import * as React from "react";
import { HelpCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createVendorFaqAction,
  deleteVendorFaqAction,
  updateVendorFaqAction,
} from "@/app/vendor/(workspace)/faqs/actions";
import type { VendorFaq, VendorFaqInput } from "@/lib/vendors/types";

const EMPTY_INPUT: VendorFaqInput = { question: "", answer: "" };

function FaqForm({
  initial = EMPTY_INPUT, onSave, onCancel, saving,
}: { initial?: VendorFaqInput; onSave: (input: VendorFaqInput) => void; onCancel: () => void; saving: boolean }) {
  const [form, setForm] = React.useState<VendorFaqInput>(initial);

  return (
    <div className="rounded-sm border border-primary/30 bg-card p-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="faq-question">Question <span className="text-destructive">*</span></Label>
        <Input id="faq-question" value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} placeholder="e.g. Do you travel outside the area?" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="faq-answer">Answer <span className="text-destructive">*</span></Label>
        <Textarea id="faq-answer" rows={2} value={form.answer} onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))} placeholder="Your answer…" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="button" size="sm" onClick={() => onSave(form)} disabled={saving || !form.question.trim() || !form.answer.trim()}>
          {saving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save FAQ"}
        </Button>
      </div>
    </div>
  );
}

export function VendorFaqsManager({ faqs: initial }: { faqs: VendorFaq[] }) {
  const [faqs, setFaqs] = React.useState<VendorFaq[]>(initial);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [addingSaving, setAddingSaving] = React.useState(false);

  async function handleCreate(input: VendorFaqInput) {
    setAddingSaving(true);
    try {
      const result = await createVendorFaqAction(input);
      if (!result.ok) { toast.error(result.message ?? "Could not create FAQ."); return; }
      toast.success("FAQ added.");
      setShowAdd(false);
      const newFaq: VendorFaq = {
        id: result.faqId ?? crypto.randomUUID(), vendorId: "",
        question: input.question, answer: input.answer,
        sortOrder: faqs.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setFaqs((f) => [...f, newFaq]);
    } finally {
      setAddingSaving(false);
    }
  }

  async function handleUpdate(id: string, input: VendorFaqInput) {
    setSavingId(id);
    try {
      const result = await updateVendorFaqAction(id, input);
      if (!result.ok) { toast.error(result.message ?? "Could not update FAQ."); return; }
      toast.success("FAQ updated.");
      setEditingId(null);
      setFaqs((fs) => fs.map((f) => f.id === id ? { ...f, question: input.question, answer: input.answer } : f));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id);
    try {
      const result = await deleteVendorFaqAction(id);
      if (!result.ok) { toast.error(result.message ?? "Could not delete."); return; }
      toast.success("FAQ deleted.");
      setFaqs((fs) => fs.filter((f) => f.id !== id));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {faqs.length === 0 && !showAdd ? (
        <div className="rounded-sm border border-dashed border-border py-12 text-center">
          <HelpCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No FAQs yet</p>
          <p className="text-xs mt-1 text-muted-foreground mb-4">Answer the questions couples ask most.</p>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add FAQ</Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {faqs.map((faq) => (
              editingId === faq.id ? (
                <FaqForm key={faq.id} initial={{ question: faq.question, answer: faq.answer }}
                  onSave={(input) => handleUpdate(faq.id, input)} onCancel={() => setEditingId(null)} saving={savingId === faq.id} />
              ) : (
                <div key={faq.id} className="flex items-start gap-3 rounded-sm border border-border bg-card p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{faq.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{faq.answer}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(faq.id)} disabled={savingId === faq.id}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(faq.id)} disabled={savingId === faq.id}>
                      {savingId === faq.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )
            ))}
          </div>

          {showAdd ? (
            <FaqForm onSave={handleCreate} onCancel={() => setShowAdd(false)} saving={addingSaving} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add FAQ</Button>
          )}
        </>
      )}
    </div>
  );
}
