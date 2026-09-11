import { redirect } from "next/navigation";

/**
 * Payment Plan Starters are no longer a Library category.
 * Presets live inside the Payment Plan Builder on invoice/payment setup.
 */
export default function PaymentSchedulesLibraryRedirectPage() {
  redirect("/payments/new");
}
