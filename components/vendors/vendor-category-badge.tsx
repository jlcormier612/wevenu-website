import { Badge } from "@/components/ui/badge";
import { vendorCategoryLabel } from "@/lib/vendors/constants";

export function VendorCategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return <Badge variant="outline">{vendorCategoryLabel(category)}</Badge>;
}
