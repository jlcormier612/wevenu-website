/**
 * Recovery actions for outbound delivery failures — only what the product can do.
 */
import { isDeliveryFailureStatus } from "@/lib/communication/status-labels";

export type DeliveryRecoveryActionId =
  | "retry"
  | "use_email"
  | "use_sms"
  | "open_client"
  | "follow_up";

export type DeliveryRecoveryAction = {
  id: DeliveryRecoveryActionId;
  label: string;
};

export function deliveryRecoveryActions(input: {
  channel: string;
  status: string | null | undefined;
  leadId: string | null;
  clientId: string | null;
}): DeliveryRecoveryAction[] {
  if (!isDeliveryFailureStatus(input.status)) return [];

  const actions: DeliveryRecoveryAction[] = [
    { id: "retry", label: "Retry" },
  ];

  if (input.channel === "sms") {
    actions.push({ id: "use_email", label: "Use email" });
  } else if (input.channel === "email") {
    actions.push({ id: "use_sms", label: "Use text" });
  }

  if (input.clientId || input.leadId) {
    actions.push({ id: "open_client", label: "Open client details" });
  }

  if (input.leadId) {
    actions.push({ id: "follow_up", label: "Follow up later" });
  }

  return actions;
}
