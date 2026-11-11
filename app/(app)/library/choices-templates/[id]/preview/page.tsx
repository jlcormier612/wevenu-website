import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Choices Templates product removed — selectable authoring lives on Event Order Templates. */
export default async function ChoicesTemplatePreviewRedirectPage({ params }: Props) {
  await params;
  redirect("/library/event-order-templates");
}
