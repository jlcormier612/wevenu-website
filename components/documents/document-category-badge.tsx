import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/documents/constants";
import type { DocumentCategory } from "@/lib/documents/types";

const VARIANT_MAP: Record<DocumentCategory, "default" | "success" | "warning" | "destructive" | "muted" | "accent"> = {
  contract:      "default",
  insurance:     "warning",
  permit:        "warning",
  inspiration:   "accent",
  floor_plan:    "accent",
  menu:          "muted",
  questionnaire: "muted",
  invoice_copy:  "muted",
  other:         "muted",
};

export function DocumentCategoryBadge({ category }: { category: DocumentCategory }) {
  return <Badge variant={VARIANT_MAP[category]}>{categoryLabel(category)}</Badge>;
}
