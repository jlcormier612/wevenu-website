"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { acknowledgeOpsIncident } from "@/lib/hq/ops-incidents";
import { getHqAdmin } from "@/lib/hq/service";

export async function acknowledgeOpsIncidentAction(formData: FormData) {
  const admin = await getHqAdmin();
  if (!admin) redirect("/dashboard");

  const id = String(formData.get("incidentId") || "");
  if (!id) return;

  const result = await acknowledgeOpsIncident(id);
  if (!result.ok) {
    throw new Error(result.message);
  }
  revalidatePath("/admin/ops-alerts");
  revalidatePath(`/admin/ops-alerts/${id}`);
  revalidatePath("/admin");
}
