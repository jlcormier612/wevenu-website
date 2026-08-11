import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { QuestionnaireTemplateList } from "@/components/questionnaire-templates/questionnaire-template-list";
import { QUESTIONNAIRE_FAMILY_MASTERS } from "@/lib/questionnaire-family/definitions";
import { ensureQuestionnaireFamilyForCurrentVenue } from "@/lib/questionnaire-family/provision";
import { getTemplates } from "@/lib/questionnaire-templates/service";

export const metadata: Metadata = { title: "Planning Forms" };

export default async function QuestionnaireTemplatesLibraryPage() {
  await ensureQuestionnaireFamilyForCurrentVenue();
  const templates = await getTemplates(true);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingStarterKeys = QUESTIONNAIRE_FAMILY_MASTERS
    .filter((m) => !presentKeys.has(m.key))
    .map((m) => m.key);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning Forms"
        description="Client Planning Questionnaire, Final Details, and Post-Event Feedback — Hello to Cheers starters you can customize for your venue."
      />
      <QuestionnaireTemplateList templates={templates} missingStarterKeys={missingStarterKeys} />
    </div>
  );
}
