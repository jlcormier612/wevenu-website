import type { HostedEventTypeValue } from "@/lib/setup-hub/phase-b1-event-types";

export const EXPERIENCE_PREPARE_INTRO =
  "Choose what you'd like to have ready when you create a new event. You can always make changes for an individual celebration later.";

export const EXPERIENCE_FAMILY_COPY: Record<
  HostedEventTypeValue,
  {
    cardTitle: string;
    cardDescription: string;
    prepareAction: string;
    reviewAction: string;
    pageHeading: string;
    createAction: string;
    suggestedName: string;
  }
> = {
  wedding: {
    cardTitle: "Weddings",
    cardDescription:
      "Prepare the planning experience you'll use for weddings, from tasks and timelines to the resources you share with couples.",
    prepareAction: "Prepare weddings",
    reviewAction: "Review experience",
    pageHeading: "Prepare your wedding experience",
    createAction: "Create wedding setup",
    suggestedName: "Standard Wedding Setup",
  },
  corporate: {
    cardTitle: "Corporate events",
    cardDescription:
      "Prepare a planning experience for meetings, company celebrations, and other corporate gatherings.",
    prepareAction: "Prepare corporate events",
    reviewAction: "Review experience",
    pageHeading: "Prepare your corporate event experience",
    createAction: "Create corporate event setup",
    suggestedName: "Corporate Event Setup",
  },
  social_event: {
    cardTitle: "Social celebrations",
    cardDescription:
      "Prepare a flexible planning experience for birthdays, showers, quinceañeras, and other celebrations.",
    prepareAction: "Prepare social celebrations",
    reviewAction: "Review experience",
    pageHeading: "Prepare your social celebration experience",
    createAction: "Create social celebration setup",
    suggestedName: "Social Celebration Setup",
  },
};

export const PLANNING_TOOL_COPY = {
  planning: {
    title: "Planning",
    description: "Organize the tasks your team and clients need to complete.",
  },
  timeline: {
    title: "Timeline",
    description: "Prepare the schedule and important moments for the event.",
  },
  floor_plans: {
    title: "Floor plans",
    description: "Plan room layouts and seating when your venue uses them.",
  },
  vendors: {
    title: "Vendors",
    description: "Keep vendor information and coordination connected to the event.",
  },
  questionnaires: {
    title: "Questionnaires",
    description: "Gather the details you need from clients as they plan.",
  },
} as const;

export const EXPERIENCE_PLANNING_STEPS = [
  "planning",
  "timeline",
  "floor_plans",
  "vendors",
  "questionnaires",
] as const;

export type ExperiencePlanningStep = (typeof EXPERIENCE_PLANNING_STEPS)[number];
