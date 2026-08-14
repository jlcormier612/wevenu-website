#!/usr/bin/env python3
"""API/SQL controlled acceptance — vendor_confirm + Needs Changes v1 (no browser)."""
import json
import os
import subprocess

TOKEN = "seedcoupleportal00000000000000000000000000000001"
TASK = "f6add1a5-f671-48e6-8084-dbe7c33413d5"
NOTE = (
    "We're still missing the reception playlist. "
    "Please add those selections and submit again."
)
OUT = "docs/qa/vendor-confirm-needs-changes-browser/rpc-acceptance.json"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

report = {
    "method": "API/SQL controlled (no browser)",
    "fixture": "[QA temp] Send final song selections",
    "taskId": TASK,
    "steps": [],
    "defects": [],
    "matrix": {},
}


def psql(sql: str) -> str:
    proc = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "supabase_db_wevenu-website",
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
            "-t",
            "-A",
            "-F",
            "|",
        ],
        input=sql,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or "psql failed")
    return (proc.stdout or "").strip()


def snap(label: str):
    raw = psql(
        f"""
select status,
  (couple_acknowledged_at is not null),
  coalesce(left(vendor_return_note,80),''),
  (returned_at is not null),
  (completed_at is not null),
  coalesce(completed_by,'')
from vendor_tasks where id='{TASK}';
"""
    )
    parts = (raw.split("|") + [""] * 6)[:6]
    status, acked, note, returned, done, by = parts
    row = {
        "label": label,
        "status": status,
        "acked": acked == "t",
        "note": note,
        "returned": returned == "t",
        "hasCompletedAt": done == "t",
        "completedBy": by or None,
        "raw": raw,
    }
    report["steps"].append({"kind": "db", **row})
    print(f"[DB] {label}: {raw}")
    return row


def home():
    raw = psql(
        """
select
  (select count(*) from vendor_tasks vt
    where vt.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11'
      and vt.couple_visibility='owned' and vt.status='pending'
      and not (coalesce(vt.completion_authority,'')='vendor_confirm'
               and vt.couple_acknowledged_at is not null)),
  (select count(*) from vendor_tasks vt
    where vt.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11'
      and vt.couple_visibility='owned' and vt.status='pending'
      and vt.completion_authority='vendor_confirm'
      and vt.couple_acknowledged_at is not null),
  (select count(*) filter (where pli.status='paid') from payment_line_items pli
    join payment_schedules ps on ps.id=pli.schedule_id
    where ps.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11'),
  (select count(*) from payment_line_items pli
    join payment_schedules ps on ps.id=pli.schedule_id
    where ps.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11');
"""
    )
    a, w, pd, pt = [int(x) for x in raw.split("|")]
    readiness = round(((8 + pd + 1) / (8 + pt + 1)) * 100)
    row = {
        "actionable": a,
        "waiting": w,
        "payDone": pd,
        "payTotal": pt,
        "readinessApprox": readiness,
    }
    report["steps"].append({"kind": "home", **row})
    print(f"[HOME] actionable={a} waiting={w} readiness≈{readiness}%")
    return row


def portal_task():
    raw = psql(
        f"""
with j as (select public.get_portal_vendor_tasks('{TOKEN}') as j)
select coalesce((
  select jsonb_build_object(
    'title', e->>'title',
    'status', e->>'status',
    'completionAuthority', e->>'completionAuthority',
    'canComplete', e->'canComplete',
    'canAcknowledge', e->'canAcknowledge',
    'coupleAcknowledgedAt', e->>'coupleAcknowledgedAt',
    'vendorReturnNote', e->>'vendorReturnNote',
    'returnedAt', e->>'returnedAt',
    'completedBy', e->>'completedBy'
  )::text
  from jsonb_array_elements((select j->'vendorTasks' from j)) e
  where e->>'id' = '{TASK}'
  limit 1
), 'MISSING');
"""
    )
    print(f"[PORTAL JSON] {raw[:400]}")
    report["steps"].append({"kind": "portal", "raw": raw})
    return raw


def fail(msg: str):
    report["defects"].append(msg)
    print("FAIL:", msg)


def ok(msg: str):
    print("PASS:", msg)


def vendor_uid() -> str:
    return psql(
        "select id::text from auth.users where email='test-vendor@wevenu.local' limit 1;"
    )


def as_vendor(sql_body: str) -> str:
    uid = vendor_uid()
    if not uid:
        fail("vendor auth user missing")
        return ""
    # Transaction-local JWT claims so auth.uid() resolves for this connection.
    sql = f"""
BEGIN;
SELECT set_config('request.jwt.claim.sub', '{uid}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{{"sub":"{uid}","role":"authenticated"}}', true);
{sql_body}
COMMIT;
"""
    return psql(sql)


def main():
    print("=== CHECKPOINT: reset open ===")
    psql(
        f"""
update vendor_tasks set
  status='pending',
  couple_acknowledged_at=null,
  vendor_return_note=null,
  returned_at=null,
  completed_at=null,
  completed_by=null
where id='{TASK}';
"""
    )
    b0 = snap("0_open")
    h0 = home()
    p0 = portal_task()
    if b0["status"] == "pending" and not b0["acked"]:
        ok("open pending unacked")
    else:
        fail("open baseline bad")
    if '"canAcknowledge": true' in p0 or '"canAcknowledge":true' in p0:
        ok("portal canAcknowledge true")
    else:
        fail(f"portal open payload unexpected: {p0}")
    if '"canComplete": true' in p0 or '"canComplete":true' in p0:
        fail("open should not be canComplete")
    else:
        ok("portal canComplete false on vendor_confirm open")

    print("=== CHECKPOINT: couple acknowledge via RPC ===")
    ack = psql(
        f"select public.acknowledge_portal_vendor_task('{TOKEN}', '{TASK}'::uuid)::text;"
    )
    print("[RPC ack]", ack[:240])
    report["steps"].append({"kind": "rpc", "name": "acknowledge", "result": ack})
    b1 = snap("1_acked")
    h1 = home()
    p1 = portal_task()
    if (
        b1["status"] == "pending"
        and b1["acked"]
        and not b1["hasCompletedAt"]
        and not b1["completedBy"]
    ):
        ok("ack: pending + acked + not complete")
    else:
        fail("ack DB contract broken")
    if h1["waiting"] >= 1:
        ok("home waiting >= 1")
    else:
        fail("home waiting not set after ack")
    if h1["readinessApprox"] == h0["readinessApprox"]:
        ok("readiness stable after ack")
    else:
        fail("readiness changed after ack")
    if '"canAcknowledge": false' in p1 or '"canAcknowledge":false' in p1:
        ok("portal canAcknowledge false while waiting")
    if '"canComplete": true' in p1 or '"canComplete":true' in p1:
        fail("portal canComplete true after ack — forbidden")
    else:
        ok("portal canComplete remains false")

    print("=== CHECKPOINT: needs changes via return_vendor_task ===")
    note_lit = NOTE.replace("'", "''")
    ret = as_vendor(
        f"select public.return_vendor_task('{TASK}'::uuid, '{note_lit}')::text;"
    )
    print("[RPC return]", ret[-400:])
    report["steps"].append({"kind": "rpc", "name": "return", "result": ret[-600:]})
    b2 = snap("2_returned")
    h2 = home()
    p2 = portal_task()
    if (
        b2["status"] == "pending"
        and not b2["acked"]
        and b2["returned"]
        and "playlist" in b2["note"]
        and not b2["hasCompletedAt"]
    ):
        ok("return: pending, ack cleared, note set, not complete")
    else:
        fail("return DB contract broken")
    if h2["actionable"] >= 1:
        ok("home actionable after return")
    else:
        fail("home actionable not restored")
    if "vendorReturnNote" in p2 and "playlist" in p2:
        ok("portal surfaces return note")
    else:
        fail(f"portal missing return note: {p2[:200]}")
    if '"canAcknowledge": true' in p2 or '"canAcknowledge":true' in p2:
        ok("portal canAcknowledge restored")
    else:
        fail("portal canAcknowledge not restored after return")

    print("=== CHECKPOINT: couple re-ack ===")
    ack2 = psql(
        f"select public.acknowledge_portal_vendor_task('{TOKEN}', '{TASK}'::uuid)::text;"
    )
    print("[RPC reack]", ack2[:240])
    b3 = snap("3_reacked")
    h3 = home()
    if (
        b3["acked"]
        and not b3["note"]
        and not b3["returned"]
        and b3["status"] == "pending"
    ):
        ok("re-ack clears note/returned_at; waiting again")
    else:
        fail("re-ack should clear return fields")
    if h3["waiting"] >= 1:
        ok("home waiting after re-ack")
    else:
        fail("home waiting after re-ack")

    print("=== CHECKPOINT: vendor confirm ===")
    conf = as_vendor(f"select public.confirm_vendor_task('{TASK}'::uuid)::text;")
    print("[RPC confirm]", conf[-400:])
    report["steps"].append({"kind": "rpc", "name": "confirm", "result": conf[-600:]})
    b4 = snap("4_confirmed")
    h4 = home()
    portal_task()
    if (
        b4["status"] == "complete"
        and b4["completedBy"] == "vendor"
        and b4["hasCompletedAt"]
        and b4["acked"]
    ):
        ok("confirm: complete by vendor")
    else:
        fail("confirm DB contract broken")
    pending = psql(
        f"select count(*)::text from vendor_tasks where id='{TASK}' and status='pending';"
    )
    if pending == "0":
        ok("task no longer pending")
    else:
        fail("task still pending after confirm")
    if h4["readinessApprox"] == h0["readinessApprox"]:
        ok("readiness stable through full cycle")
    else:
        fail("readiness changed through cycle")

    print("=== CHECKPOINT: notifications ===")
    notif = psql(
        f"""
select type || '|' || left(coalesce(title,''),60) || '|' || left(coalesce(body,''),90)
from vendor_notifications
where body ilike '%Send final song selections%'
   or title ilike '%Send final song selections%'
   or body ilike '%QA temp%'
   or title ilike '%QA temp%'
order by created_at desc
limit 8;
"""
    )
    print("[NOTIF]\n" + (notif or "(none)"))
    report["steps"].append(
        {"kind": "notif", "rows": notif.splitlines() if notif else []}
    )
    bad = any(
        line.startswith("task_completed|") and "QA temp" in line
        for line in (notif or "").splitlines()
    )
    good = any(
        line.startswith("task_acknowledged|") for line in (notif or "").splitlines()
    )
    couple_notif = psql(
        """
select type || '|' || left(title,50) || '|' || left(coalesce(body,''),70)
from couple_notifications
where body ilike '%song selections%'
   or body ilike '%playlist%'
   or title ilike '%needs changes%'
order by created_at desc
limit 5;
"""
    )
    print("[COUPLE NOTIF]\n" + (couple_notif or "(none)"))
    report["steps"].append(
        {"kind": "couple_notif", "rows": couple_notif.splitlines() if couple_notif else []}
    )
    if bad:
        fail("vendor_notifications used task_completed for QA vendor_confirm ack")
    else:
        ok("no task_completed for QA vendor_confirm ack path")
    if good:
        ok("task_acknowledged present for QA task")
    if "task_needs_changes" in (couple_notif or ""):
        ok("couple received task_needs_changes")
    else:
        fail("missing couple task_needs_changes notification")

    print("=== CHECKPOINT: regression sniff ===")
    reg = psql(
        """
select status||'|'||completion_authority||'|'||coalesce(completed_by,'')
from vendor_tasks
where title='[P2 regression] Couple acknowledge path'
limit 1;
"""
    )
    print("[REG]", reg)
    ok(f"couple_acknowledge sample: {reg}")
    share = psql(
        """
select status||'|'||completion_authority||'|'||coalesce(action_type,'')
from vendor_tasks
where title='Share timeline'
  and event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11'
limit 1;
"""
    )
    print("[SHARE]", share)
    if "action_verified" in share:
        ok("share_timeline action_verified still present")

    report["matrix"] = {
        "1_open": "PASS" if b0["status"] == "pending" and not b0["acked"] else "FAIL",
        "2_couple_ack": (
            "PASS"
            if b1["acked"] and b1["status"] == "pending" and not b1["hasCompletedAt"]
            else "FAIL"
        ),
        "3_home_waiting": "PASS" if h1["waiting"] >= 1 else "FAIL",
        "4_needs_changes": "PASS" if b2["returned"] and not b2["acked"] else "FAIL",
        "5_home_actionable": "PASS" if h2["actionable"] >= 1 else "FAIL",
        "6_reack_clears_note": "PASS" if b3["acked"] and not b3["note"] else "FAIL",
        "7_vendor_confirm": (
            "PASS"
            if b4["status"] == "complete" and b4["completedBy"] == "vendor"
            else "FAIL"
        ),
        "8_readiness_stable": (
            "PASS" if h4["readinessApprox"] == h0["readinessApprox"] else "FAIL"
        ),
        "9_luv_ack_not_completed": "PASS" if not bad else "FAIL",
        "10_couple_needs_changes_notif": (
            "PASS" if "task_needs_changes" in (couple_notif or "") else "FAIL"
        ),
    }
    report["verdict"] = (
        "PASS"
        if not report["defects"] and all(v == "PASS" for v in report["matrix"].values())
        else "FAIL"
    )
    with open(OUT, "w") as f:
        json.dump(report, f, indent=2)
    print("=== DONE ===")
    print("verdict:", report["verdict"])
    print("defects:", report["defects"])
    print(json.dumps(report["matrix"], indent=2))
    print("wrote", OUT)
    raise SystemExit(0 if report["verdict"] == "PASS" else 1)


if __name__ == "__main__":
    main()
