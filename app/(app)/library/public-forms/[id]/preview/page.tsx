import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicForm } from "@/lib/public-forms/service";
import { publicFormPath } from "@/lib/public-forms/public-url";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const form = await getPublicForm(id);
  return { title: form ? `Preview · ${form.internalName}` : "Public form" };
}

export default async function PublicFormPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await getPublicForm(id);
  if (!form) notFound();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const liveUrl = `${appUrl}${publicFormPath(form.publicKey)}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/library/public-forms" className="text-xs text-muted-foreground hover:underline">
          ← Public Forms
        </Link>
        <PageHeader
          title={form.publicTitle || form.internalName}
          description="Preview of how this form looks. Drafts are not live until you publish."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" render={<Link href={`/library/public-forms/${form.id}`} />}>
                Edit
              </Button>
              {form.status === "published" && (
                <Button variant="outline" render={<a href={liveUrl} target="_blank" rel="noreferrer" />}>
                  Open live form
                </Button>
              )}
            </div>
          }
        />
      </div>
      <Badge variant={form.status === "published" ? "default" : "muted"}>
        {form.status === "published" ? "Published" : form.status === "archived" ? "Archived" : "Draft"}
      </Badge>
      <p className="rounded-sm border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        This form can be shared directly or used as the destination for a QR campaign.{" "}
        <Link href={`/library/public-forms/${form.id}`} className="font-medium text-heading hover:underline">
          Create QR →
        </Link>
      </p>
      {form.description ? <p className="text-sm text-muted-foreground">{form.description}</p> : null}
      <div className="space-y-3 rounded-sm border border-border p-4">
        <p className="text-sm font-medium text-heading">Questions</p>
        {form.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom questions yet.</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {form.questions.map((q) => (
              <li key={q.id}>
                {q.questionText}
                {q.required ? <span className="text-muted-foreground"> (required)</span> : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
