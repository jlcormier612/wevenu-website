"""
Sandbox-only: SNS → Resend email fanout for human ops alerts.

Used while SNS email subscription may remain PendingConfirmation.
Does not log API keys or full customer payloads.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

import boto3

NAMESPACE = "HTC/Sandbox"
SECRET_ID = os.environ.get("RESEND_SECRET_ID", "htc/sandbox/resend-api-key")
OPS_TO = os.environ.get("OPS_ALERT_TO", "jennifer@hellotocheers.com")
OPS_FROM = os.environ.get(
    "OPS_ALERT_FROM",
    "Hello to Cheers Ops <jennifer@hellotocheers.com>",
)
USER_AGENT = "HTC-Sandbox-OpsAlertEmail/1.0"


def _secret_string(secret_id: str) -> str:
    raw = boto3.client("secretsmanager").get_secret_value(SecretId=secret_id)["SecretString"]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            for key in ("api_key", "apiKey", "RESEND_API_KEY", "key", "token"):
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


def _format_message(record: dict[str, Any]) -> tuple[str, str]:
    message_id = str(record.get("MessageId") or "unknown")
    subject_base = str(record.get("Subject") or "HTC Sandbox ops alert")
    raw = record.get("Message") or ""
    # CloudWatch alarm JSON is common; keep text short and actionable.
    detail = raw
    alarm_name = None
    new_state = None
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            alarm_name = parsed.get("AlarmName")
            new_state = parsed.get("NewStateValue")
            reason = parsed.get("NewStateReason") or ""
            detail = (
                f"Alarm: {alarm_name}\n"
                f"State: {new_state}\n"
                f"Reason: {reason}\n"
                f"SNS MessageId: {message_id}\n"
                f"Region: us-east-1\n"
                f"Action: Open AWS CloudWatch alarms for htc-sandbox-* "
                f"and recent /ecs/htc-sandbox/venue-app logs. "
                f"Do not ignore recovery (OK) notices.\n"
            )
    except Exception:
        detail = f"{raw[:4000]}\n\nSNS MessageId: {message_id}\n"

    state_prefix = f"[{new_state}] " if new_state else ""
    name_bit = alarm_name or subject_base
    subject = f"{state_prefix}HTC Sandbox: {name_bit}"
    return subject, detail


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    del context
    api_key = _secret_string(SECRET_ID)
    results: list[dict[str, Any]] = []
    for record in event.get("Records") or []:
        # SNS envelope
        sns = record.get("Sns") or record
        subject, text = _format_message(sns if isinstance(sns, dict) else {})
        ok, detail = _send_resend(api_key, subject, text)
        if ok:
            _put("OpsAlertEmailSuccess", 1.0)
            print(f"OpsAlertEmailSuccess id={detail} subject_len={len(subject)}")
        else:
            _put("OpsAlertEmailFailure", 1.0)
            print(f"OpsAlertEmailFailure detail={detail[:200]!r}")
        results.append({"ok": ok, "ref": detail[:80]})
    return {"ok": all(r["ok"] for r in results) if results else False, "results": results}
