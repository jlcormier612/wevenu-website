import { NextResponse } from "next/server";

import { getRelationship } from "@/lib/data/store";
import {
  enrollSequence,
  exitSequenceEnrollment,
  pauseSequenceEnrollment,
  resumeSequenceEnrollment,
} from "@/lib/program3/sequence-engine";
import {
  ensureProgram3Data,
  getSequenceEnrollmentsSync,
  getSequencesSync,
} from "@/lib/program3/store";

export async function GET() {
  await ensureProgram3Data();
  return NextResponse.json({
    sequences: getSequencesSync(),
    enrollments: getSequenceEnrollmentsSync(),
  });
}

export async function POST(request: Request) {
  await ensureProgram3Data();
  const body = (await request.json()) as {
    action?: string;
    sequenceId?: string;
    relationshipId?: string;
    enrollmentId?: string;
    reason?: string;
  };

  if (body.action === "enroll") {
    if (!body.sequenceId || !body.relationshipId) {
      return NextResponse.json(
        { error: "sequenceId and relationshipId required" },
        { status: 400 },
      );
    }
    const result = await enrollSequence({
      sequenceId: body.sequenceId,
      relationshipId: body.relationshipId,
      getRelationship,
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ok: true, enrollment: result });
  }

  if (body.action === "pause" && body.enrollmentId) {
    const result = await pauseSequenceEnrollment(body.enrollmentId);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, enrollment: result });
  }

  if (body.action === "resume" && body.enrollmentId) {
    const result = await resumeSequenceEnrollment(body.enrollmentId, getRelationship);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, enrollment: result });
  }

  if (body.action === "exit" && body.enrollmentId) {
    const result = await exitSequenceEnrollment(body.enrollmentId, body.reason);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true, enrollment: result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
