"use client";

import * as React from "react";
import { toast } from "sonner";
import type { VenueMilestone, MilestoneId } from "@/lib/activation/types";
import { markMilestoneShownAction } from "@/app/(app)/dashboard/actions";

const MILESTONE_MESSAGES: Record<MilestoneId, string> = {
  first_couple_portal_open:  "Your first couple just opened their portal.",
  first_vendor_accepted:     "A vendor just accepted their invitation.",
  first_contract_signed:     "Your first contract was just signed.",
  first_payment_received:    "Your first payment just came in.",
  first_team_member_joined:  "A team member just logged in for the first time.",
  activation_70:             "You've reached 70% — your venue is fully operational.",
  fully_connected:           "Your venue is fully connected.",
};

export function MilestoneToast({ milestone }: { milestone: VenueMilestone | null }) {
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (!milestone || firedRef.current) return;
    firedRef.current = true;

    const message = MILESTONE_MESSAGES[milestone.milestoneId];
    if (message) {
      toast.success(message, { duration: 6000 });
    }

    void markMilestoneShownAction(milestone.milestoneId);
  }, [milestone]);

  return null;
}
