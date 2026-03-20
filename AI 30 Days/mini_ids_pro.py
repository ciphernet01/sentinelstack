#!/usr/bin/env python3
"""
Mini-IDS PRO — Polling Mode (Windows Stable Edition)
- Reliable on Windows even when watchdog fails
- Monitors log files by checking file size every 0.5s
- Detects SQLi, XSS, brute-force, scanners, high rate, repeated 403
- Writes alerts to reports/ids/txt and reports/ids/json
"""

import os
import re
import json
import time
from collections import defaultdict, deque, Counter
from datetime import datetime, timedelta

# -------------------------
# CONFIG
# -------------------------
ALERT_TXT_DIR = "reports/ids/txt"
ALERT_JSON_DIR = "reports/ids/json"
os.makedirs(ALERT_TXT_DIR, exist_ok=True)
os.makedirs(ALERT_JSON_DIR, exist_ok=True)

POLL_INTERVAL = 0.5  # seconds

BRUTE_FORCE_THRESHOLD = 15
BRUTE_FORCE_WINDOW = 300

RATE_ANOMALY_THRESHOLD = 80
RATE_ANOMALY_WINDOW = 60

REPEATED_403_THRESHOLD = 20
REPEATED_403_WINDOW = 600

SUSPICIOUS_UA = ["sqlmap", "acunetix", "nmap", "dirbuster", "masscan"]
SQLI_PATTERNS = [r"union(\s)+select", r"or\s+1=1", r"sleep\(", r"benchmark\("]
XSS_PATTERNS = [r"<script", r"javascript:", r"onerror=", r"onload="]

sqlire = [re.compile(p, re.I) for p in SQLI_PATTERNS]
xssre = [re.compile(p, re.I) for p in XSS_PATTERNS]

ip_re = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
status_re = re.compile(r"\"\s*(\d{3})\s")  # basic " ... " 200 pattern

ip_events = defaultdict(deque)
alerts = []
file_offsets = {}

CURRENT_CLIENT = None


# -------------------------
# Helpers
# -------------------------
def now_ts():
    return datetime.utcnow().isoformat() + "Z"


def extract_ip(line):
    m = ip_re.search(line)
    return m.group(0) if m else None


def extract_status(line):
    m = status_re.search(line)
    return int(m.group(1)) if m else None


def detect_sqli_xss(line):
    flags = []
    for r in sqlire:
        if r.search(line):
            flags.append("SQLi")
            break
    for r in xssre:
        if r.search(line):
            flags.append("XSS")
            break
    return flags


def write_alert(client, alert):
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    txt_path = f"{ALERT_TXT_DIR}/{client}_ids_alerts_{ts}.txt"
    json_path = f"{ALERT_JSON_DIR}/{client}_ids_alerts_{ts}.json"

    # TXT
    with open(txt_path, "a", encoding="utf-8") as f:
        f.write(f"[{now_ts()}] {alert['title']} | IP: {alert.get('ip')}\n")
        f.write(json.dumps(alert, indent=2))
        f.write("\n\n")

    # JSON
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(alert, jf, indent=2)


# -------------------------
# Detection Logic
# -------------------------
def record(ip, status, path, line):
    ts = datetime.utcnow()
    ev = (ts, status, path, line)
    dq = ip_events[ip]
    dq.append(ev)

    # Trim old
    cutoff = datetime.utcnow() - timedelta(seconds=600)
    while dq and dq[0][0] < cutoff:
        dq.popleft()

    check_bruteforce(ip)
    check_rate(ip)
    check_repeated_403(ip)
    check_attack_patterns(ip, line)
    check_scanner(ip, line)


def alert_push(ip, alert):
    alert["detected_at"] = now_ts()
    alerts.append(alert)
    print(f"\n[ALERT] {alert['title']} | {ip}\n")
    write_alert(CURRENT_CLIENT, alert)


def check_bruteforce(ip):
    dq = ip_events[ip]
    now = datetime.utcnow()
    fails = sum(1 for t, status, p, l in dq if status in [401, 403] and (now - t).total_seconds() <= BRUTE_FORCE_WINDOW)

    if fails >= BRUTE_FORCE_THRESHOLD:
        alert_push(ip, {
            "title": "Brute-force detected",
            "ip": ip,
            "count": fails,
            "severity": "HIGH"
        })


def check_rate(ip):
    dq = ip_events[ip]
    now = datetime.utcnow()
    hits = sum(1 for t, s, p, l in dq if (now - t).total_seconds() <= RATE_ANOMALY_WINDOW)

    if hits >= RATE_ANOMALY_THRESHOLD:
        alert_push(ip, {
            "title": "High request rate",
            "ip": ip,
            "count": hits,
            "severity": "MEDIUM"
        })


def check_repeated_403(ip):
    dq = ip_events[ip]
    now = datetime.utcnow()
    count403 = sum(1 for t, s, p, l in dq if s == 403 and (now - t).total_seconds() <= REPEATED_403_WINDOW)

    if count403 >= REPEATED_403_THRESHOLD:
        alert_push(ip, {
            "title": "Repeated 403 access",
            "ip": ip,
            "count": count403,
            "severity": "MEDIUM"
        })


def check_attack_patterns(ip, line):
    flags = detect_sqli_xss(line)
    if flags:
        alert_push(ip, {
            "title": "Injection Attack Pattern",
            "ip": ip,
            "flags": flags,
            "severity": "HIGH"
        })


def check_scanner(ip, line):
    if any(bot in line.lower() for bot in SUSPICIOUS_UA):
        alert_push(ip, {
            "title": "Scanner User-Agent",
            "ip": ip,
            "severity": "MEDIUM"
        })


# -------------------------
# File Poller
# -------------------------
def poll_file(path):
    old = file_offsets.get(path, 0)
    try:
        new_size = os.path.getsize(path)
        if new_size < old:
            old = 0  # file truncated
        if new_size == old:
            return
        with open(path, "r", errors="ignore") as f:
            f.seek(old)
            lines = f.readlines()
            file_offsets[path] = f.tell()
    except:
        return

    for line in lines:
        ip = extract_ip(line)
        if not ip:
            continue
        status = extract_status(line)
        record(ip, status, path, line)


# -------------------------
# Main
# -------------------------
def main():
    global CURRENT_CLIENT

    print("\n=== MINI-IDS PRO (Polling Mode) ===\n")
    CURRENT_CLIENT = input("Client name: ").strip() or "client"

    paths = input("Enter log files/folders (comma separated): ").strip()
    if not paths:
        print("No paths provided. Exiting.")
        return

    watch_paths = [p.strip() for p in paths.split(",")]

    # Initialize offsets
    for p in watch_paths:
        if os.path.isfile(p):
            file_offsets[p] = os.path.getsize(p)
            print(f"[WATCH] {p}")
        else:
            print(f"[WARN] Not a file: {p}")

    print("\n[INFO] Polling started... (Ctrl+C to stop)\n")

    try:
        while True:
            for p in watch_paths:
                if os.path.isfile(p):
                    poll_file(p)
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("\nStopping IDS...")

    # Final summary
    summary_path = f"{ALERT_JSON_DIR}/{CURRENT_CLIENT}_ids_summary.json"
    with open(summary_path, "w") as jf:
        json.dump(alerts, jf, indent=2)
    print(f"\n[✓] Final summary saved → {summary_path}")


if __name__ == "__main__":
    main()
