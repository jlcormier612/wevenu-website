import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SuccessLibraryForm } from "@/components/hq/success-library-form";
import { getArticleForAdmin } from "@/lib/success-library/service";

export const metadata: Metadata = { title: "Edit Article — Success Library" };

type Props = { params: Promise<{ id: string }> };

export default async function EditSuccessLibraryArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleForAdmin(id);
  if (!article) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/success-library" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Success Library</Link>
      <h1 className="font-heading text-2xl font-semibold text-heading">{article.title}</h1>
      <SuccessLibraryForm article={article} />
    </div>
  );
}
