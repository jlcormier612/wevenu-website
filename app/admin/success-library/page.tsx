import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAllArticlesForAdmin } from "@/lib/success-library/service";

export const metadata: Metadata = { title: "Help & Guides — Hello to Cheers HQ" };

export default async function SuccessLibraryAdminPage() {
  const articles = await getAllArticlesForAdmin();
  const byCategory = new Map<string, typeof articles>();
  for (const a of articles) {
    const list = byCategory.get(a.goalCategory) ?? [];
    list.push(a);
    byCategory.set(a.goalCategory, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-heading">Help &amp; Guides</h1>
          <p className="text-sm text-muted-foreground">
            HQ-authored venue help content. Published articles appear in Help &amp; Guides for every venue.
          </p>
        </div>
        <Button render={<Link href="/admin/success-library/new" />}>New Article</Button>
      </div>

      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-16">
          <p className="text-3xl">📚</p>
          <p className="text-sm font-medium text-heading">No articles yet</p>
          <p className="text-xs text-muted-foreground">Create the first one to get the Library started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byCategory.entries()).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
              <div className="rounded-xl border divide-y">
                {items.map((a) => (
                  <Link key={a.id} href={`/admin/success-library/${a.id}/edit`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-heading truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">/{a.slug} · v{a.version}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.status === "published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {a.status === "published" ? "Published" : "Draft"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
