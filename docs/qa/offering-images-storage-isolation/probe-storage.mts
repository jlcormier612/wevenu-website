/** One-shot storage isolation probe (post-migration). Does not require app deploy. */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url?.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const MEADOW = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EMAIL = "jennifer@hellotocheers.com";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const RUN = Date.now().toString(36);

type R = { name: string; pass: boolean; detail: string };
const results: R[] = [];
function rec(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function main() {
  const { error: c1 } = await admin.from("offerings").select("id,image_url").eq("venue_id", FANCY).limit(1);
  rec("schema_offerings_image_url", !c1, c1?.message ?? "ok");
  const { error: c2 } = await admin
    .from("event_order_template_options")
    .select("id,image_url")
    .eq("venue_id", FANCY)
    .limit(1);
  rec("schema_options_image_url", !c2, c2?.message ?? "ok");

  const meadowPublic =
    `${url}/storage/v1/object/public/inventory/${MEADOW}/94ab5d9d-8139-428b-9dea-e912c623fe7a/image.png`;
  const pr = await fetch(meadowPublic);
  rec("public_read_retained", pr.ok, String(pr.status));

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("link");
  const { data: otp, error: oe } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (oe || !otp?.session) throw oe ?? new Error("otp");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: FANCY,
  });
  const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${otp.session.access_token}` } },
  });

  const own = `${FANCY}/offerings/qa-pre-${RUN}/image.png`;
  const up = await authed.storage.from("inventory").upload(own, PNG, {
    contentType: "image/png",
    upsert: true,
  });
  rec("own_upload", !up.error, up.error?.message ?? own);

  const foreign = `${MEADOW}/offerings/qa-pre-${RUN}/image.png`;
  const upF = await authed.storage.from("inventory").upload(foreign, PNG, {
    contentType: "image/png",
    upsert: true,
  });
  rec("cross_upload_denied", Boolean(upF.error), upF.error?.message ?? "ALLOWED_BAD");
  if (!upF.error) await admin.storage.from("inventory").remove([foreign]);

  await authed.storage.from("inventory").remove([
    `${MEADOW}/94ab5d9d-8139-428b-9dea-e912c623fe7a/image.png`,
  ]);
  const still = await fetch(meadowPublic);
  rec("cross_delete_denied", still.ok, String(still.status));

  const delOwn = await authed.storage.from("inventory").remove([own]);
  rec("own_delete", !delOwn.error, delOwn.error?.message ?? "ok");

  const pass = results.filter((r) => r.pass).length;
  const out = {
    at: new Date().toISOString(),
    pass,
    fail: results.length - pass,
    ok: pass === results.length,
    results,
  };
  writeFileSync(
    "docs/qa/offering-images-storage-isolation/storage-predeploy-results.json",
    JSON.stringify(out, null, 2),
  );
  console.log(out.ok ? `GREEN ${pass}/${results.length}` : `NOT GREEN ${pass}/${results.length}`);
  process.exit(out.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
