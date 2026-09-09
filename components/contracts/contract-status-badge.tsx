import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { deriveContractSigningUiState } from "@/lib/contracts/signers";
import type { Contract, ContractStatus } from "@/lib/contracts/types";

const STATUS_VARIANT: Record<ContractStatus, BadgeVariant> = {
  draft:     "muted",
  sent:      "default",
  signed:    "success",
  cancelled: "destructive",
  expired:   "warning",
};

/**
 * Progressive human-facing status. Prefer signing summary when provided so
 * Draft vs Ready to send is honest; fall back to coarse status labels.
 */
export function ContractStatusBadge({
  status,
  executionOrigin,
  venueSigned,
  requiredClientTotal,
  requiredClientSigned,
  expiresAt,
}: {
  status: ContractStatus;
  executionOrigin?: Contract["executionOrigin"];
  venueSigned?: boolean;
  requiredClientTotal?: number;
  requiredClientSigned?: number;
  expiresAt?: string | null;
}) {
  if (status === "signed" && executionOrigin === "external") {
    return <Badge variant="success">Signed outside HTC</Badge>;
  }

  const progressive = deriveContractSigningUiState({
    status,
    venueSigned: venueSigned ?? false,
    requiredClientTotal: requiredClientTotal ?? 1,
    requiredClientSigned: requiredClientSigned ?? 0,
    expiresAt: expiresAt ?? null,
  });

  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {progressive.label}
    </Badge>
  );
}
