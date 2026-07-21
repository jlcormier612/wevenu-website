import { redirect } from "next/navigation";

/** About is no longer a primary destination — belief lives on Our Story. */
export default function AboutPage() {
  redirect("/our-story");
}
