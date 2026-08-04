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
      const firstName = body.fields.firstName?.trim() || "";
      const lastName = body.fields.lastName?.trim() || "";
      const email = body.fields.email?.trim() || "";
      const venue = (body.fields.venue || body.fields.venueName)?.trim() || "";
      // Prefer first/last; accept legacy combined `name` if first/last absent.
      const legacyName = body.fields.name?.trim() || "";
      const hasName = (firstName && lastName) || legacyName;
      if (!hasName || !email || !venue) {
        return NextResponse.json(
          { error: "First name, last name, email, and venue name are required." },
          { status: 400 },
        );
      }
      if (firstName && lastName && !body.fields.name?.trim()) {
        body.fields.name = `${firstName} ${lastName}`;
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
