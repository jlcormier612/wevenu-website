import json, urllib.request, boto3, os
cw = boto3.client("cloudwatch")
HEALTH_URL = os.environ.get("HEALTH_URL", "https://app.sandbox.hellotocheers.com/api/health")

def handler(event, context):
    ok = 0
    detail = {"error": None, "body": None, "status": None}
    try:
        req = urllib.request.Request(HEALTH_URL, headers={"User-Agent": "htc-sandbox-health-canary/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            detail["status"] = resp.status
            body = resp.read().decode("utf-8", "replace")
            detail["body"] = body[:500]
            data = json.loads(body)
            if data.get("ok") is True and (data.get("checks") or {}).get("supabase") == "ok":
                ok = 1
    except Exception as e:
        detail["error"] = str(e)[:300]
    cw.put_metric_data(
        Namespace="HTC/Sandbox",
        MetricData=[
            {"MetricName": "HealthSupabaseOk", "Value": float(ok), "Unit": "None"},
            {"MetricName": "HealthCanarySuccess", "Value": float(ok), "Unit": "None"},
        ],
    )
    return {"ok": bool(ok), "detail": detail}
