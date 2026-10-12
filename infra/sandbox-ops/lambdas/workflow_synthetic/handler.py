"""
Sandbox-only synthetic: health + disposable customer-journey write paths.

Uses service-role secret. Creates throwaway Fancy Venue records, verifies
readback / attachment, deletes them. Never sends email/SMS, never initiates
Stripe charges, never marks contracts sent.
Publishes HTC/Sandbox gauges for early-warning alarms.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

import boto3

NAMESPACE = "HTC/Sandbox"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://wvpsldwwjqdannqasrdf.supabase.co").rstrip("/")
SERVICE_SECRET_ID = os.environ.get(
    "SUPABASE_SERVICE_ROLE_SECRET_ID", "htc/sandbox/supabase-service-role-key"
)
HEALTH_URL = os.environ.get(
    "HEALTH_URL", "https://app.sandbox.hellotocheers.com/api/health"
)
FANCY_VENUE_ID = os.environ.get(
    "SYNTHETIC_VENUE_ID", "a415ac52-cd74-42a6-8df7-7a8f6e71d080"
)
USER_AGENT = "HTC-Sandbox-WorkflowSynthetic/1.0"


def _secret_string(secret_id: str) -> str:
    raw = boto3.client("secretsmanager").get_secret_value(SecretId=secret_id)["SecretString"]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            for key in (
                "service_role_key",
                "serviceRoleKey",
                "SUPABASE_SERVICE_ROLE_KEY",
                "value",
                "key",
                "token",
            ):
                if parsed.get(key):
                    return str(parsed[key])
            if len(parsed) == 1:
                return str(next(iter(parsed.values())))
    except Exception:
        pass
    return raw


def _http_json(method: str, url: str, headers: dict[str, str], body: dict | None = None) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw) if raw else None
        except Exception:
            parsed = {"raw": raw[:300]}
        return exc.code, parsed


def _put(metrics: list[dict[str, Any]]) -> None:
    boto3.client("cloudwatch").put_metric_data(Namespace=NAMESPACE, MetricData=metrics)


def _auth_headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
        "User-Agent": USER_AGENT,
    }


def _delete(key: str, table: str, row_id: str) -> None:
    _http_json(
        "DELETE",
        f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}",
        {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "User-Agent": USER_AGENT,
            "Prefer": "return=minimal",
        },
    )


def handler(event, context):  # noqa: ANN001, ARG001
    detail: dict[str, Any] = {
        "health": None,
        "lead_id": None,
        "tour_id": None,
        "contract_id": None,
        "invoice_id": None,
        "error": None,
    }
    health_ok = 0
    write_ok = 0
    tour_ok = 0
    contract_ok = 0
    payment_ok = 0
    overall = 0
    lead_id = None
    tour_id = None
    contract_id = None
    invoice_id = None

    try:
        status, body = _http_json(
            "GET",
            HEALTH_URL,
            {"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        detail["health"] = {
            "status": status,
            "ok": (body or {}).get("ok") if isinstance(body, dict) else None,
        }
        if (
            status == 200
            and isinstance(body, dict)
            and body.get("ok") is True
            and (body.get("checks") or {}).get("supabase") == "ok"
        ):
            health_ok = 1

        key = _secret_string(SERVICE_SECRET_ID)
        stamp = int(time.time())
        email = f"workflow-synth-{stamp}@hellotocheers-test.invalid"
        headers = _auth_headers(key)

        # --- Inquiry write path ---
        create_status, created = _http_json(
            "POST",
            f"{SUPABASE_URL}/rest/v1/leads",
            headers,
            {
                "venue_id": FANCY_VENUE_ID,
                "first_name": "Workflow",
                "last_name": "Synthetic",
                "email": email,
                "sales_stage": "new_inquiry",
                "status": "active",
                "source": "website",
                "inquiry_message": "[ops-synthetic] Disposable inquiry — safe to delete.",
                "inquiry_message_origin": "customer",
            },
        )
        if create_status in (200, 201) and isinstance(created, list) and created:
            lead_id = created[0].get("id")
        detail["lead_id"] = lead_id
        if not lead_id:
            raise RuntimeError(f"lead create failed status={create_status} body={created}")

        get_status, got = _http_json(
            "GET",
            f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}&select=id,email",
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "User-Agent": USER_AGENT,
            },
        )
        if get_status != 200 or not isinstance(got, list) or not got:
            raise RuntimeError(f"lead readback failed status={get_status}")
        write_ok = 1

        # --- Tour attach path (same lead) ---
        # Completed past appointment avoids calendar capacity conflicts while
        # still proving lead_id + venue_id attachment. Omit actual_occurred_at
        # so the two-clock check for origin=scheduled stays satisfied.
        occurred = (datetime.now(timezone.utc) - timedelta(days=40)).replace(
            minute=0, second=0, microsecond=0
        ).isoformat().replace("+00:00", "Z")
        tour_status, tour_created = _http_json(
            "POST",
            f"{SUPABASE_URL}/rest/v1/tour_appointments",
            headers,
            {
                "venue_id": FANCY_VENUE_ID,
                "lead_id": lead_id,
                "scheduled_at": occurred,
                "completed_at": occurred,
                "duration_minutes": 60,
                "status": "completed",
                "contact_name": "Workflow Synthetic",
                "contact_email": email,
                "notes": "[ops-synthetic] Disposable tour — safe to delete.",
            },
        )
        if tour_status in (200, 201) and isinstance(tour_created, list) and tour_created:
            tour_id = tour_created[0].get("id")
        detail["tour_id"] = tour_id
        if not tour_id:
            raise RuntimeError(f"tour create failed status={tour_status} body={tour_created}")

        attach_status, attached = _http_json(
            "GET",
            f"{SUPABASE_URL}/rest/v1/tour_appointments?id=eq.{tour_id}&select=id,lead_id,venue_id",
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "User-Agent": USER_AGENT,
            },
        )
        if (
            attach_status != 200
            or not isinstance(attached, list)
            or not attached
            or attached[0].get("lead_id") != lead_id
            or attached[0].get("venue_id") != FANCY_VENUE_ID
        ):
            raise RuntimeError(f"tour attach readback failed status={attach_status}")
        tour_ok = 1

        # --- Contract draft path (never sent) ---
        contract_status, contract_created = _http_json(
            "POST",
            f"{SUPABASE_URL}/rest/v1/contracts",
            headers,
            {
                "venue_id": FANCY_VENUE_ID,
                "title": f"[ops-synthetic] Contract {stamp}",
                "content": "[ops-synthetic] Disposable draft contract — never send.",
                "status": "draft",
            },
        )
        if contract_status in (200, 201) and isinstance(contract_created, list) and contract_created:
            contract_id = contract_created[0].get("id")
        detail["contract_id"] = contract_id
        if not contract_id:
            raise RuntimeError(
                f"contract create failed status={contract_status} body={contract_created}"
            )

        cget_status, cgot = _http_json(
            "GET",
            f"{SUPABASE_URL}/rest/v1/contracts?id=eq.{contract_id}&select=id,status,sign_token",
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "User-Agent": USER_AGENT,
            },
        )
        if (
            cget_status != 200
            or not isinstance(cgot, list)
            or not cgot
            or cgot[0].get("status") != "draft"
            or not cgot[0].get("sign_token")
        ):
            raise RuntimeError(f"contract readback failed status={cget_status}")
        contract_ok = 1

        # --- Payment config + invoice draft path (never charge / never issue) ---
        v_status, venues = _http_json(
            "GET",
            (
                f"{SUPABASE_URL}/rest/v1/venues?id=eq.{FANCY_VENUE_ID}"
                "&select=id,stripe_onboarding_status,stripe_charges_enabled,stripe_account_id"
            ),
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "User-Agent": USER_AGENT,
            },
        )
        if v_status != 200 or not isinstance(venues, list) or not venues:
            raise RuntimeError(f"venue stripe config read failed status={v_status}")
        detail["stripe"] = {
            "onboarding": venues[0].get("stripe_onboarding_status"),
            "charges_enabled": venues[0].get("stripe_charges_enabled"),
            "has_account": bool(venues[0].get("stripe_account_id")),
        }

        wh_status, _wh = _http_json(
            "GET",
            f"{SUPABASE_URL}/rest/v1/stripe_webhook_events?select=id&limit=1",
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "User-Agent": USER_AGENT,
            },
        )
        if wh_status != 200:
            raise RuntimeError(f"stripe_webhook_events read failed status={wh_status}")

        inv_status, inv_created = _http_json(
            "POST",
            f"{SUPABASE_URL}/rest/v1/invoices",
            headers,
            {
                "venue_id": FANCY_VENUE_ID,
                "invoice_number": f"OPS-SYNTH-{stamp}",
                "status": "draft",
                "subtotal": 0,
                "discount_amount": 0,
                "tax_amount": 0,
                "total": 0,
                "balance_due": 0,
                "notes": "[ops-synthetic] Disposable invoice — never charge.",
            },
        )
        if inv_status in (200, 201) and isinstance(inv_created, list) and inv_created:
            invoice_id = inv_created[0].get("id")
        detail["invoice_id"] = invoice_id
        if not invoice_id:
            raise RuntimeError(f"invoice create failed status={inv_status} body={inv_created}")

        iget_status, igot = _http_json(
            "GET",
            f"{SUPABASE_URL}/rest/v1/invoices?id=eq.{invoice_id}&select=id,status",
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "User-Agent": USER_AGENT,
            },
        )
        if (
            iget_status != 200
            or not isinstance(igot, list)
            or not igot
            or igot[0].get("status") != "draft"
        ):
            raise RuntimeError(f"invoice readback failed status={iget_status}")
        payment_ok = 1

        overall = 1 if (
            health_ok and write_ok and tour_ok and contract_ok and payment_ok
        ) else 0
    except Exception as exc:  # noqa: BLE001 — canary must publish failure gauges
        detail["error"] = str(exc)[:400]
        overall = 0
    finally:
        # Best-effort cleanup — never leave disposable rows.
        try:
            key = _secret_string(SERVICE_SECRET_ID)
        except Exception:
            key = None
        if key:
            if invoice_id:
                _delete(key, "invoices", invoice_id)
            if contract_id:
                _delete(key, "contracts", contract_id)
            if tour_id:
                _delete(key, "tour_appointments", tour_id)
            if lead_id:
                _delete(key, "leads", lead_id)

    _put(
        [
            {"MetricName": "WorkflowSyntheticOk", "Value": float(overall), "Unit": "None"},
            {"MetricName": "InquiryWritePathOk", "Value": float(write_ok), "Unit": "None"},
            {"MetricName": "TourAttachPathOk", "Value": float(tour_ok), "Unit": "None"},
            {"MetricName": "ContractDraftPathOk", "Value": float(contract_ok), "Unit": "None"},
            {"MetricName": "PaymentConfigPathOk", "Value": float(payment_ok), "Unit": "None"},
            {"MetricName": "HealthSupabaseOkFromWorkflow", "Value": float(health_ok), "Unit": "None"},
        ]
    )
    return {
        "ok": bool(overall),
        "health_ok": bool(health_ok),
        "write_ok": bool(write_ok),
        "tour_ok": bool(tour_ok),
        "contract_ok": bool(contract_ok),
        "payment_ok": bool(payment_ok),
        "detail": detail,
    }
