/**
 * Hello to Cheers Questionnaire Family — approved masters + field registry.
 *
 * CONTENT IS PRODUCT-APPROVED. Do not rewrite welcome copy or question wording.
 *
 * Storage destinations (source-of-truth rule):
 * - event.* / vendor assignments / timeline: authoritative systems
 * - event_questionnaires columns: operational fields already owned by the row
 * - additional.family: narrative / confirmation answers that are not duplicates
 *   of those systems
 */

export type QuestionnaireKind = "client_planning" | "final_details" | "post_event_feedback";

export type QuestionnaireFieldType =
  | "long_text"
  | "short_text"
  | "single_choice"
  | "rating_1_5"
  | "guest_count_confirm"
  | "known_timing_confirm"
  | "known_ceremony_confirm"
  | "vendor_review"
  | "people_notes"
  | "conditional_long_text";

export type QuestionnaireFieldDef = {
  id: string;
  section: string;
  label: string;
  helper?: string;
  required: boolean;
  type: QuestionnaireFieldType;
  options?: { value: string; label: string }[];
  /** When choice equals one of these, show followUpId. */
  showFollowUpWhen?: string[];
  followUpId?: string;
  followUpLabel?: string;
  /**
   * Where the answer is persisted.
   * family → additional.family[id]
   * column → event_questionnaires.<column>
   * event_guest_count → events.guest_count (via confirm flow)
   * display_only → never stored as a new fact
   */
  destination: "family" | "column" | "event_guest_count" | "display_only";
  column?: string;
  /** Existing source for "use what we know" presentation */
  existingSource?: string;
};

export type QuestionnaireFamilyMaster = {
  key: "QST-CP" | "QST-FD" | "QST-PE";
  kind: QuestionnaireKind;
  name: string;
  description: string;
  welcomeTitle: string;
  welcomeBody: string[];
  fields: QuestionnaireFieldDef[];
};

const RATING_OPTIONS = [
  { value: "1", label: "1 — Very disappointing" },
  { value: "2", label: "2 — Needs improvement" },
  { value: "3", label: "3 — Good" },
  { value: "4", label: "4 — Very good" },
  { value: "5", label: "5 — Exceptional" },
];

export const QUESTIONNAIRE_FAMILY_MASTERS: readonly QuestionnaireFamilyMaster[] = [
  {
    key: "QST-CP",
    kind: "client_planning",
    name: "Client Planning Questionnaire",
    description: "Begin planning after booking.",
    welcomeTitle: "Let's Start Planning",
    welcomeBody: [
      "Your date is booked, and we're excited to start planning with you.",
      "We already have many of the basics from your booking. This questionnaire helps us learn more about your plans, priorities, and the people who will be helping bring your celebration together.",
      "Don't worry if you don't have everything figured out yet. You can save your progress and come back to it as your plans take shape.",
    ],
    fields: [
      {
        id: "excited_about", section: "Your Plans",
        label: "What are you most excited about for your celebration?",
        helper: "Tell us a little about what you're looking forward to most. It could be a particular part of the day, the atmosphere you're hoping to create, a family tradition, or simply what you want your guests to remember.",
        required: false, type: "long_text", destination: "family", existingSource: "none — early vision",
      },
      {
        id: "priorities", section: "Your Plans",
        label: "Are there any priorities you'd like our team to keep in mind as we plan together?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "decisions_in_progress", section: "Your Plans",
        label: "Are there any decisions you're still working through?",
        helper: "If there are pieces of your celebration you haven't decided yet, that's completely fine. Let us know what you're still figuring out so we can help where we can.",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "planning_people", section: "Your People",
        label: "Who should we know about as we begin planning?",
        helper: "Share people who help with planning (planner, day-of contact, family). If they're already in your celebration contacts or vendor list, mention that — we'll use what's already on file rather than creating duplicates.",
        required: false, type: "people_notes", destination: "family",
        existingSource: "clients / event vendor assignments (display when present)",
      },
      {
        id: "info_recipients", section: "Your People",
        label: "Is there anyone else who should receive important planning information?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "vendors_selected_status", section: "Vendors & Planning",
        label: "Have you selected any vendors yet?",
        required: false, type: "single_choice",
        options: [
          { value: "yes", label: "Yes" },
          { value: "some", label: "Some" },
          { value: "not_yet", label: "Not yet" },
        ],
        showFollowUpWhen: ["yes", "some"],
        followUpId: "vendors_already_selected",
        followUpLabel: "Which vendors have you already selected?",
        destination: "family",
        existingSource: "event_vendor_assignments",
      },
      {
        id: "vendors_already_selected", section: "Vendors & Planning",
        label: "Which vendors have you already selected?",
        helper: "List names and roles. Your venue will connect these to your Vendor Network — this does not create a separate vendor list.",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "vendors_still_looking", section: "Vendors & Planning",
        label: "Are there vendors or services you're still looking for?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "ceremony_notes_early", section: "Ceremony & Reception",
        label: "We have your ceremony included in your event plans. Is there anything you'd like us to know about how you'd like the ceremony to work?",
        helper: "You might mention ceremony format, cultural or religious traditions, a special processional, accessibility considerations, or family participation — only if relevant.",
        required: false, type: "long_text", destination: "family",
        existingSource: "events / packages (ceremony presence)",
      },
      {
        id: "reception_notes_early", section: "Ceremony & Reception",
        label: "Is there anything you're already thinking about for your reception that you'd like us to know?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "food_beverage_status", section: "Food & Hospitality",
        label: "Have you started making decisions about food and beverage?",
        required: false, type: "single_choice",
        options: [
          { value: "yes", label: "Yes" },
          { value: "some", label: "Some decisions made" },
          { value: "not_yet", label: "Not yet" },
          { value: "not_applicable", label: "Not applicable" },
        ],
        showFollowUpWhen: ["yes", "some"],
        followUpId: "food_beverage_notes",
        followUpLabel: "Anything you'd like our team to know about your food and beverage plans?",
        destination: "family",
      },
      {
        id: "food_beverage_notes", section: "Food & Hospitality",
        label: "Anything you'd like our team to know about your food and beverage plans?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "dietary_hospitality", section: "Food & Hospitality",
        label: "Are there any dietary, allergy, or hospitality considerations we should be aware of?",
        required: false, type: "long_text", destination: "column", column: "meal_notes",
      },
      {
        id: "help_with_next", section: "What Comes Next",
        label: "Is there anything you'd like help with as you continue planning?",
        helper: "You don't have to have everything figured out yet. Tell us what's on your mind and we'll help point you in the right direction.",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "anything_else_cp", section: "What Comes Next",
        label: "Is there anything else you'd like our team to know?",
        required: false, type: "long_text", destination: "family",
      },
    ],
  },
  {
    key: "QST-FD",
    kind: "final_details",
    name: "Final Details",
    description: "Confirm execution details closer to the event.",
    welcomeTitle: "We're getting close!",
    welcomeBody: [
      "Your celebration is coming up, and we're getting everything ready on our side.",
      "We already have your booking and much of your planning information. This final set of details helps us confirm what's changed, fill in the remaining gaps, and make sure our team is prepared for your day.",
      "Please take your time. You can save your progress and return later.",
    ],
    fields: [
      {
        id: "guest_count_confirm", section: "Confirm Your Plans",
        label: "Guest count",
        required: true, type: "guest_count_confirm", destination: "event_guest_count",
        existingSource: "events.guest_count",
      },
      {
        id: "timing_confirm", section: "Confirm Your Plans",
        label: "Here's the schedule we currently have for your event. Is anything changing?",
        required: false, type: "known_timing_confirm", destination: "column",
        existingSource: "event_questionnaires ceremony/reception times + timeline when present",
      },
      {
        id: "ceremony_confirm", section: "Confirm Your Plans",
        label: "Here's what we currently have planned for your ceremony. Is anything changing?",
        required: false, type: "known_ceremony_confirm", destination: "family",
        existingSource: "ceremony location/time on questionnaire + event context",
      },
      {
        id: "primary_day_of_contact", section: "Day-of Contacts",
        label: "Who will be your primary day-of contact?",
        required: true, type: "short_text", destination: "family",
        existingSource: "client primary contact displayed as starting point",
      },
      {
        id: "emergency_contact", section: "Day-of Contacts",
        label: "Is there an emergency contact we should have on file?",
        required: true, type: "short_text", destination: "column", column: "emergency_contact_name",
        helper: "Name. Add phone in the next field.",
      },
      {
        id: "emergency_contact_phone", section: "Day-of Contacts",
        label: "Emergency contact phone",
        required: true, type: "short_text", destination: "column", column: "emergency_contact_phone",
      },
      {
        id: "other_coordinator", section: "Day-of Contacts",
        label: "Is someone else coordinating your event?",
        required: false, type: "single_choice",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
        showFollowUpWhen: ["yes"],
        followUpId: "other_coordinator_who",
        followUpLabel: "Who should our team coordinate with?",
        destination: "family",
      },
      {
        id: "other_coordinator_who", section: "Day-of Contacts",
        label: "Who should our team coordinate with?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "vendors_all_selected", section: "Vendors & Logistics",
        label: "Are all of your vendors selected?",
        required: false, type: "single_choice",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "some", label: "Some" },
        ],
        destination: "family",
      },
      {
        id: "vendor_review", section: "Vendors & Logistics",
        label: "We've listed the vendors we currently have on file below. Please review them and add or update anything that's missing.",
        required: false, type: "vendor_review", destination: "family",
        existingSource: "event_vendor_assignments",
      },
      {
        id: "vendor_arrival_notes", section: "Vendors & Logistics",
        label: "Are there any vendor arrival or setup details we should know?",
        required: false, type: "long_text", destination: "column", column: "vendor_notes",
      },
      {
        id: "dietary_restrictions", section: "Food & Guest Needs",
        label: "Are there dietary restrictions, allergies, or special meal considerations our team should know about?",
        required: false, type: "long_text", destination: "column", column: "meal_notes",
      },
      {
        id: "accessibility_needs", section: "Food & Guest Needs",
        label: "Are there accessibility needs we should prepare for?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "guest_care", section: "Food & Guest Needs",
        label: "Is there anything special about your guests that would help us take better care of them?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "ceremony_traditions", section: "Ceremony, Reception & Special Moments",
        label: "Are there any special ceremony traditions or moments we should plan for?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "special_moments", section: "Ceremony, Reception & Special Moments",
        label: "What special moments are important to you?",
        helper: "For example: first dance, parent dances, speeches, cultural traditions, anniversary recognition, or other moments.",
        required: false, type: "long_text", destination: "column", column: "parent_dances",
      },
      {
        id: "music_moments", section: "Ceremony, Reception & Special Moments",
        label: "Are there any songs or music moments you'd like us to know about?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "decor_setup", section: "Final Notes",
        label: "Are there any décor or setup requests we should prepare for?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "venue_requests", section: "Final Notes",
        label: "Are there any venue-specific requests or questions you'd like us to know about?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "booking_changes", section: "Final Notes",
        label: "Has anything changed since you originally booked?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "worries_help", section: "Final Notes",
        label: "Is there anything you're worried about or would like help with before your event?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "anything_else_fd", section: "Final Notes",
        label: "Is there anything else you'd like our team to know?",
        required: false, type: "long_text", destination: "column", column: "special_requests",
      },
    ],
  },
  {
    key: "QST-PE",
    kind: "post_event_feedback",
    name: "Post-Event Feedback",
    description: "Gather customer feedback after the event.",
    welcomeTitle: "Thank you for celebrating with us",
    welcomeBody: [
      "We hope you had a wonderful celebration and that the day turned out the way you imagined.",
      "We'd love to hear how everything felt from your perspective. Your feedback helps us understand what we're doing well and where we can make the experience even better for future couples.",
    ],
    fields: [
      {
        id: "team_rating", section: "Your Experience",
        label: "How did your experience with our team feel?",
        required: true, type: "rating_1_5", options: RATING_OPTIONS, destination: "family",
      },
      {
        id: "did_well", section: "Your Experience",
        label: "What did we do especially well?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "could_improve", section: "Your Experience",
        label: "Was there anything we could have done better?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "venue_rating", section: "Your Experience",
        label: "How did your experience with the venue itself feel?",
        required: true, type: "rating_1_5", options: RATING_OPTIONS, destination: "family",
      },
      {
        id: "future_couples_note", section: "Your Experience",
        label: "Is there anything about the venue or planning experience you think future couples should know?",
        required: false, type: "long_text", destination: "family",
      },
      {
        id: "recommend", section: "Your Experience",
        label: "Would you recommend {{venue_name}} to another couple?",
        required: true, type: "single_choice",
        options: [
          { value: "yes", label: "Yes" },
          { value: "maybe", label: "Maybe" },
          { value: "no", label: "No" },
        ],
        destination: "family",
      },
      {
        id: "share_review", section: "Your Experience",
        label: "Would you be comfortable sharing a review publicly?",
        required: true, type: "single_choice",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
        destination: "family",
        existingSource: "venues.public_review_url (shown only when Yes + URL configured)",
      },
      {
        id: "anything_else_pe", section: "Your Experience",
        label: "Is there anything else you'd like us to know?",
        required: false, type: "long_text", destination: "family",
      },
    ],
  },
] as const;

export function getQuestionnaireMaster(key: string): QuestionnaireFamilyMaster | undefined {
  return QUESTIONNAIRE_FAMILY_MASTERS.find((m) => m.key === key);
}

export function getQuestionnaireMasterByKind(kind: QuestionnaireKind): QuestionnaireFamilyMaster {
  const m = QUESTIONNAIRE_FAMILY_MASTERS.find((x) => x.kind === kind);
  if (!m) throw new Error(`Unknown questionnaire kind: ${kind}`);
  return m;
}

export function masterIncludedFieldIds(master: QuestionnaireFamilyMaster): string[] {
  return master.fields.map((f) => f.id);
}

export function masterRequiredFieldIds(master: QuestionnaireFamilyMaster): string[] {
  return master.fields.filter((f) => f.required).map((f) => f.id);
}

export function kindLabel(kind: QuestionnaireKind): string {
  return getQuestionnaireMasterByKind(kind).name;
}
