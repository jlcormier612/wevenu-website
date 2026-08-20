import { redirect } from "next/navigation";

/** Legacy inbox route — templates live at /vendor/task-templates. */
export default function VendorTasksRedirectPage() {
  redirect("/vendor/task-templates");
}
