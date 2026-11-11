"""
Sandbox-only: SNS → (1) persist HQ ops_incident (2) Resend email.

Channels are independent: email failure does not roll back the incident;
incident persistence failure does not block email.
Does not log API keys or full customer payloads.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import boto3

NAMESPACE = "HTC/Sandbox"
SECRET_ID = os.environ.get("RESEND_SECRET_ID", "htc/sandbox/resend-api-key")
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://wvpsldwwjqdannqasrdf.supabase.co"
).rstrip("/")
SUPABASE_SECRET_ID = os.environ.get(
    "SUPABASE_SERVICE_ROLE_SECRET_ID", "htc/sandbox/supabase-service-role-key"
)
OPS_TO = os.environ.get("OPS_ALERT_TO", "jennifer@hellotocheers.com")
OPS_FROM = os.environ.get(
    "OPS_ALERT_FROM",
    "Hello to Cheers Ops <jennifer@hellotocheers.com>",
)
USER_AGENT = "HTC-Sandbox-OpsAlertEmail/1.1"
HQ_ALERTS_PATH = "/admin/ops-alerts"


def _secret_string(secret_id: str) -> str:
    raw = boto3.client("secretsmanager").get_secret_value(SecretId=secret_id)["SecretString"]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            for key in ("api_key", "apiKey", "RESEND_API_KEY", "key", "token", "value", "service_role"):
                if parsed.get(key):
                    return str(parsed[key])
            if len(parsed) == 1:
                return str(next(iter(parsed.values())))
    except Exception:
        pass
    return raw


def _put(name: str, value: float) -> None:
    boto3.client("cloudwatch").put_metric_data(
        Namespace=NAMESPACE,
        MetricData=[{"MetricName": name, "Value": value, "Unit": "Count"}],
    )


def _classify(alarm_name: str | None) -> tuple[str, str, str]:
    name = (alarm_name or "").lower()
    if any(x in name for x in ("health-supabase", "unhealthy", "alb-target-5xx")):
        return (
            "infrastructure",
            "critical",
            "Check /api/health, ECS tasks, and recent Sandbox deploys. Confirm ALB target health.",
        )
    if "supabase-restriction" in name:
        return (
            "supabase",
            "critical",
            "Stop heavy QA traffic. Review Supabase Dashboard Usage. Do not rotate secrets.",
        )
    if "auth-retryable" in name:
        return (
            "auth",
            "high",
            "Inspect venue-app logs for Auth storms; confirm tip still has Auth amp fix.",
        )
    if "crm-contention" in name:
        return (
            "database",
            "high",
            "Inspect venue-app logs for CRM contention; avoid store rewrite storms.",
        )
    if "resend-provider-limit" in name or "ops-alert-email-failures" in name:
        return (
            "resend",
            "high",
            "Check Resend /usage and ops-alert-email Lambda logs. In-product alerts remain authoritative.",
        )
    if "usage-canary-down" in name or "sns-notifications-failed" in name:
        return (
            "monitoring",
            "high",
            "Monitoring path degraded — verify canaries and SNS subscriptions.",
        )
    if "resend" in name and "usage" in name:
        return (
            "resend",
            "warning",
            "Pause bulk/QA sends. Review daily/monthly Resend allowance before exhaustion.",
        )
    return (
        "platform",
        "high",
        "Review CloudWatch alarm detail and recent Sandbox logs.",
    )


def _send_resend(api_key: str, subject: str, text: str) -> tuple[bool, str]:
    payload = json.dumps(
        {
            "from": OPS_FROM,
            "to": [OPS_TO],
            "subject": subject[:200],
            "text": text[:8000],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return True, str(body.get("id") or "ok")
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")[:300]
        return False, f"http_{exc.code}:{err}"


def _parse_alarm(record: dict[str, Any]) -> dict[str, Any]:
    message_id = str(record.get("MessageId") or "unknown")
    subject_base = str(record.get("Subject") or "HTC Sandbox ops alert")
    raw = record.get("Message") or ""
    alarm_name = None
    new_state = None
    reason = ""
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            alarm_name = parsed.get("AlarmName")
            new_state = parsed.get("NewStateValue")
            reason = str(parsed.get("NewStateReason") or "")[:500]
    except Exception:
        pass
    service, severity, action = _classify(str(alarm_name) if alarm_name else None)
    dedupe_key = f"cw:{alarm_name}" if alarm_name else f"sns:{message_id}"
    title = str(alarm_name or subject_base)
    is_recovery = str(new_state or "").upper() == "OK"
    return {
        "message_id": message_id,
        "alarm_name": alarm_name,
        "new_state": new_state,
        "reason": reason,
        "raw_preview": str(raw)[:800],
        "service": service,
        "severity": severity,
        "action": action,
        "dedupe_key": dedupe_key,
        "title": title,
        "is_recovery": is_recovery,
        "subject_base": subject_base,
    }


def _supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
        "User-Agent": USER_AGENT,
    }


def _http_json(
    method: str, url: str, headers: dict[str, str], body: dict[str, Any] | None = None
) -> tuple[bool, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return True, None
            return True, json.loads(raw)
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")[:400]
        return False, f"http_{exc.code}:{err}"
    except Exception as exc:  # noqa: BLE001
        return False, f"err:{type(exc).__name__}"


def _persist_incident(service_key: str, parsed: dict[str, Any]) -> tuple[bool, str | None]:
    """Upsert ops_incidents by dedupe_key. Returns (ok, incident_id)."""
    headers = _supabase_headers(service_key)
    dedupe = parsed["dedupe_key"]
    is_recovery = parsed["is_recovery"]

    get_url = (
        f"{SUPABASE_URL}/rest/v1/ops_incidents"
        f"?dedupe_key=eq.{quote(dedupe, safe='')}&select=id,status,severity,observation_count"
    )
    ok, existing = _http_json("GET", get_url, headers)
    if not ok:
        _put("OpsIncidentPersistFailure", 1.0)
        print(f"OpsIncidentPersistFailure get detail={str(existing)[:200]!r}")
        return False, None

    rows = existing if isinstance(existing, list) else []
    incident_id = rows[0]["id"] if rows else None
    prev_status = rows[0].get("status") if rows else None
    obs = int(rows[0].get("observation_count") or 0) if rows else 0

    summary = (
        f"State: {parsed['new_state'] or 'n/a'}. {parsed['reason'] or 'CloudWatch alarm notification.'}"
    )[:2000]
    diagnostic = {
        "snsMessageId": parsed["message_id"],
        "newState": parsed["new_state"],
        "reason": parsed["reason"],
        "hqPath": HQ_ALERTS_PATH,
    }

    if incident_id:
        patch: dict[str, Any] = {
            "last_observed_at": "now()",
            "observation_count": obs + 1,
            "summary": summary,
            "diagnostic": diagnostic,
            "source_event_id": parsed["message_id"],
            "updated_at": "now()",
        }
        iso = datetime.now(timezone.utc).isoformat()
        patch["last_observed_at"] = iso
        patch["updated_at"] = iso

        if is_recovery:
            patch["status"] = "recovered"
            patch["recovered_at"] = iso
        else:
            # Re-open recovered/resolved on new ALARM; keep acknowledged until recovery.
            if prev_status in ("recovered", "resolved", None):
                patch["status"] = "active"
                patch["recovered_at"] = None
                patch["resolved_at"] = None
            elif prev_status == "active":
                patch["status"] = "active"
            # acknowledged stays acknowledged on re-observe
            patch["severity"] = parsed["severity"]
            patch["recommended_action"] = parsed["action"]

        # Drop keys that would clear with JSON null incorrectly when not reopening
        if "recovered_at" in patch and patch["recovered_at"] is None and prev_status not in (
            "recovered",
            "resolved",
            None,
        ):
            del patch["recovered_at"]
            patch.pop("resolved_at", None)

        ok, body = _http_json(
            "PATCH",
            f"{SUPABASE_URL}/rest/v1/ops_incidents?id=eq.{incident_id}",
            headers,
            patch,
        )
        if not ok:
            _put("OpsIncidentPersistFailure", 1.0)
            print(f"OpsIncidentPersistFailure patch detail={str(body)[:200]!r}")
            return False, incident_id
        event_type = "recovered" if is_recovery else ("observed" if prev_status else "detected")
        _http_json(
            "POST",
            f"{SUPABASE_URL}/rest/v1/ops_incident_events",
            headers,
            {
                "incident_id": incident_id,
                "event_type": event_type,
                "severity": parsed["severity"],
                "message": summary[:500],
                "metadata": {"snsMessageId": parsed["message_id"], "state": parsed["new_state"]},
            },
        )
        _put("OpsIncidentPersistSuccess", 1.0)
        return True, incident_id

    iso = datetime.now(timezone.utc).isoformat()
    insert = {
        "dedupe_key": dedupe,
        "source_service": parsed["service"],
        "source_alarm": parsed["alarm_name"],
        "source_event_id": parsed["message_id"],
        "severity": parsed["severity"],
        "status": "recovered" if is_recovery else "active",
        "title": parsed["title"][:300],
        "summary": summary,
        "recommended_action": parsed["action"],
        "diagnostic": diagnostic,
        "first_detected_at": iso,
        "last_observed_at": iso,
        "recovered_at": iso if is_recovery else None,
        "observation_count": 1,
    }
    ok, body = _http_json("POST", f"{SUPABASE_URL}/rest/v1/ops_incidents", headers, insert)
    if not ok:
        _put("OpsIncidentPersistFailure", 1.0)
        print(f"OpsIncidentPersistFailure insert detail={str(body)[:200]!r}")
        return False, None
    new_id = None
    if isinstance(body, list) and body:
        new_id = body[0].get("id")
    elif isinstance(body, dict):
        new_id = body.get("id")
    if new_id:
        _http_json(
            "POST",
            f"{SUPABASE_URL}/rest/v1/ops_incident_events",
            headers,
            {
                "incident_id": new_id,
                "event_type": "recovered" if is_recovery else "detected",
                "severity": parsed["severity"],
                "message": summary[:500],
                "metadata": {"snsMessageId": parsed["message_id"], "state": parsed["new_state"]},
            },
        )
    _put("OpsIncidentPersistSuccess", 1.0)
    return True, new_id


def _record_email_attempt(
    service_key: str | None,
    incident_id: str | None,
    message_id: str,
    ok: bool,
    ref: str,
) -> None:
    if not service_key or not incident_id:
        return
    headers = _supabase_headers(service_key)
    iso = datetime.now(timezone.utc).isoformat()
    idem = f"email:{incident_id}:{message_id}"
    _http_json(
        "POST",
        f"{SUPABASE_URL}/rest/v1/ops_notification_attempts",
        {**headers, "Prefer": "resolution=ignore-duplicates,return=minimal"},
        {
            "incident_id": incident_id,
            "channel": "email",
            "outcome": "accepted" if ok else "failed",
            "provider_ref": ref[:200],
            "error_safe": None if ok else ref[:300],
            "idempotency_key": idem,
        },
    )
    _http_json(
        "PATCH",
        f"{SUPABASE_URL}/rest/v1/ops_incidents?id=eq.{incident_id}",
        headers,
        {
            "last_email_notified_at": iso,
            "last_email_outcome": "accepted" if ok else "failed",
            "last_email_ref": ref[:120],
            "updated_at": iso,
        },
    )
    _http_json(
        "POST",
        f"{SUPABASE_URL}/rest/v1/ops_incident_events",
        headers,
        {
            "incident_id": incident_id,
            "event_type": "email_attempt" if ok else "email_failed",
            "message": "Email accepted by Resend" if ok else f"Email failed: {ref[:180]}",
            "metadata": {"providerRef": ref[:80]},
        },
    )


def _format_email(parsed: dict[str, Any], incident_id: str | None) -> tuple[str, str]:
    state_prefix = f"[{parsed['new_state']}] " if parsed["new_state"] else ""
    subject = f"{state_prefix}HTC Sandbox: {parsed['title']}"
    hq = f"https://app.sandbox.hellotocheers.com{HQ_ALERTS_PATH}"
    if incident_id:
        hq = f"{hq}/{incident_id}"
    detail = (
        f"Alarm: {parsed['alarm_name']}\n"
        f"State: {parsed['new_state']}\n"
        f"Severity: {parsed['severity']}\n"
        f"Service: {parsed['service']}\n"
        f"Reason: {parsed['reason']}\n"
        f"SNS MessageId: {parsed['message_id']}\n"
        f"HQ alert: {hq}\n"
        f"Next: {parsed['action']}\n"
        f"Region: us-east-1\n"
        f"Do not ignore recovery (OK) notices.\n"
    )
    return subject, detail


def _should_email(parsed: dict[str, Any], prev_status: str | None, is_new: bool) -> bool:
    """Email on create, recovery, or re-open from recovered — not every re-observe."""
    if parsed["is_recovery"]:
        return True
    if is_new:
        return True
    if prev_status in ("recovered", "resolved", None):
        return True
    # Escalation-style re-open already covered; skip duplicate ALARM polls.
    return False


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    del context
    api_key = _secret_string(SECRET_ID)
    service_key: str | None
    try:
        service_key = _secret_string(SUPABASE_SECRET_ID)
    except Exception as exc:  # noqa: BLE001
        print(f"OpsIncidentPersistFailure secret={type(exc).__name__}")
        service_key = None
        _put("OpsIncidentPersistFailure", 1.0)

    results: list[dict[str, Any]] = []
    for record in event.get("Records") or []:
        sns = record.get("Sns") or record
        parsed = _parse_alarm(sns if isinstance(sns, dict) else {})

        incident_id: str | None = None
        persist_ok = False
        prev_status = None
        is_new = True
        if service_key:
            # Peek existing for email gating
            headers = _supabase_headers(service_key)
            get_url = (
                f"{SUPABASE_URL}/rest/v1/ops_incidents"
                f"?dedupe_key=eq.{quote(parsed['dedupe_key'], safe='')}&select=id,status"
            )
            ok_peek, existing = _http_json("GET", get_url, headers)
            if ok_peek and isinstance(existing, list) and existing:
                is_new = False
                prev_status = existing[0].get("status")
            persist_ok, incident_id = _persist_incident(service_key, parsed)
        else:
            print("OpsIncidentPersistSkipped no_service_key")

        send_email = _should_email(parsed, prev_status, is_new)
        email_ok = False
        email_ref = "skipped"
        if send_email:
            subject, text = _format_email(parsed, incident_id)
            email_ok, email_ref = _send_resend(api_key, subject, text)
            if email_ok:
                _put("OpsAlertEmailSuccess", 1.0)
                print(f"OpsAlertEmailSuccess id={email_ref} subject_len={len(subject)}")
            else:
                _put("OpsAlertEmailFailure", 1.0)
                print(f"OpsAlertEmailFailure detail={email_ref[:200]!r}")
            _record_email_attempt(service_key, incident_id, parsed["message_id"], email_ok, email_ref)
        else:
            print(
                f"OpsAlertEmailSkipped dedupe={parsed['dedupe_key']} "
                f"prev={prev_status} state={parsed['new_state']}"
            )
            email_ok = True  # channel intentionally skipped — not a failure
            email_ref = "skipped_duplicate"

        results.append(
            {
                "ok": bool(email_ok or persist_ok),
                "email_ok": email_ok,
                "persist_ok": persist_ok,
                "incident_id": incident_id,
                "ref": email_ref[:80],
            }
        )

    return {
        "ok": all(r["ok"] for r in results) if results else False,
        "results": results,
    }
