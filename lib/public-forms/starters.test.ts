import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  PUBLIC_FORM_STARTER_MASTERS,
  WILLOW_GROVE_PUBLIC_FORM_STARTER_IDS,
  seedPublicFormStarters,
} from "@/lib/public-forms/starters";
import { PUBLIC_FORM_COLLECTS_SMS_CONSENT } from "@/lib/public-forms/constants";

const root = process.cwd();

type Row = Record<string, unknown>;

function makeMockDb(opts?: {
  rpcImpl?: (args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  initialForms?: Row[];
  initialQuestions?: Row[];
  failQuestionsOnce?: boolean;
  failFormInsert?: boolean;
}) {
  const forms: Row[] = [...(opts?.initialForms ?? [])];
  const questions: Row[] = [...(opts?.initialQuestions ?? [])];
  let failQuestions = opts?.failQuestionsOnce === true;
  const failFormInsert = opts?.failFormInsert === true;
  const rpcCalls: Record<string, unknown>[] = [];

  function from(table: string) {
    const state: {
      filters: Record<string, unknown>;
      op: string | null;
      payload: unknown;
      countHead: boolean;
      wantSingle: boolean;
      wantMaybe: boolean;
    } = {
      filters: {},
      op: null,
      payload: null,
      countHead: false,
      wantSingle: false,
      wantMaybe: false,
    };

    const api: Record<string, unknown> = {};
    let proxy: Record<string, unknown>;

    const self = () => proxy;

    api.select = (_cols?: string, opts2?: { count?: string; head?: boolean }) => {
      state.countHead = Boolean(opts2?.head);
      return self();
    };
    api.insert = (payload: unknown) => {
      state.op = "insert";
      state.payload = payload;
      return self();
    };
    api.delete = () => {
      state.op = "delete";
      return self();
    };
    api.eq = (col: string, val: unknown) => {
      state.filters[col] = val;
      return self();
    };
    api.maybeSingle = () => {
      state.wantMaybe = true;
      return self();
    };
    api.single = () => {
      state.wantSingle = true;
      return self();
    };

    const execute = async () => {
      if (table === "public_forms" && state.op === "insert" && state.wantSingle) {
        if (failFormInsert) {
          return { data: null, error: { message: "insert_denied" } };
        }
        const row: Row = { ...(state.payload as Row), id: `form-${forms.length + 1}` };
        if (
          row.starter_key &&
          forms.some((f) => f.venue_id === row.venue_id && f.starter_key === row.starter_key)
        ) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
        forms.push(row);
        return { data: row, error: null };
      }

      if (table === "public_forms" && state.wantMaybe) {
        const hit = forms.find((f) =>
          Object.entries(state.filters).every(([k, v]) => f[k] === v),
        );
        return { data: hit ?? null, error: null };
      }

      if (table === "public_form_questions" && state.op === "insert") {
        if (failQuestions) {
          failQuestions = false;
          return { data: null, error: { message: "questions_insert_failed" }, count: null };
        }
        const rows = Array.isArray(state.payload) ? (state.payload as Row[]) : [state.payload as Row];
        for (const r of rows) questions.push(r);
        return { data: rows, error: null, count: rows.length };
      }

      if (table === "public_form_questions" && state.op === "delete") {
        const formId = state.filters.public_form_id;
        for (let i = questions.length - 1; i >= 0; i--) {
          if (questions[i].public_form_id === formId) questions.splice(i, 1);
        }
        return { data: null, error: null, count: null };
      }

      if (table === "public_forms" && state.op === "delete") {
        const id = state.filters.id;
        const idx = forms.findIndex((f) => f.id === id);
        if (idx >= 0) forms.splice(idx, 1);
        return { data: null, error: null, count: null };
      }

      if (table === "public_form_questions" && state.countHead) {
        const formId = state.filters.public_form_id;
        const count = questions.filter((q) => q.public_form_id === formId).length;
        return { data: null, error: null, count };
      }

      return { data: null, error: null, count: null };
    };

    proxy = new Proxy(api, {
      get(target, prop, receiver) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            execute().then(resolve, reject);
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    return proxy;
  }

  return {
    from,
    rpc: async (_name: string, args: Record<string, unknown>) => {
      rpcCalls.push(args);
      if (opts?.rpcImpl) return opts.rpcImpl(args);
      return { data: null, error: { message: "function seed_public_form_starter does not exist" } };
    },
    _forms: forms,
    _questions: questions,
    _rpcCalls: rpcCalls,
  };
}

function seedGeneralThenCustomize(customizer: (db: ReturnType<typeof makeMockDb>) => void) {
  return async () => {
    const db = makeMockDb();
    const first = await seedPublicFormStarters("venue-c", db as never);
    assert.equal(first.created.length, 4);
    const form = db._forms.find((f) => f.starter_key === "general_venue_inquiry");
    assert.ok(form);
    customizer(db);
    const beforeForms = structuredClone(db._forms);
    const beforeQs = structuredClone(db._questions);
    const second = await seedPublicFormStarters("venue-c", db as never);
    assert.equal(second.created.length, 0);
    assert.ok(second.skipped.includes("general_venue_inquiry"));
    assert.deepEqual(db._forms, beforeForms);
    assert.deepEqual(db._questions, beforeQs);
  };
}

describe("Public Forms starters", () => {
  it("defines exactly four launch starters with draft-safe identities", () => {
    assert.equal(PUBLIC_FORM_STARTER_MASTERS.length, 4);
    assert.deepEqual(
      PUBLIC_FORM_STARTER_MASTERS.map((m) => m.key),
      [
        "general_venue_inquiry",
        "wedding_expo_lead_capture",
        "open_house_tour_interest",
        "private_social_event_inquiry",
      ],
    );
    for (const m of PUBLIC_FORM_STARTER_MASTERS) {
      assert.ok(m.questions.some((q) => /contact/i.test(q.questionText) && q.required));
    }
  });

  it("does not collect SMS consent on Public Forms starters", () => {
    assert.equal(PUBLIC_FORM_COLLECTS_SMS_CONSENT, false);
  });

  it("is wired into ensureVenueStarters with intentional-deletion gap-fill", () => {
    const src = readFileSync(join(root, "lib/provisioning/starters.ts"), "utf8");
    assert.match(src, /key: "public_forms"/);
    assert.match(src, /seededSteps\.includes\("public_forms"\)/);
    assert.match(src, /status: "incomplete"/);
  });

  it("migration keys only verified Willow IDs and defines seed RPC", () => {
    const mig = readFileSync(
      join(root, "supabase/migrations/20261420000000_public_form_starter_key.sql"),
      "utf8",
    );
    assert.match(mig, /seed_public_form_starter/);
    assert.match(mig, /f80e069f-e231-42ad-962f-6deb83e2421d/);
    assert.match(mig, /31f38b79-eb99-4ebc-81bc-af85767b42aa/);
    assert.doesNotMatch(mig, /where starter_key is null\s+and internal_name = 'General Venue Inquiry'/);
  });
});

describe("Public Forms starter seeding behavior", () => {
  it("creates four complete drafts on a new venue (fallback path)", async () => {
    const db = makeMockDb();
    const result = await seedPublicFormStarters("venue-new", db as never);
    assert.equal(result.failed.length, 0, JSON.stringify(result.failed));
    assert.equal(result.created.length, 4);
    assert.equal(db._forms.length, 4);
    assert.equal(db._forms.every((f) => f.status === "draft" && f.starter_key), true);
    assert.ok(db._questions.length >= 8);
  });

  it("second provisioning run creates no duplicates", async () => {
    const db = makeMockDb();
    const first = await seedPublicFormStarters("venue-new", db as never);
    const second = await seedPublicFormStarters("venue-new", db as never);
    assert.equal(first.created.length, 4);
    assert.equal(second.created.length, 0);
    assert.equal(second.skipped.length, 4);
    assert.equal(db._forms.length, 4);
  });

  it("does not claim same-name custom form without starter_key", async () => {
    const db = makeMockDb({
      initialForms: [
        {
          id: "custom-1",
          venue_id: "venue-a",
          internal_name: "General Venue Inquiry",
          status: "draft",
          starter_key: null,
        },
      ],
    });
    const result = await seedPublicFormStarters("venue-a", db as never);
    assert.equal(result.failed.length, 0, JSON.stringify(result.failed));
    assert.equal(result.created.length, 4);
    assert.equal(db._forms.length, 5);
    assert.equal(db._forms.find((f) => f.id === "custom-1")?.starter_key ?? null, null);
    assert.ok(db._forms.some((f) => f.starter_key === "general_venue_inquiry"));
  });

  it("question insert failure rolls back incomplete form and retry succeeds", async () => {
    const db = makeMockDb({ failQuestionsOnce: true });
    const first = await seedPublicFormStarters("venue-partial", db as never);
    assert.ok(first.failed.length >= 1, JSON.stringify(first));
    const second = await seedPublicFormStarters("venue-partial", db as never);
    assert.equal(second.failed.length, 0, JSON.stringify(second.failed));
    const keys = new Set(db._forms.map((f) => f.starter_key));
    for (const m of PUBLIC_FORM_STARTER_MASTERS) assert.ok(keys.has(m.key));
  });

  it("does not rewrite existing starter when question count is below template", async () => {
    const db = makeMockDb({
      initialForms: [
        {
          id: "customized-1",
          venue_id: "venue-r",
          internal_name: "General Venue Inquiry",
          status: "draft",
          starter_key: "general_venue_inquiry",
        },
      ],
      initialQuestions: [
        {
          public_form_id: "customized-1",
          question_text: "Only one venue-kept question",
          sort_order: 1,
        },
      ],
    });
    const result = await seedPublicFormStarters("venue-r", db as never);
    assert.equal(result.failed.length, 0, JSON.stringify(result.failed));
    assert.ok(result.skipped.includes("general_venue_inquiry"), JSON.stringify(result));
    assert.equal(result.repaired.length, 0);
    const kept = db._questions.filter((q) => q.public_form_id === "customized-1");
    assert.equal(kept.length, 1);
    assert.equal(kept[0].question_text, "Only one venue-kept question");
    assert.equal(db._forms.find((f) => f.id === "customized-1")?.starter_key, "general_venue_inquiry");
  });

  it("does not change published status on skip", async () => {
    const db = makeMockDb({
      initialForms: [
        {
          id: "pub-1",
          venue_id: "venue-p",
          internal_name: "General Venue Inquiry",
          status: "published",
          starter_key: "general_venue_inquiry",
        },
      ],
    });
    for (const q of PUBLIC_FORM_STARTER_MASTERS[0].questions) {
      db._questions.push({
        public_form_id: "pub-1",
        question_text: q.questionText,
        sort_order: q.sortOrder,
      });
    }
    const result = await seedPublicFormStarters("venue-p", db as never);
    assert.ok(result.skipped.includes("general_venue_inquiry"), JSON.stringify(result));
    assert.equal(db._forms.find((f) => f.id === "pub-1")?.status, "published");
  });

  it("uses RPC when available and passes only canonical masters", async () => {
    const seen = new Set<string>();
    const db = makeMockDb({
      rpcImpl: async (args) => {
        assert.ok(
          PUBLIC_FORM_STARTER_MASTERS.some((m) => m.key === args.p_starter_key),
          "non-canonical starter_key",
        );
        const key = String(args.p_starter_key);
        if (seen.has(key)) {
          return { data: { status: "skipped", form_id: `id-${key}` }, error: null };
        }
        seen.add(key);
        return { data: { status: "created", form_id: `id-${key}` }, error: null };
      },
    });
    const first = await seedPublicFormStarters("venue-rpc", db as never);
    const second = await seedPublicFormStarters("venue-rpc", db as never);
    assert.equal(first.created.length, 4);
    assert.equal(second.skipped.length, 4);
    assert.equal(db._rpcCalls.length, 8);
    for (const call of db._rpcCalls) {
      const master = PUBLIC_FORM_STARTER_MASTERS.find((m) => m.key === call.p_starter_key)!;
      assert.equal(call.p_internal_name, master.internalName);
      assert.equal(call.p_public_title, master.publicTitle);
    }
  });

  it("Willow verified IDs match migration", () => {
    const ids = Object.values(WILLOW_GROVE_PUBLIC_FORM_STARTER_IDS.forms);
    assert.equal(new Set(ids).size, 4);
    const mig = readFileSync(
      join(root, "supabase/migrations/20261420000000_public_form_starter_key.sql"),
      "utf8",
    );
    for (const id of ids) assert.match(mig, new RegExp(id));
  });

  it("concurrent provisioning attempts produce one complete set", async () => {
    const db = makeMockDb();
    const [a, b] = await Promise.all([
      seedPublicFormStarters("venue-race", db as never),
      seedPublicFormStarters("venue-race", db as never),
    ]);
    assert.equal(a.failed.length + b.failed.length, 0, JSON.stringify({ a, b }));
    assert.equal(db._forms.length, 4);
    const keys = new Set(db._forms.map((f) => f.starter_key));
    assert.equal(keys.size, 4);
  });

  it("reports failed provisioning instead of success when inserts fail", async () => {
    const db = makeMockDb({ failFormInsert: true });
    const result = await seedPublicFormStarters("venue-fail", db as never);
    assert.equal(result.failed.length, 4, JSON.stringify(result));
    assert.equal(result.created.length, 0);
    assert.equal(db._forms.length, 0);
  });
});

describe("Public Forms customization preservation", () => {
  it(
    "remove one starter question, rerun: question stays removed",
    seedGeneralThenCustomize((db) => {
      const form = db._forms.find((f) => f.starter_key === "general_venue_inquiry")!;
      const idx = db._questions.findIndex((q) => q.public_form_id === form.id);
      assert.ok(idx >= 0);
      db._questions.splice(idx, 1);
    }),
  );

  it(
    "edit question wording, rerun: edit remains",
    seedGeneralThenCustomize((db) => {
      const form = db._forms.find((f) => f.starter_key === "general_venue_inquiry")!;
      const q = db._questions.find((row) => row.public_form_id === form.id)!;
      q.question_text = "Venue-edited wording";
    }),
  );

  it(
    "add a question, rerun: addition remains",
    seedGeneralThenCustomize((db) => {
      const form = db._forms.find((f) => f.starter_key === "general_venue_inquiry")!;
      db._questions.push({
        public_form_id: form.id,
        question_text: "Venue-added question",
        sort_order: 99,
      });
    }),
  );

  it(
    "rename a form, rerun: name remains",
    seedGeneralThenCustomize((db) => {
      const form = db._forms.find((f) => f.starter_key === "general_venue_inquiry")!;
      form.internal_name = "Our Custom Inquiry Name";
      form.public_title = "Ask us anything";
    }),
  );

  it(
    "publish a form, rerun: published status remains",
    seedGeneralThenCustomize((db) => {
      const form = db._forms.find((f) => f.starter_key === "general_venue_inquiry")!;
      form.status = "published";
    }),
  );

  it("deleted completed starter is not recreated by seedPublicFormStarters alone", async () => {
    // seedPublicFormStarters would recreate a missing starter_key; intentional
    // deletion is enforced by ensureVenueStarters seeded_steps lifecycle.
    const src = readFileSync(join(root, "lib/provisioning/starters.ts"), "utf8");
    assert.match(src, /if \(snap\.seededSteps\.includes\("public_forms"\)\)/);
    assert.match(src, /recreateDeleted/);
    assert.doesNotMatch(
      src.slice(src.indexOf("export async function ensureVenueStarters")),
      /seedPublicFormStarters[\s\S]*recreateDeleted === false[\s\S]*seedPublicFormStarters/,
    );
  });

  it("same-name customer-created form remains unchanged when starter installs", async () => {
    const db = makeMockDb({
      initialForms: [
        {
          id: "custom-keep",
          venue_id: "venue-s",
          internal_name: "Wedding Expo Lead Capture",
          public_title: "Our expo form",
          status: "published",
          starter_key: null,
        },
      ],
      initialQuestions: [
        { public_form_id: "custom-keep", question_text: "Custom only", sort_order: 1 },
      ],
    });
    await seedPublicFormStarters("venue-s", db as never);
    const custom = db._forms.find((f) => f.id === "custom-keep")!;
    assert.equal(custom.starter_key ?? null, null);
    assert.equal(custom.public_title, "Our expo form");
    assert.equal(custom.status, "published");
    assert.equal(
      db._questions.filter((q) => q.public_form_id === "custom-keep").length,
      1,
    );
  });
});

describe("Public Forms RPC security (SQL contract — not live Postgres)", () => {
  const mig = readFileSync(
    join(root, "supabase/migrations/20261420000000_public_form_starter_key.sql"),
    "utf8",
  );

  it("EXECUTE is granted only to service_role; authenticated/anon revoked", () => {
    assert.match(
      mig,
      /grant execute on function public\.seed_public_form_starter\(\s*uuid, text, text, text, text, jsonb, jsonb\s*\)\s+to service_role/i,
    );
    assert.match(mig, /revoke all on function public\.seed_public_form_starter[\s\S]*from authenticated/i);
    assert.match(mig, /revoke all on function public\.seed_public_form_starter[\s\S]*from anon/i);
    assert.doesNotMatch(
      mig,
      /grant execute on function public\.seed_public_form_starter[\s\S]*to authenticated/i,
    );
  });

  it("function body requires service_role at runtime", () => {
    assert.match(mig, /auth\.role\(\) is distinct from 'service_role'/);
    assert.match(mig, /service_role required/);
  });

  it("does not contain question-count-based destructive repair", () => {
    assert.doesNotMatch(mig, /v_q_count/);
    assert.doesNotMatch(mig, /delete from public\.public_form_questions/);
    assert.doesNotMatch(mig, /'repaired'/);
  });

  it("seedPublicFormStarters uses admin client by default (trusted path)", () => {
    const src = readFileSync(join(root, "lib/public-forms/starters.ts"), "utf8");
    assert.match(src, /const db = client \?\? createAdminClient\(\)/);
    assert.match(src, /PUBLIC_FORM_STARTER_MASTERS/);
  });

  it("PENDING: live Postgres permission denial for authenticated role", () => {
    // Documented gap: apply migration then prove with an authenticated JWT.
    assert.ok(true, "live DB EXECUTE denial pending Sandbox migration apply");
  });
});

describe("Public Forms migration safety (SQL contract)", () => {
  const mig = readFileSync(
    join(root, "supabase/migrations/20261420000000_public_form_starter_key.sql"),
    "utf8",
  );

  it("is additive: column + partial unique index + RPC only", () => {
    assert.match(mig, /add column if not exists starter_key/);
    assert.match(mig, /create unique index if not exists public_forms_venue_starter_key_uidx/);
    assert.match(mig, /where starter_key is not null/);
    assert.doesNotMatch(mig, /drop table/i);
    assert.doesNotMatch(mig, /delete from public\.public_forms/i);
  });

  it("does not broad-claim by internal_name across venues", () => {
    const updates = [...mig.matchAll(/update public\.public_forms[\s\S]*?;/gi)];
    assert.equal(updates.length, 4);
    for (const u of updates) {
      assert.match(u[0], /where id = '/);
      assert.match(u[0], /venue_id = '31f38b79-eb99-4ebc-81bc-af85767b42aa'/);
    }
  });

  it("RPC never publishes and never claims same-name without starter_key", () => {
    assert.match(mig, /'draft'/);
    assert.doesNotMatch(mig, /status\s*=\s*'published'/);
    assert.match(mig, /and starter_key = p_starter_key/);
    assert.match(mig, /security definer/);
    assert.match(mig, /set search_path = public/);
  });
});

describe("Public Forms intentional deletion + submission contract", () => {
  it("ensureVenueStarters does not recreate after public_forms is in seeded_steps", () => {
    const src = readFileSync(join(root, "lib/provisioning/starters.ts"), "utf8");
    assert.match(src, /if \(snap\.seededSteps\.includes\("public_forms"\)\)/);
    assert.match(src, /recreateDeleted/);
  });

  it("public submit creates attributed lead path, not client booking", () => {
    const submit = readFileSync(join(root, "app/api/public/forms/submit/route.ts"), "utf8");
    assert.match(submit, /create_public_form_lead/);
    assert.match(submit, /p_source_data/);
    assert.doesNotMatch(submit, /from\("clients"\)\.insert|createClientFromSubmission|booked_event/i);
  });

  it("disposable acceptance tears down memberships and venue", () => {
    const src = readFileSync(
      join(root, "scripts/qa/public-forms-starters-disposable-acceptance.mts"),
      "utf8",
    );
    assert.match(src, /venue_staff"\)\.delete\(\)\.eq\("venue_id"/);
    assert.match(src, /venues"\)\.delete\(\)\.eq\("id"/);
    assert.match(src, /deleteUser/);
    assert.match(src, /assertWritableQaVenue/);
  });
});
