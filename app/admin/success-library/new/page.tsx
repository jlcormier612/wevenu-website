import type { Metadata } from "next";
import Link from "next/link";

import { SuccessLibraryForm } from "@/components/hq/success-library-form";

export const metadata: Metadata = { title: "New Article — Help & Guides" };

export default function NewSuccessLibraryArticlePage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/success-library" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Help &amp; Guides</Link>
      <h1 className="font-heading text-2xl font-semibold text-heading">New Article</h1>
      <SuccessLibraryForm />
    </div>
  );
}
