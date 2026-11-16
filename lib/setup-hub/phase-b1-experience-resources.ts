import type { SetupDecisions, SetupStepKey } from "@/lib/event-setup/state";
import { setupStepPresentation } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";
import { profileHardConfigGaps } from "@/lib/event-setup/profile-config-gaps";
import {
  EXPERIENCE_PLANNING_STEPS,
  PLANNING_TOOL_COPY,
  type ExperiencePlanningStep,
} from "@/lib/setup-hub/phase-b1-experience-copy";
import {
  experiencePrepareReturn,
  withSetupHubReturn,
} from "@/lib/setup-hub/phase-b1-routes";

export type NamedResource = {
  id: string;
  name: string;
  sourceMasterKey?: string | null;
};

export type ExperienceResourceRow = {
  id: string;
  name: string;
  purpose: string;
  designation: "Starter" | "Venue-created" | null;
  status: "Needs attention" | "Starter ready for you" | "Available" | null;
  previewHref: string | null;
  customizeHref: string | null;
  manageHref: string;
};

export type ExperienceToolRow = {
  step: ExperiencePlanningStep;
  title: string;
  description: string;
  inclusion: "Included" | "Optional" | "Not included";
  resources: ExperienceResourceRow[];
  attention: string | null;
};

function designation(item: NamedResource | undefined): "Starter" | "Venue-created" | null {
  if (!item) return null;
  return item.sourceMasterKey ? "Starter" : "Venue-created";
}

function lookup(items: NamedResource[], id: string | null | undefined): NamedResource | undefined {
  if (!id) return undefined;
  return items.find((item) => item.id === id);
}

function libraryHref(
  path: string,
  eventType: string,
  heading: string,
): string {
  return withSetupHubReturn(path, "event-experiences", experiencePrepareReturn(eventType, heading));
}

function resourceRow(input: {
  item: NamedResource | undefined;
  fallbackName: string;
  purpose: string;
  previewPath: (id: string) => string;
  customizePath: (id: string) => string;
  managePath: string;
  eventType: string;
  heading: string;
  missing: boolean;
}): ExperienceResourceRow {
  const manageHref = libraryHref(input.managePath, input.eventType, input.heading);
  if (!input.item) {
    return {
      id: input.fallbackName,
      name: input.fallbackName,
      purpose: input.purpose,
      designation: null,
      status: input.missing ? "Needs attention" : null,
      previewHref: null,
      customizeHref: null,
      manageHref,
    };
  }
  return {
    id: input.item.id,
    name: input.item.name,
    purpose: input.purpose,
    designation: designation(input.item),
    status: input.item.sourceMasterKey ? "Starter ready for you" : "Available",
    previewHref: libraryHref(input.previewPath(input.item.id), input.eventType, input.heading),
    customizeHref: libraryHref(input.customizePath(input.item.id), input.eventType, input.heading),
    manageHref,
  };
}

export function experienceToolRows(input: {
  eventType: string;
  heading: string;
  decisions: SetupDecisions;
  refs: SetupTemplateRefs;
  playbooks: NamedResource[];
  timelines: NamedResource[];
  floorPlans: NamedResource[];
  questionnaires: NamedResource[];
  vendors: NamedResource[];
  spaceCount: number;
}): ExperienceToolRow[] {
  const gaps = new Set(
    profileHardConfigGaps(input.decisions, input.refs).map((gap) => gap.step as SetupStepKey),
  );
  return EXPERIENCE_PLANNING_STEPS.map((step): ExperienceToolRow => {
    const copy = PLANNING_TOOL_COPY[step];
    const presentation = setupStepPresentation(input.decisions[step]);
    const inclusion: ExperienceToolRow["inclusion"] =
      presentation === "included"
        ? "Included"
        : presentation === "skipped"
          ? "Not included"
          : "Optional";
    const included = presentation === "included";
    const showResources = included || (step === "floor_plans" && presentation !== "skipped");
    const resources: ExperienceResourceRow[] = [];
    let attention: string | null = null;

    if (!showResources) {
      return { step, title: copy.title, description: copy.description, inclusion, resources, attention };
    }

    if (step === "planning") {
      resources.push(
        resourceRow({
          item: lookup(input.playbooks, input.refs.planningPlaybookTemplateId),
          fallbackName: "Client planning template",
          purpose: "A starting task list your clients can follow.",
          previewPath: (id) => `/library/playbooks/${id}/preview`,
          customizePath: (id) => `/library/playbooks/${id}`,
          managePath: "/library/playbooks",
          eventType: input.eventType,
          heading: input.heading,
          missing: !input.refs.planningPlaybookTemplateId,
        }),
        resourceRow({
          item: lookup(input.playbooks, input.refs.venuePlanningPlaybookTemplateId),
          fallbackName: "Venue planning template",
          purpose: "A starting task list for your team.",
          previewPath: (id) => `/library/playbooks/${id}/preview`,
          customizePath: (id) => `/library/playbooks/${id}`,
          managePath: "/library/playbooks",
          eventType: input.eventType,
          heading: input.heading,
          missing: !input.refs.venuePlanningPlaybookTemplateId,
        }),
      );
    }
    if (step === "timeline") {
      resources.push(
        resourceRow({
          item: lookup(input.timelines, input.refs.timelineTemplateId),
          fallbackName: "Timeline template",
          purpose: "A starting schedule for this type of event.",
          previewPath: (id) => `/library/timeline-templates/${id}/preview`,
          customizePath: (id) => `/library/timeline-templates/${id}`,
          managePath: "/library/timeline-templates",
          eventType: input.eventType,
          heading: input.heading,
          missing: !input.refs.timelineTemplateId,
        }),
      );
    }
    if (step === "floor_plans") {
      if (input.spaceCount === 0) {
        attention = "Floor plans need spaces configured before they can be used for new events.";
      }
      const ids = [
        input.refs.defaultFloorPlanTemplateId,
        ...(input.refs.floorPlanTemplateIds ?? []),
      ].filter((id): id is string => Boolean(id));
      const unique = [...new Set(ids)];
      if (unique.length === 0) {
        resources.push(
          resourceRow({
            item: undefined,
            fallbackName: "Floor plan template",
            purpose: "A starting room layout you can adjust for this space.",
            previewPath: () => "/library/floor-plan-templates",
            customizePath: () => "/library/floor-plan-templates",
            managePath: "/library/floor-plan-templates",
            eventType: input.eventType,
            heading: input.heading,
            missing: true,
          }),
        );
      } else {
        for (const id of unique) {
          resources.push(
            resourceRow({
              item: lookup(input.floorPlans, id),
              fallbackName: "Floor plan template",
              purpose: "A starting room layout you can adjust for this space.",
              previewPath: (itemId) => `/library/floor-plan-templates/${itemId}/preview`,
              customizePath: (itemId) => `/library/floor-plan-templates/${itemId}`,
              managePath: "/library/floor-plan-templates",
              eventType: input.eventType,
              heading: input.heading,
              missing: !lookup(input.floorPlans, id),
            }),
          );
        }
      }
    }
    if (step === "vendors") {
      const vendorIds = [
        ...(input.refs.requiredVendorIds ?? []),
        ...(input.refs.recommendedVendorIds ?? []),
      ];
      const unique = [...new Set(vendorIds)];
      if (unique.length === 0) {
        resources.push({
          id: "vendor-network",
          name: "Vendor network",
          purpose: "Vendor details connected to this experience.",
          designation: null,
          status: "Available",
          previewHref: null,
          customizeHref: null,
          manageHref: libraryHref("/vendors", input.eventType, input.heading),
        });
      } else {
        for (const id of unique) {
          resources.push(
            resourceRow({
              item: lookup(input.vendors, id),
              fallbackName: "Vendor",
              purpose: "Vendor details connected to this experience.",
              previewPath: (itemId) => `/vendors/${itemId}`,
              customizePath: (itemId) => `/vendors/${itemId}/edit`,
              managePath: "/vendors",
              eventType: input.eventType,
              heading: input.heading,
              missing: !lookup(input.vendors, id),
            }),
          );
        }
      }
    }
    if (step === "questionnaires") {
      const ids = input.refs.questionnaireTemplateIds ?? [];
      if (ids.length === 0) {
        resources.push(
          resourceRow({
            item: undefined,
            fallbackName: "Questionnaire template",
            purpose: "Questions to gather planning details from clients.",
            previewPath: () => "/library/questionnaire-templates",
            customizePath: () => "/library/questionnaire-templates",
            managePath: "/library/questionnaire-templates",
            eventType: input.eventType,
            heading: input.heading,
            missing: true,
          }),
        );
      } else {
        for (const id of ids) {
          resources.push(
            resourceRow({
              item: lookup(input.questionnaires, id),
              fallbackName: "Questionnaire template",
              purpose: "Questions to gather planning details from clients.",
              previewPath: (itemId) => `/library/questionnaire-templates/${itemId}/preview`,
              customizePath: (itemId) => `/library/questionnaire-templates/${itemId}`,
              managePath: "/library/questionnaire-templates",
              eventType: input.eventType,
              heading: input.heading,
              missing: !lookup(input.questionnaires, id),
            }),
          );
        }
      }
    }

    if (gaps.has(step) && !attention) {
      attention = "This included tool still needs a starting resource selected.";
    }

    return { step, title: copy.title, description: copy.description, inclusion, resources, attention };
  });
}
