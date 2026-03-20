import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib import request, error


def build_alert_payload(
    anomalies: List[Dict[str, Any]],
    crash_reports: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    crash_reports = crash_reports or []
    scores = [float(item.get("anomaly_score", 0.0)) for item in anomalies]
    return {
        "event": "log_whisperer_alert",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "anomaly_count": len(anomalies),
        "max_anomaly_score": max(scores) if scores else 0.0,
        "services": sorted({str(item.get("service", "unknown")) for item in anomalies}),
        "anomalies": anomalies,
        "crash_reports": crash_reports,
    }


def send_webhook(url: str, payload: Dict[str, Any], timeout_sec: int = 8) -> Tuple[bool, Optional[int], str]:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "Log-Whisperer/0.1"},
    )

    try:
        with request.urlopen(req, timeout=timeout_sec) as resp:
            status = int(getattr(resp, "status", 200))
            if 200 <= status < 300:
                return True, status, "Alert delivered successfully"
            return False, status, f"Webhook returned non-success status: {status}"
    except error.HTTPError as exc:
        return False, int(exc.code), f"Webhook HTTP error: {exc.code}"
    except error.URLError as exc:
        return False, None, f"Webhook network error: {exc.reason}"
    except Exception as exc:
        return False, None, f"Webhook send failed: {exc}"
