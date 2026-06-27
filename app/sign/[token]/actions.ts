"use server";

import { signContractByToken } from "@/lib/contracts/service";

export async function signContractAction(
  token: string,
  signerName: string,
): Promise<{ ok: boolean; message?: string }> {
  return signContractByToken(token, signerName);
}
