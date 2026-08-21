"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { createArticleAction, deleteArticleAction, updateArticleAction } from "@/app/admin/success-library/actions";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GAP_COPY } from "@/lib/dashboard/gap-copy";
import { HELP_GUIDE_AREAS, isHelpGuideCategory } from "@/lib/help-guides/areas";
import type { RelatedFeatureLink, SuccessLibraryArticle, SuccessLibraryArticleInput } from "@/lib/success-library/types";

const GAP_KEYS = Object.keys(GAP_COPY);

function slugify(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function SuccessLibraryForm({ article }: { article?: SuccessLibraryArticle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = React.useState(!!article);

  const [title, setTitle] = React.useState(article?.title ?? "");
  const [slug, setSlug] = React.useState(article?.slug ?? "");
  const [goalCategory, setGoalCategory] = React.useState(
    article?.goalCategory && isHelpGuideCategory(article.goalCategory)
      ? article.goalCategory
      : (article?.goalCategory || HELP_GUIDE_AREAS[0].category),
  );
  const [whyItMatters, setWhyItMatters] = React.useState(article?.whyItMatters ?? "");
  const [whenToUse, setWhenToUse] = React.useState(article?.whenToUse ?? "");
  const [bestPractices, setBestPractices] = React.useState(article?.bestPractices ?? "");
  const [commonMistakes, setCommonMistakes] = React.useState(article?.commonMistakes ?? "");
  const [relatedFeatures, setRelatedFeatures] = React.useState<RelatedFeatureLink[]>(article?.relatedFeatures ?? []);
  const [linkedGapKeys, setLinkedGapKeys] = React.useState<string[]>(article?.linkedGapKeys ?? []);
  const [status, setStatus] = React.useState<"draft" | "published">(article?.status ?? "draft");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function addRelatedFeature() {
    setRelatedFeatures((p) => [...p, { label: "", href: "" }]);
  }
  function updateRelatedFeature(i: number, patch: Partial<RelatedFeatureLink>) {
    setRelatedFeatures((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeRelatedFeature(i: number) {
    setRelatedFeatures((p) => p.filter((_, idx) => idx !== i));
  }

  function toggleGapKey(key: string) {
    setLinkedGapKeys((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  function handleSave(nextStatus?: "draft" | "published") {
    const input: SuccessLibraryArticleInput = {
      slug, title, goalCategory, whyItMatters, whenToUse, bestPractices, commonMistakes,
      relatedFeatures: relatedFeatures.filter((f) => f.label.trim() && f.href.trim()),
      linkedGapKeys, status: nextStatus ?? status,
    };
    startTransition(async () => {
      const result = article
        ? await updateArticleAction(article.id, input)
        : await createArticleAction(input);
      if (result.ok) {
        if (nextStatus) setStatus(nextStatus);
        toast.success(article ? "Saved." : "Article created.");
        if (article) router.refresh();
      } else {
        toast.error(result.message ?? "Could not save this article.");
      }
    });
  }

  function handleDeleteConfirmed() {
    if (!article) return;
    startTransition(async () => {
      const result = await deleteArticleAction(article.id);
      if (result.ok) {
        toast.success("Article deleted.");
        router.push("/admin/success-library");
      } else {
        toast.error(result.message ?? "Could not delete this article.");
        setConfirmDeleteOpen(false);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sl-title">Title</Label>
          <Input id="sl-title" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Booking More Tours" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-slug">Slug</Label>
          <Input id="sl-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="booking-more-tours" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sl-category">Help &amp; Guides area</Label>
        <select
          id="sl-category"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={goalCategory}
          onChange={(e) => setGoalCategory(e.target.value)}
        >
          {HELP_GUIDE_AREAS.map((a) => (
            <option key={a.id} value={a.category}>{a.category}</option>
          ))}
          {article?.goalCategory && !isHelpGuideCategory(article.goalCategory) ? (
            <option value={article.goalCategory}>{article.goalCategory} (legacy)</option>
          ) : null}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sl-why">Why this matters</Label>
        <Textarea id="sl-why" rows={3} value={whyItMatters} onChange={(e) => setWhyItMatters(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sl-when">When to use it</Label>
        <Textarea id="sl-when" rows={3} value={whenToUse} onChange={(e) => setWhenToUse(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sl-best">Best practices</Label>
        <Textarea id="sl-best" rows={4} value={bestPractices} onChange={(e) => setBestPractices(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sl-mistakes">Common mistakes</Label>
        <Textarea id="sl-mistakes" rows={3} value={commonMistakes} onChange={(e) => setCommonMistakes(e.target.value)} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Related features (real deep links)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRelatedFeature}>Add link</Button>
        </div>
        {relatedFeatures.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input placeholder="Label — e.g. Create a package" value={f.label} onChange={(e) => updateRelatedFeature(i, { label: e.target.value })} />
            <Input placeholder="/packages/new" value={f.href} onChange={(e) => updateRelatedFeature(i, { href: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeRelatedFeature(i)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Linked Guided Setup gaps <span className="text-xs font-normal text-muted-foreground">(shown as a secondary "read more" link, never the primary CTA)</span></Label>
        <div className="flex flex-wrap gap-2">
          {GAP_KEYS.map((key) => (
            <button
              key={key} type="button" onClick={() => toggleGapKey(key)}
              className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                linkedGapKeys.includes(key) ? "bg-primary/10 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          {article && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={pending}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => handleSave("draft")} disabled={pending}>Save as draft</Button>
          <Button type="button" onClick={() => handleSave("published")} disabled={pending}>
            {status === "published" ? "Save" : "Publish"}
          </Button>
        </div>
      </div>
      {article && (
        <LibraryDeleteConfirmDialog
          open={confirmDeleteOpen}
          itemName={article.title}
          itemLabel="article"
          pending={pending}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}
    </div>
  );
}
