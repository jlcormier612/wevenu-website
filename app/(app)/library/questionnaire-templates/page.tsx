import type { Metadata } from "next";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  NewQuestionnaireSheet,
  QuestionnaireStarterMenu,
  QuestionnaireTemplateList,
} from "@/components/questionnaire-templates/questionnaire-template-list";
import { getEvents } from "@/lib/events/service";
import { QUESTIONNAIRE_FAMILY_MASTERS } from "@/lib/questionnaire-family/definitions";
import { ensureQuestionnaireFamilyForCurrentVenue } from "@/lib/questionnaire-family/provision";
import { getTemplates } from "@/lib/questionnaire-templates/service";

export const metadata: Metadata = { title: "Questionnaires & Feedback" };

export default async function QuestionnaireTemplatesLibraryPage() {
  await ensureQuestionnaireFamilyForCurrentVenue();
  const [templates, events] = await Promise.all([
    getTemplates(true),
    getEvents(),
  ]);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingStarterKeys = QUESTIONNAIRE_FAMILY_MASTERS
    .filter((m) => !presentKeys.has(m.key))
    .map((m) => m.key);

  return (
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Questionnaires & Feedback"
        description="Client Planning Questionnaire, Final Details, and Post-Event Feedback — Hello to Cheers starters you can customize for your venue."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NewQuestionnaireSheet />
            <QuestionnaireStarterMenu
              missingKeys={missingStarterKeys}
              presentKeys={[...presentKeys].filter((k): k is string => Boolean(k))}
            />
          </div>
        }
      />
      <QuestionnaireTemplateList
        templates={templates}
        missingStarterKeys={missingStarterKeys}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
        headerCreate={false}
      />
    </div>
  );
}
