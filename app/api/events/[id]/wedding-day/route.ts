import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type Params = { params: Promise<{ id: string }> };

// GET — full wedding day ops dashboard data
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_wedding_day_ops", { p_event_id: eventId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as { error?: string } | null;
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json(data);
}

// PATCH — timeline status update or vendor check-in toggle
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  void eventId; // validated implicitly through RPC ownership checks

  const body = await req.json() as {
    action: "timeline_status" | "vendor_checkin";
    entryId?: string;
    status?: string;
    assignmentId?: string;
    field?: string;
    taskId?: string;
  };

  const supabase = await createClient();

  if (body.action === "timeline_status") {
    if (!body.entryId || !body.status) {
      return NextResponse.json({ error: "entryId and status required" }, { status: 400 });
    }
    const { error } = await supabase.rpc("update_timeline_entry_status", {
      p_entry_id: body.entryId,
      p_status:   body.status,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "vendor_checkin") {
    if (!body.assignmentId || !body.field) {
      return NextResponse.json({ error: "assignmentId and field required" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("toggle_vendor_checkin", {
      p_assignment_id: body.assignmentId,
      p_field:         body.field,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === "complete_task") {
    if (!body.taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
    const { error } = await supabase
      .from("event_tasks")
      .update({ status: "complete", completed_at: new Date().toISOString(), completed_by: "coordinator" })
      .eq("id", body.taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
