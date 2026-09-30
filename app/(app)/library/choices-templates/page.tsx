import { redirect } from "next/navigation";

/** Choices Templates product removed — selectable authoring lives on Event Order Templates. */
export default function ChoicesTemplatesRedirectPage() {
  redirect("/library/event-order-templates");
}
