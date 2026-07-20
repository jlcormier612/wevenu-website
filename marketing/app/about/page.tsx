import { redirect } from "next/navigation";

/** About is no longer a primary destination — belief lives on Why Hello to Cheers. */
export default function AboutPage() {
  redirect("/why-wevenu");
}
