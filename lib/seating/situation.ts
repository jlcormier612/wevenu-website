/**
 * Human-facing seating status classification for empty / not-started states.
 * Used by venue Event Day Seating and related surfaces so copy stays coherent.
 */

export type VenueSeatingSituation =
  | "no_floor_plans"
  | "no_shared_for_seating"
  | "choose_plan"
  | "not_started"
  | "private_in_progress"
  | "submitted"
  | "delegated_assistance"
  | "not_authorized";

export type VenueSeatingSituationInput = {
  planCount: number;
  sharedPlanCount: number;
  selectedPlanId: string | null;
  /** Selected plan flags */
  sharedForSeating?: boolean;
  isDelegated?: boolean;
  hasAssignments?: boolean;
  hasSubmission?: boolean;
  notYetSubmitted?: boolean;
  /** Operational payload missing because caller lacks view permission */
  notAuthorized?: boolean;
};

export function classifyVenueSeatingSituation(input: VenueSeatingSituationInput): VenueSeatingSituation {
  if (input.notAuthorized) return "not_authorized";
  if (input.planCount === 0) return "no_floor_plans";
  if (input.sharedPlanCount === 0) return "no_shared_for_seating";
  if (!input.selectedPlanId) return "choose_plan";
  if (input.isDelegated) return "delegated_assistance";
  if (input.hasSubmission && !input.notYetSubmitted) return "submitted";
  if (input.hasAssignments) return "private_in_progress";
  return "not_started";
}

export function venueSeatingSituationCopy(
  situation: VenueSeatingSituation,
  coupleName: string,
): { title: string; body: string } {
  switch (situation) {
    case "not_authorized":
      return {
        title: "You don't have access to seating",
        body: "Ask an Owner or Manager if you need seating access for this event.",
      };
    case "no_floor_plans":
      return {
        title: "There is no floor plan available for seating",
        body: "Create a floor plan for this booking and share it for seating before seating can begin.",
      };
    case "no_shared_for_seating":
      return {
        title: "Floor plan exists, but seating has not been shared yet",
        body: "Use Share for Seating on a floor plan so the client can start assigning guests. The venue does not get seating authority from that alone.",
      };
    case "choose_plan":
      return {
        title: "Choose a floor plan",
        body: "Select which floor plan's seating you want to review. Ceremony and Reception seating are independent.",
      };
    case "not_started":
      return {
        title: "Seating has not started yet",
        body: `${coupleName} can assign guests in their Client Workspace. You'll see the committed seating here after they submit it, or if they ask the venue to assist.`,
      };
    case "private_in_progress":
      return {
        title: `${coupleName} is still working privately on seating`,
        body: "Their live seating chart stays private until they submit it, or until they ask the venue to assist with seating.",
      };
    case "submitted":
      return {
        title: "Seating has been submitted",
        body: "You're viewing the committed seating snapshot. Private client edits after this submit stay private until they resubmit or ask the venue to assist.",
      };
    case "delegated_assistance":
      return {
        title: `${coupleName} has asked the venue to assist with seating`,
        body: "Authorized venue users can update this seating plan while assistance is active. This does not transfer ownership of the seating plan.",
      };
  }
}
