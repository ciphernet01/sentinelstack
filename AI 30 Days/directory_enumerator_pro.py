#!/usr/bin/env python3
"""
Directory & File Enumerator PRO (DFE-PRO)
- Multi-threaded directory brute-force scanner
- Detects hidden admin panels, exposed configs, backups, secret endpoints
- Generates TXT + JSON security reports
"""

import requests
import threading
import queue
import os
import json
from datetime import datetime

# ------------------------
# Folders
# ------------------------
TXT_DIR = "reports/directory_scan/txt"
JSON_DIR = "reports/directory_scan/json"
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)

# ------------------------
# Wordlists
# ------------------------
DEFAULT_WORDS = [
    "admin", "administrator", "dashboard", "login", "cpanel", "config",
    "test", "dev", "staging", "backup", "db", "portal", "secret",
    ".env", "config.php", "wp-admin", "wp-login.php", "server-status",
    "phpinfo.php", "logs", "errors", "uploads", "private", "api",
    "v1", "v2", "internal", "backup.zip", "site.zip", "debug",
    "debug.php", "auth", "root", "hidden", "include", "core"
]

BACKUP_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".gz", ".bak", ".old", ".backup"]

RISK_KEYWORDS = {
    "admin": 40, "login": 30, ".env": 90, "config": 80,
    "backup": 70, "test": 20, "dev": 30, "staging": 40,
    "api": 25, "internal": 60
}

# ------------------------
# Core Scanner
# ------------------------
def fetch(url):
    try:
        r = requests.get(url, timeout=5, allow_redirects=False)
        return r.status_code, len(r.content)
    except:
        return None, None

def risk_score(path):
    score = 0
    for key, val in RISK_KEYWORDS.items():
        if key in path.lower():
            score += val
    return score

# Thread worker
def worker(base, q, results):
    while True:
        try:
            item = q.get(timeout=1)
        except:
            return

        url = f"{base}/{item}"
        status, size = fetch(url)

        # IMPORTANT: Only flag actual exposures (200) or blocked-but-exists (403)
        # Skip redirects (301/302) - they indicate protection, not exposure
        # Skip errors (500) - server issues are not vulnerabilities
        if status and status in [200, 403]:
            # For 403, reduce risk score since it's blocked
            adjusted_risk = risk_score(item)
            if status == 403:
                adjusted_risk = min(adjusted_risk, 20)  # Cap at LOW for blocked paths
            
            results.append({
                "path": item,
                "url": url,
                "status": status,
                "size": size,
                "risk": adjusted_risk,
                "blocked": status == 403
            })
            if status == 200:
                print(f"[FOUND] {status} | {item} | risk={adjusted_risk}")
            else:
                print(f"[BLOCKED] {status} | {item} | exists but protected")

        q.task_done()

# ------------------------
# Report Writing
# ------------------------
def write_reports(client, base, results):
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    base_name = f"{client}_directory_scan_{ts}"

    txt_path = f"{TXT_DIR}/{base_name}.txt"
    json_path = f"{JSON_DIR}/{base_name}.json"

    # TXT
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=== DIRECTORY ENUMERATOR PRO REPORT ===\n\n")
        f.write(f"Client: {client}\nURL: {base}\n\n")

        for r in results:
            f.write(f"- {r['path']} | {r['status']} | size={r['size']} | risk={r['risk']}\n")

    # JSON
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(results, jf, indent=2, ensure_ascii=False)

    print(f"\n[✓] TXT → {txt_path}")
    print(f"[✓] JSON → {json_path}\n")

# ------------------------
# Main
# ------------------------
def main():
    print("\n=== DIRECTORY ENUMERATOR PRO ===\n")
    client = input("Client name: ").strip()
    base = input("Enter base URL (https://example.com): ").strip()

    threads = int(input("Threads (default 30): ") or "30")
    custom_word = input("Extra wordlist file (optional): ").strip()

    # Final wordlist
    words = list(DEFAULT_WORDS)

    if custom_word and os.path.isfile(custom_word):
        with open(custom_word, "r") as f:
            for line in f:
                words.append(line.strip())

    # Add backup permutations
    for w in DEFAULT_WORDS:
        for ext in BACKUP_EXTENSIONS:
            words.append(w + ext)

    q = queue.Queue()
    results = []

    for w in words:
        q.put(w)

    print("\nStarting scan...\n")

    # start workers
    for _ in range(threads):
        t = threading.Thread(target=worker, args=(base, q, results))
        t.daemon = True
        t.start()

    q.join()

    results.sort(key=lambda x: x["risk"], reverse=True)
    write_reports(client, base, results)

    print("Scan complete.\n")


if __name__ == "__main__":
    main()
