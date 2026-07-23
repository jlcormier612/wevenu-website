import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { getPublishedCategories } from "@/lib/success-library/service";

export const metadata: Metadata = { title: "Luv's Success Library" };

export default async function SuccessLibraryPage() {
  const categories = await getPublishedCategories();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-muted-foreground" /> Luv&apos;s Success Library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What to do, when to do it, and the mistakes worth avoiding — organized by what you&apos;re trying to accomplish, not by feature.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nothing published yet — check back soon.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat.category} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat.category}</p>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {cat.articles.map((a) => (
                  <Link key={a.slug} href={`/success-library/${a.slug}`} className="block px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
                    {a.title}
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
