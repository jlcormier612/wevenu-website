"""
Sandbox-only: poll Resend /usage and publish CloudWatch gauges.

Secrets: htc/sandbox/resend-api-key (value never logged).
Metrics namespace: HTC/Sandbox
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

import boto3

NAMESPACE = "HTC/Sandbox"
SECRET_ID = os.environ.get("RESEND_SECRET_ID", "htc/sandbox/resend-api-key")
USER_AGENT = "HTC-Sandbox-ResendUsageCanary/1.0"


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


def _fetch_usage(api_key: str) -> dict[str, Any]:
    req = urllib.request.Request(
        "https://api.resend.com/usage",
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": USER_AGENT,
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _pct(used: float, limit: float) -> float:
    if limit <= 0:
        return 0.0
    return round(100.0 * float(used) / float(limit), 2)


def _put_metrics(metrics: list[tuple[str, float]]) -> None:
    cw = boto3.client("cloudwatch")
    cw.put_metric_data(
        Namespace=NAMESPACE,
        MetricData=[
            {
                "MetricName": name,
                "Value": value,
                "Unit": "None",
            }
            for name, value in metrics
        ],
    )


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    del event, context
    try:
        api_key = _secret_string(SECRET_ID)
        usage = _fetch_usage(api_key)
        emails = (usage.get("emails") or {}) if isinstance(usage, dict) else {}
        daily = emails.get("daily") or {}
        monthly = emails.get("monthly") or {}
        daily_used = float(daily.get("used") or 0)
        daily_limit = float(daily.get("limit") or 0)
        monthly_used = float(monthly.get("used") or 0)
        monthly_limit = float(monthly.get("limit") or 0)
        daily_pct = _pct(daily_used, daily_limit)
        monthly_pct = _pct(monthly_used, monthly_limit)
        rate = (usage.get("rate_limit") or {}) if isinstance(usage, dict) else {}
        rate_limit = float(rate.get("limit") or 0)
        # Rough pace: remaining monthly / (used/day-of-month approximation).
        # Day-of-month from UTC; never divide by zero.
        day = max(1, datetime.now(timezone.utc).day)
        daily_pace = monthly_used / float(day)
        remaining = max(0.0, monthly_limit - monthly_used)
        days_to_exhaust = (remaining / daily_pace) if daily_pace > 0 else 999.0
        days_to_exhaust = round(min(days_to_exhaust, 999.0), 2)

        _put_metrics(
            [
                ("ResendDailyUsed", daily_used),
                ("ResendDailyLimit", daily_limit),
                ("ResendDailyUsagePercent", daily_pct),
                ("ResendMonthlyUsed", monthly_used),
                ("ResendMonthlyLimit", monthly_limit),
                ("ResendMonthlyUsagePercent", monthly_pct),
                ("ResendRateLimitPerSecond", rate_limit),
                ("ResendMonthlyDaysToExhaustion", days_to_exhaust),
                ("ResendUsageCanaryOk", 1.0),
            ]
        )
        return {
            "ok": True,
            "daily": {"used": daily_used, "limit": daily_limit, "pct": daily_pct},
            "monthly": {"used": monthly_used, "limit": monthly_limit, "pct": monthly_pct},
            "rate_limit_per_second": rate_limit,
            "monthly_days_to_exhaustion_at_pace": days_to_exhaust,
            "monthly_daily_pace": round(daily_pace, 2),
        }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        _put_metrics([("ResendUsageCanaryOk", 0.0)])
        print(f"ResendUsageCanaryFailure status={exc.code} body={body!r}")
        return {"ok": False, "error": f"http_{exc.code}"}
    except Exception as exc:  # noqa: BLE001 — canary must never raise uncaught to EventBridge storms
        _put_metrics([("ResendUsageCanaryOk", 0.0)])
        print(f"ResendUsageCanaryFailure error={type(exc).__name__}")
        return {"ok": False, "error": type(exc).__name__}
