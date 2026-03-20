#!/usr/bin/env python3
# ==========================================================
# AttackSurface Pro+ — Enterprise Edition
# Tool 19/30
# Trust Boundary & Exposure Validation Engine
# ==========================================================

import os
import sys
import re
import json
import csv
import time
import threading
import random
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from queue import Queue, Empty

import requests

# ------------------ Color Handling ------------------
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except Exception:
    class _C:
        def __getattr__(self, _): return ""
    Fore = Style = _C()

# ------------------ Configuration ------------------
REQUEST_TIMEOUT = 10
DEFAULT_THREADS = 8

OUTPUT_BASE = os.path.join("reports", "attacksurface_pro_plus")
TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
JSON_DIR = os.path.join(OUTPUT_BASE, "json")
CSV_DIR = os.path.join(OUTPUT_BASE, "csv")

for d in (TXT_DIR, JSON_DIR, CSV_DIR):
    os.makedirs(d, exist_ok=True)

# ------------------ Endpoint Buckets ------------------
PUBLIC_PATHS = [
    "/", "/health", "/status", "/ping", "/version"
]

USER_PATHS = [
    "/profile", "/account", "/user", "/settings",
    "/api/user", "/api/profile"
]

ADMIN_PATHS = [
    "/admin", "/admin/dashboard", "/admin/users",
    "/api/admin", "/manage"
]

INTERNAL_PATHS = [
    "/internal", "/_internal", "/debug", "/metrics",
    "/actuator", "/actuator/health", "/.env"
]

HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"]

# ------------------ Utilities ------------------
def utc_now():
    return datetime.now(timezone.utc)

def now_ts():
    return utc_now().strftime("%Y-%m-%d_%H-%M-%S")

def random_headers():
    return {
        "User-Agent": random.choice([
            "Mozilla/5.0",
            "curl/8.0",
            "python-requests/2.x"
        ]),
        "Accept": "*/*"
    }

def safe_request(session, method, url):
    try:
        start = time.time()
        r = session.request(
            method=method,
            url=url,
            headers=random_headers(),
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False,
            verify=False
        )
        return {
            "status": r.status_code,
            "headers": dict(r.headers),
            "length": len(r.content or b""),
            "time": round(time.time() - start, 3)
        }
    except Exception as e:
        return {"error": str(e)}

# ------------------ Finding Schema ------------------
def new_finding():
    return {
        "url": None,
        "path": None,
        "method": None,
        "category": None,

        "unauth_status": None,
        "auth_status": None,
        "behavior": None,

        "risk": None,
        "score": 0,
        "severity": "INFO",

        "timestamp": utc_now().isoformat()
    }

def score_to_severity(score):
    if score >= 90: return "CRITICAL"
    if score >= 70: return "HIGH"
    if score >= 40: return "MEDIUM"
    if score >= 10: return "LOW"
    return "INFO"

# ------------------ Core Scanner ------------------
class AttackSurfaceProPlus:
    def __init__(self, base_url, threads=DEFAULT_THREADS):
        self.base = base_url.rstrip("/")
        self.threads = threads

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "AttackSurfacePro+/Enterprise"
        })

        self.queue = Queue()
        self.findings = []
        self.lock = threading.Lock()

    def build_url(self, path):
        return urljoin(self.base + "/", path.lstrip("/"))

    def enqueue(self, path, category):
        for method in HTTP_METHODS:
            self.queue.put({
                "path": path,
                "method": method,
                "category": category
            })

    def worker(self):
        while True:
            try:
                task = self.queue.get(timeout=1)
            except Empty:
                return

            path = task["path"]
            method = task["method"]
            category = task["category"]

            url = self.build_url(path)

            unauth = safe_request(self.session, method, url)

            finding = new_finding()
            finding["url"] = url
            finding["path"] = path
            finding["method"] = method
            finding["category"] = category
            finding["unauth_status"] = unauth.get("status")

            # ---------- Trust Boundary Logic ----------
            if unauth.get("status") in (200, 201):
                if category in ("ADMIN", "INTERNAL"):
                    finding["behavior"] = "unauthenticated_access"
                    finding["risk"] = "trust_boundary_violation"
                    finding["score"] = 95
                elif category == "USER":
                    finding["behavior"] = "missing_auth_enforcement"
                    finding["risk"] = "access_control_gap"
                    finding["score"] = 75
                else:
                    finding["behavior"] = "public_ok"
                    finding["score"] = 5

            elif unauth.get("status") in (401, 403):
                finding["behavior"] = "properly_restricted"
                finding["score"] = 0

            else:
                finding["behavior"] = "unexpected_response"
                finding["score"] = 30

            finding["severity"] = score_to_severity(finding["score"])

            if finding["score"] > 0:
                with self.lock:
                    self.findings.append(finding)

            self.queue.task_done()

    def run(self):
        print(Fore.CYAN + f"[i] Starting AttackSurface Pro+ scan on {self.base}")

        for p in PUBLIC_PATHS:
            self.enqueue(p, "PUBLIC")
        for p in USER_PATHS:
            self.enqueue(p, "USER")
        for p in ADMIN_PATHS:
            self.enqueue(p, "ADMIN")
        for p in INTERNAL_PATHS:
            self.enqueue(p, "INTERNAL")

        threads = []
        for _ in range(self.threads):
            t = threading.Thread(target=self.worker, daemon=True)
            t.start()
            threads.append(t)

        self.queue.join()
        print(Fore.GREEN + f"[✓] Scan complete — {len(self.findings)} issues found")
        return self.findings

# ------------------ Reporting ------------------
def write_reports(client, base, findings):
    ts = now_ts()
    host = urlparse(base).hostname or "target"
    basefn = f"{client}_attacksurface_{host}_{ts}"

    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")

    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== ATTACKSURFACE PRO+ REPORT ===\n\n")
        tf.write(f"Target: {base}\nGenerated: {utc_now()}\n\n")

        for f in sorted(findings, key=lambda x: x["score"], reverse=True):
            tf.write("-" * 60 + "\n")
            tf.write(f"Severity: {f['severity']}\n")
            tf.write(f"Score: {f['score']}\n")
            tf.write(f"URL: {f['url']}\n")
            tf.write(f"Method: {f['method']}\n")
            tf.write(f"Category: {f['category']}\n")
            tf.write(f"Behavior: {f['behavior']}\n")
            tf.write(f"Risk: {f['risk']}\n\n")

    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(findings, jf, indent=2)

    with open(csv_path, "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow([
            "severity", "score", "url", "method",
            "category", "behavior", "risk"
        ])
        for f in findings:
            writer.writerow([
                f["severity"], f["score"], f["url"],
                f["method"], f["category"],
                f["behavior"], f["risk"]
            ])

    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")

# ------------------ CLI ------------------
def main():
    print("\n=== AttackSurface Pro+ — Enterprise Edition ===\n")

    client = input("Client name: ").strip() or "client"
    base = input("Base URL (https://example.com): ").strip()

    if not base.startswith(("http://", "https://")):
        base = "https://" + base

    threads_in = input(f"Threads (default {DEFAULT_THREADS}): ").strip()
    threads = int(threads_in) if threads_in.isdigit() else DEFAULT_THREADS

    print("\n[!] Only scan systems you own or have permission to test.")
    confirm = input("Type 'YES' to confirm permission: ").strip()
    if confirm != "YES":
        print("Permission not granted. Exiting.")
        return

    scanner = AttackSurfaceProPlus(base, threads=threads)
    findings = scanner.run()
    write_reports(client, base, findings)

    print(Fore.GREEN + "\n[✓] AttackSurface Pro+ finished.\n")

if __name__ == "__main__":
    main()
