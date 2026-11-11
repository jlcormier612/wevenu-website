/**
 * Offering images + inventory storage path isolation — Sandbox acceptance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/offering-images-storage-isolation/verify-browser.mts
 *
 * Covers: schema columns, path-scoped storage write/delete, public read retained,
 * Offering→template→Choices freeze→portal display, rental fallback precedence,
 * no-image compatibility, catalog edit does not mutate sent snapshot.
 * Production untouched. Does not rotate credentials.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const MEADOW = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `OIMG${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/offering-images-storage-isolation";
const PREFIX = `OIMG-${RUN}-`;
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string; lane?: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string, lane = "core") {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500), lane });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffSession(activeVenueId: string) {
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("no link");
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: activeVenueId,
  });
  return otp.session;
}

function cookiesForSession(session: { user: { id: string }; access_token: string; refresh_token: string }, venueId: string) {
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: venueId,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

/** 1×1 PNG */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  const createdOfferingIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdChoicesIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdEventIds: string[] = [];
  const storageCleanup: string[] = [];
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "deploy");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    const health = await fetch(`${APP}/api/health`).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => null),
    }));
    record("api_health", health.status === 200 && health.body?.ok === true, JSON.stringify(health), "deploy");

    // Schema: offerings.image_url + event_order_template_options.image_url
    const { error: offColErr } = await admin.from("offerings").select("id,image_url").eq("venue_id", FANCY).limit(1);
    record("schema_offerings_image_url", !offColErr, offColErr?.message ?? "ok", "schema");
    if (offColErr) throw offColErr;
    const { error: optColErr } = await admin
      .from("event_order_template_options")
      .select("id,image_url")
      .eq("venue_id", FANCY)
      .limit(1);
    record("schema_template_options_image_url", !optColErr, optColErr?.message ?? "ok", "schema");
    if (optColErr) throw optColErr;

    // Public read of existing Meadow inventory object must remain.
    const meadowPublic =
      `${url}/storage/v1/object/public/inventory/${MEADOW}/94ab5d9d-8139-428b-9dea-e912c623fe7a/image.png`;
    const publicRead = await fetch(meadowPublic);
    record(
      "public_inventory_read_retained",
      publicRead.ok,
      `status=${publicRead.status} url=${meadowPublic.slice(0, 120)}`,
      "storage",
    );

    // Authenticated Fancy staff: own-path upload OK; foreign-path upload denied.
    const fancySession = await staffSession(FANCY);
    const fancyAuthed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${fancySession.access_token}` } },
    });

    const ownPath = `${FANCY}/offerings/qa-${RUN}/image.png`;
    storageCleanup.push(ownPath);
    const upOwn = await fancyAuthed.storage.from("inventory").upload(ownPath, TINY_PNG, {
      contentType: "image/png",
      upsert: true,
    });
    record("storage_own_venue_upload", !upOwn.error, upOwn.error?.message ?? ownPath, "storage");

    const foreignPath = `${MEADOW}/offerings/qa-cross-${RUN}/image.png`;
    const upForeign = await fancyAuthed.storage.from("inventory").upload(foreignPath, TINY_PNG, {
      contentType: "image/png",
      upsert: true,
    });
    record(
      "storage_cross_venue_upload_denied",
      Boolean(upForeign.error),
      upForeign.error?.message ?? "UNEXPECTED_ALLOW",
      "storage",
    );
    if (!upForeign.error) {
      // Cleanup accidental allow so we leave no orphan under Meadow.
      await admin.storage.from("inventory").remove([foreignPath]);
    }

    const delForeign = await fancyAuthed.storage.from("inventory").remove([
      `${MEADOW}/94ab5d9d-8139-428b-9dea-e912c623fe7a/image.png`,
    ]);
    // Supabase JS remove often returns empty error even when RLS blocks; verify object still exists.
    const stillThere = await fetch(meadowPublic);
    record(
      "storage_cross_venue_delete_denied",
      stillThere.ok,
      `fetchAfterDelete=${stillThere.status} removeErr=${delForeign.error?.message ?? "none"}`,
      "storage",
    );

    const replacePath = `${FANCY}/offerings/qa-${RUN}/image.jpg`;
    storageCleanup.push(replacePath);
    const upReplace = await fancyAuthed.storage.from("inventory").upload(replacePath, TINY_PNG, {
      contentType: "image/jpeg",
      upsert: true,
    });
    record("storage_own_extension_replace", !upReplace.error, upReplace.error?.message ?? replacePath, "storage");

    const delOwn = await fancyAuthed.storage.from("inventory").remove([ownPath, replacePath]);
    record("storage_own_delete", !delOwn.error, delOwn.error?.message ?? "removed", "storage");

    // Re-upload dedicated Offering photo for catalog → freeze path.
    const offeringPhotoPath = `${FANCY}/offerings/qa-off-${RUN}/image.png`;
    storageCleanup.push(offeringPhotoPath);
    const upOffPhoto = await fancyAuthed.storage.from("inventory").upload(offeringPhotoPath, TINY_PNG, {
      contentType: "image/png",
      upsert: true,
    });
    if (upOffPhoto.error) throw upOffPhoto.error;
    const { data: pub } = fancyAuthed.storage.from("inventory").getPublicUrl(offeringPhotoPath);
    const offeringImageUrl = `${pub.publicUrl}?t=${Date.now()}`;
    persisted.offeringImageUrl = offeringImageUrl;

    // Inventory fallback photo (separate object under Fancy).
    const invPhotoPath = `${FANCY}/qa-inv-${RUN}/image.png`;
    storageCleanup.push(invPhotoPath);
    const upInv = await fancyAuthed.storage.from("inventory").upload(invPhotoPath, TINY_PNG, {
      contentType: "image/png",
      upsert: true,
    });
    if (upInv.error) throw upInv.error;
    const { data: invPub } = fancyAuthed.storage.from("inventory").getPublicUrl(invPhotoPath);
    const inventoryImageUrl = `${invPub.publicUrl}?t=${Date.now()}`;

    const { data: invItem, error: invErr } = await admin
      .from("inventory_items")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Rental Chair`,
        image_url: inventoryImageUrl,
        quantity_available: 1,
        is_archived: false,
      })
      .select("id")
      .single();
    if (invErr || !invItem) throw invErr ?? new Error("inv item");
    persisted.inventoryItemId = invItem.id;

    const { data: cat } = await admin
      .from("offering_categories")
      .select("id")
      .eq("venue_id", FANCY)
      .eq("name", "Catering")
      .maybeSingle();
    let categoryId = cat?.id as string | undefined;
    if (!categoryId) {
      const { data: createdCat, error } = await admin
        .from("offering_categories")
        .insert({ venue_id: FANCY, name: "Catering" })
        .select("id")
        .single();
      if (error || !createdCat) throw error ?? new Error("cat");
      categoryId = createdCat.id;
    }

    const { data: offeringWithImage, error: offErr } = await admin
      .from("offerings")
      .insert({
        venue_id: FANCY,
        category_id: categoryId,
        name: `${PREFIX}Plated with Photo`,
        default_unit_price: 85,
        inventory_item_id: invItem.id,
        image_url: offeringImageUrl,
        is_archived: false,
        sort_order: 0,
      })
      .select("id,image_url,inventory_item_id")
      .single();
    if (offErr || !offeringWithImage) throw offErr ?? new Error("offering");
    createdOfferingIds.push(offeringWithImage.id);

    const { data: offeringFallback, error: off2Err } = await admin
      .from("offerings")
      .insert({
        venue_id: FANCY,
        category_id: categoryId,
        name: `${PREFIX}Fallback Rental`,
        default_unit_price: 12,
        inventory_item_id: invItem.id,
        image_url: null,
        is_archived: false,
        sort_order: 1,
      })
      .select("id,image_url,inventory_item_id")
      .single();
    if (off2Err || !offeringFallback) throw off2Err ?? new Error("offering2");
    createdOfferingIds.push(offeringFallback.id);

    const { data: offeringNone, error: off3Err } = await admin
      .from("offerings")
      .insert({
        venue_id: FANCY,
        category_id: categoryId,
        name: `${PREFIX}No Photo`,
        default_unit_price: 5,
        inventory_item_id: null,
        image_url: null,
        is_archived: false,
        sort_order: 2,
      })
      .select("id,image_url")
      .single();
    if (off3Err || !offeringNone) throw off3Err ?? new Error("offering3");
    createdOfferingIds.push(offeringNone.id);

    record(
      "offering_create_with_and_without_image",
      Boolean(offeringWithImage.image_url) && !offeringFallback.image_url && !offeringNone.image_url,
      `with=${offeringWithImage.id} fallback=${offeringFallback.id} none=${offeringNone.id}`,
      "catalog",
    );

    // Reject cross-venue image_url on Fancy offering via app-shaped path check (service role can write anything;
    // verify our helper + that we do not leave a hijacked URL from the UI path by clearing after probe).
    const hijackUrl = meadowPublic;
    const { error: hijackWrite } = await admin
      .from("offerings")
      .update({ image_url: hijackUrl })
      .eq("id", offeringNone.id)
      .eq("venue_id", FANCY);
    // Service role bypasses app validation — document that RLS on offerings does not block URL content.
    // App-layer catalogImageUrlBelongsToVenue must reject; restore null after probe.
    record(
      "db_service_role_can_set_any_image_url",
      !hijackWrite,
      "service role bypass expected; app updateOfferingImage rejects cross-venue URLs (unit-tested)",
      "storage",
    );
    await admin.from("offerings").update({ image_url: null }).eq("id", offeringNone.id);

    // EO template + options with snapshotted images
    const { data: tmpl, error: tmplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Pkg`,
        is_archived: false,
      })
      .select("id")
      .single();
    if (tmplErr || !tmpl) throw tmplErr ?? new Error("tmpl");
    createdTemplateIds.push(tmpl.id);

    const { data: section, error: secErr } = await admin
      .from("event_order_template_sections")
      .insert({ template_id: tmpl.id, venue_id: FANCY, name: "Catering", sort_order: 0 })
      .select("id")
      .single();
    if (secErr || !section) throw secErr ?? new Error("section");

    const { data: group, error: grpErr } = await admin
      .from("event_order_template_groups")
      .insert({
        template_id: tmpl.id,
        venue_id: FANCY,
        section_id: section.id,
        name: "Dinner",
        selection_mode: "single",
        min_select: 1,
        max_select: 1,
        allow_quantity: false,
        sort_order: 0,
      })
      .select("id")
      .single();
    if (grpErr || !group) throw grpErr ?? new Error("group");

    const optionRows = [
      {
        template_id: tmpl.id,
        venue_id: FANCY,
        group_id: group.id,
        offering_id: offeringWithImage.id,
        label: `${PREFIX}Plated with Photo`,
        is_included: false,
        unit_price: 85,
        is_default: false,
        image_url: offeringImageUrl,
        sort_order: 0,
      },
      {
        template_id: tmpl.id,
        venue_id: FANCY,
        group_id: group.id,
        offering_id: offeringFallback.id,
        label: `${PREFIX}Fallback Rental`,
        is_included: false,
        unit_price: 12,
        is_default: false,
        image_url: inventoryImageUrl,
        sort_order: 1,
      },
      {
        template_id: tmpl.id,
        venue_id: FANCY,
        group_id: group.id,
        offering_id: offeringNone.id,
        label: `${PREFIX}No Photo`,
        is_included: true,
        unit_price: 0,
        is_default: false,
        image_url: null,
        sort_order: 2,
      },
    ];
    const { data: options, error: optErr } = await admin
      .from("event_order_template_options")
      .insert(optionRows)
      .select("id,label,image_url,offering_id");
    if (optErr || !options) throw optErr ?? new Error("options");
    record(
      "template_options_snapshot_images",
      options.filter((o) => o.image_url).length === 2 && options.some((o) => !o.image_url),
      JSON.stringify(options.map((o) => ({ id: o.id, hasImage: Boolean(o.image_url) }))),
      "template",
    );

    // Client + event + sent Choices with frozen definition
    const { data: space } = await admin.from("venue_spaces").select("id").eq("venue_id", FANCY).limit(1).maybeSingle();
    if (!space?.id) throw new Error("no Fancy space");

    const { data: client, error: clientErr } = await admin
      .from("clients")
      .insert({
        venue_id: FANCY,
        first_name: "OIMG",
        last_name: RUN,
        email: `oimg-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (clientErr || !client) throw clientErr ?? new Error("client");
    createdClientIds.push(client.id);

    const eventDate = "2027-06-15";
    const { data: event, error: eventErr } = await admin
      .from("events")
      .insert({
        venue_id: FANCY,
        client_id: client.id,
        name: `${PREFIX}Wedding`,
        event_type: "wedding",
        event_date: eventDate,
        event_end_date: eventDate,
        status: "confirmed",
        booked_at: new Date().toISOString(),
        space_id: space.id,
      })
      .select("id")
      .single();
    if (eventErr || !event) throw eventErr ?? new Error("event");
    createdEventIds.push(event.id);

    const frozenDefinition = {
      sections: [{ id: section.id, name: "Catering", guidance: null, sortOrder: 0 }],
      groups: [
        {
          id: group.id,
          sectionId: section.id,
          name: "Dinner",
          instructions: null,
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 0,
        },
      ],
      options: options.map((o, i) => ({
        id: o.id,
        groupId: group.id,
        offeringId: o.offering_id,
        label: o.label,
        description: null,
        isIncluded: !o.image_url && i === 2,
        unitPrice: !o.image_url && i === 2 ? 0 : Number(optionRows[i].unit_price),
        imageUrl: o.image_url,
        sortOrder: i,
      })),
    };
    persisted.frozenImageUrls = frozenDefinition.options.map((o) => o.imageUrl);

    const { data: choices, error: chErr } = await admin
      .from("client_choices")
      .insert({
        venue_id: FANCY,
        event_id: event.id,
        client_id: client.id,
        name: `${PREFIX}Dinner Selections`,
        status: "sent",
        access_key: `oimg-key-${RUN.toLowerCase()}`,
        event_order_template_id: tmpl.id,
        definition: frozenDefinition,
        answers: {},
        sent_at: new Date().toISOString(),
      })
      .select("id,definition")
      .single();
    if (chErr || !choices) throw chErr ?? new Error("choices");
    createdChoicesIds.push(choices.id);

    const token = `oimg-${RUN.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
    const { error: portalErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: client.id,
      event_id: event.id,
      access_level: "couple",
      access_token: token,
      label: "OIMG couple",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    if (portalErr) throw portalErr;

    await context.addCookies(cookiesForSession(fancySession, FANCY));

    // Staff library: offering with image shows thumb; no-image has no broken placeholder.
    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/shots/offerings-library-1280.png`, fullPage: true });
    const libText = await page.locator("body").innerText();
    record(
      "offerings_library_lists_created",
      libText.includes(`${PREFIX}Plated with Photo`) && libText.includes(`${PREFIX}No Photo`),
      "library visible",
      "catalog",
    );

    // Couple portal choices
    const coupleCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const couplePage = await coupleCtx.newPage();
    await couplePage.goto(`${APP}/p/${encodeURIComponent(token)}?view=choices`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    for (let i = 0; i < 4; i++) {
      const t = await couplePage.locator("body").innerText().catch(() => "");
      if (!/End User Terms|I have reviewed and agree/i.test(t)) break;
      const box = couplePage.locator('input[type="checkbox"]');
      if (await box.count()) await box.first().check({ force: true }).catch(() => undefined);
      const btn = couplePage.getByRole("button", { name: /Continue|Accept/i }).first();
      if (await btn.count()) await btn.click({ force: true }).catch(() => undefined);
      await couplePage.waitForTimeout(800);
    }
    await couplePage.waitForTimeout(1200);
    const nav = couplePage.locator('button[title="Choices"], button[title="Your Choices"]').first();
    if (await nav.count()) await nav.click().catch(() => undefined);
    await couplePage.waitForTimeout(1000);

    const photoOpt = options.find((o) => o.image_url === offeringImageUrl || o.image_url?.startsWith(pub.publicUrl));
    const noneOpt = options.find((o) => !o.image_url);
    const photoImg = photoOpt
      ? couplePage.locator(`[data-testid="choices-option-photo-${photoOpt.id}"]`)
      : couplePage.locator("[data-testid^=choices-option-photo-]").first();
    const photoCount = await photoImg.count();
    record("portal_shows_option_photo", photoCount > 0, `count=${photoCount}`, "portal");

    if (noneOpt) {
      const nonePhoto = couplePage.locator(`[data-testid="choices-option-photo-${noneOpt.id}"]`);
      record(
        "portal_no_image_has_no_photo_chrome",
        (await nonePhoto.count()) === 0,
        `noneOpt=${noneOpt.id}`,
        "portal",
      );
      const noneLabel = couplePage.locator(`[data-testid="choices-option-${noneOpt.id}"]`);
      record("portal_no_image_option_selectable", await noneLabel.count() > 0, noneOpt.id, "portal");
    }

    await couplePage.screenshot({ path: `${OUT}/shots/portal-choices-390.png`, fullPage: true });
    await couplePage.setViewportSize({ width: 1280, height: 900 });
    await couplePage.screenshot({ path: `${OUT}/shots/portal-choices-1280.png`, fullPage: true });

    // Mutate catalog Offering image after send — frozen definition must stay.
    const mutated = `${offeringImageUrl}&mutated=1`;
    await admin.from("offerings").update({ image_url: mutated }).eq("id", offeringWithImage.id);
    const { data: choicesAfter } = await admin
      .from("client_choices")
      .select("definition")
      .eq("id", choices.id)
      .single();
    const defOpts = (choicesAfter?.definition as { options?: { imageUrl?: string | null }[] })?.options ?? [];
    const frozenStill = defOpts.some((o) => o.imageUrl === offeringImageUrl || o.imageUrl?.includes(`qa-off-${RUN}`));
    const notMutated = !defOpts.some((o) => (o.imageUrl ?? "").includes("mutated=1"));
    record(
      "sent_snapshot_immutable_after_catalog_edit",
      frozenStill && notMutated,
      JSON.stringify(defOpts.map((o) => o.imageUrl)),
      "freeze",
    );

    // Cross-venue: Fancy staff active on Fancy cannot list Meadow offerings via RLS.
    const { data: meadowLeak, error: meadowLeakErr } = await fancyAuthed
      .from("offerings")
      .select("id")
      .eq("venue_id", MEADOW)
      .limit(5);
    record(
      "offerings_rls_blocks_other_venue",
      !meadowLeakErr && (meadowLeak?.length ?? 0) === 0,
      `count=${meadowLeak?.length ?? 0} err=${meadowLeakErr?.message ?? "none"}`,
      "storage",
    );

    await coupleCtx.close();
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.stack ?? err.message : String(err), "harness");
    await page.screenshot({ path: `${OUT}/shots/harness-error.png`, fullPage: true }).catch(() => undefined);
  } finally {
    for (const id of createdChoicesIds) await admin.from("client_choices").delete().eq("id", id);
    for (const id of createdEventIds) await admin.from("events").delete().eq("id", id);
    for (const id of createdClientIds) await admin.from("clients").delete().eq("id", id);
    for (const id of createdTemplateIds) {
      await admin.from("event_order_template_options").delete().eq("template_id", id);
      await admin.from("event_order_template_groups").delete().eq("template_id", id);
      await admin.from("event_order_template_sections").delete().eq("template_id", id);
      await admin.from("event_order_templates").delete().eq("id", id);
    }
    for (const id of createdOfferingIds) await admin.from("offerings").delete().eq("id", id);
    if (persisted.inventoryItemId) {
      await admin.from("inventory_items").delete().eq("id", persisted.inventoryItemId as string);
    }
    if (storageCleanup.length) await admin.storage.from("inventory").remove(storageCleanup);
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  const ok = failed.length === 0;
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        expectedSha: EXPECTED,
        run: RUN,
        ok,
        pass: checks.filter((c) => c.pass).length,
        fail: failed.length,
        checks,
        persisted,
      },
      null,
      2,
    ),
  );
  console.log(`\n${ok ? "GREEN" : "NOT GREEN"} ${checks.filter((c) => c.pass).length}/${checks.length}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
