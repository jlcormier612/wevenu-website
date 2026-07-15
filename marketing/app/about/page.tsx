import { redirect } from "next/navigation";

/** About is no longer a primary destination — belief lives on Why Wevenu. */
export default function AboutPage() {
  redirect("/why-wevenu");
}
