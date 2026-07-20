import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// The venue's own side of revocation — Delegation is revocable by either
// party (Commitment Lifecycle Architecture §7), so a coordinator can hand
// seating management back to the couple, not just receive it.
export async function DELETE(request: Request) {
  const { delegationId } = await request.json();
  if (!delegationId) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_seating_delegation_as_venue", { p_delegation_id: delegationId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
