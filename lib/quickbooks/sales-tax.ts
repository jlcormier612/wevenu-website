/**
 * US QuickBooks Online sales tax helpers.
 *
 * Line TaxCodeRef TAX/NON marks whether a sales line is taxable. For companies
 * using classic US sales tax (Preferences.TaxPrefs.UsingSalesTax), QBO still
 * needs TxnTaxDetail.TxnTaxCodeRef set to the company tax group (e.g. California)
 * or TotalTax stays 0 and invoice totals silently omit tax.
 */
import { quickBooksFetch } from "@/lib/quickbooks/client";

export type SalesTaxCodeResult =
  | { ok: true; taxCodeId: string }
  | { ok: false; error: string; retryable: boolean };

/**
 * Resolve the company default sales-tax group from Preferences.TaxPrefs.
 * Returns a non-retryable configuration error when sales tax is disabled or
 * no TaxGroupCodeRef is configured — sync must not invent a tax rate.
 */
export async function resolveCompanySalesTaxCodeRef(
  venueId: string,
): Promise<SalesTaxCodeResult> {
  const result = await quickBooksFetch(venueId, "/preferences");
  if (!result.ok) {
    return { ok: false, error: result.error, retryable: result.retryable };
  }

  const data = await result.response.json() as {
    Preferences?: {
      TaxPrefs?: {
        UsingSalesTax?: boolean;
        TaxGroupCodeRef?: { value?: string };
      };
    };
  };
  const taxPrefs = data.Preferences?.TaxPrefs;
  if (!taxPrefs?.UsingSalesTax) {
    return {
      ok: false,
      error:
        "QuickBooks company sales tax is not enabled. Enable US sales tax in QuickBooks, then retry.",
      retryable: false,
    };
  }
  const taxCodeId = taxPrefs.TaxGroupCodeRef?.value?.trim();
  if (!taxCodeId) {
    return {
      ok: false,
      error:
        "QuickBooks company has no default sales tax code (TaxGroupCodeRef). Configure a sales tax rate in QuickBooks, then retry.",
      retryable: false,
    };
  }
  return { ok: true, taxCodeId };
}
