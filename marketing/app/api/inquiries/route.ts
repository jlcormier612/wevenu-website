import { NextResponse } from "next/server";

import { isInquiryKind, submitInquiry } from "@/lib/inquiries/service";

export const runtime = "nodejs";

/**
 * Accept marketing inquiry submissions
 * (contact, walkthrough, Welcome Back, newsletter, support).
 * Each submission also upserts the shared Relationship store.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      kind?: string;
      fields?: Record<string, string>;
    };

    if (!body.kind || !isInquiryKind(body.kind)) {
      return NextResponse.json({ error: "Invalid inquiry kind." }, { status: 400 });
    }
    if (!body.fields || typeof body.fields !== "object") {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    if (body.kind === "welcome_back_request") {
      const required = [
        "businessName",
        "venueName",
        "firstName",
        "lastName",
        "businessEmail",
        "phone",
      ] as const;
      for (const key of required) {
        if (!body.fields[key]?.trim()) {
          return NextResponse.json(
            { error: "Please complete all required fields." },
            { status: 400 },
          );
        }
      }
    }

    if (body.kind === "newsletter") {
      if (!body.fields.email?.trim()) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 });
      }
    }

    if (
      body.kind === "contact" ||
      body.kind === "walkthrough" ||
      body.kind === "support"
    ) {
      if (!body.fields.email?.trim() || !body.fields.name?.trim()) {
        return NextResponse.json(
          { error: "Name and email are required." },
          { status: 400 },
        );
      }
    }

    const submission = await submitInquiry({
      kind: body.kind,
      fields: body.fields,
    });

    return NextResponse.json({ ok: true, id: submission.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
