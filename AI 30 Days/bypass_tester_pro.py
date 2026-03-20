# bypass_tester_pro_enterprise.py  (Part 1/3)
# 403 Bypass & Access Control Tester PRO — Enterprise (Part 1)
# Save Parts 1→3 in sequence into bypass_tester_pro_enterprise.py

import os
import re
import sys
import time
import json
import math
import random
import argparse
import threading
import requests
from queue import Queue, Empty
from datetime import datetime
from urllib.parse import urljoin, urlparse, quote
from difflib import SequenceMatcher
from collections import defaultdict

# Optional color support (non-fatal)
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except Exception:
    class _C:
        def __getattr__(self, k): return ""
    Fore = Style = _C()

# -------------------------
# Configuration (tunable)
# -------------------------
OUTPUT_BASE = os.path.join("reports", "bypass_enterprise")
TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
JSON_DIR = os.path.join(OUTPUT_BASE, "json")
CSV_DIR = os.path.join(OUTPUT_BASE, "csv")
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)
os.makedirs(CSV_DIR, exist_ok=True)

REQUEST_TIMEOUT = 8
THREADS_DEFAULT = 25
PAUSE_MIN = 0.03
PAUSE_MAX = 0.18
SAFE_METHODS = ["HEAD", "GET", "OPTIONS"]
AGGRESSIVE_METHODS = ["PUT", "POST", "DELETE"]  # used only when aggressive flag is set

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    "curl/7.88.1", "python-requests/2.x"
]

# Common header tricks to attempt (value None means auto-fill)
HEADER_TRICKS = [
    {"X-Original-URL": None},
    {"X-Rewrite-URL": None},
    {"X-Custom-IP-Authorization": "127.0.0.1"},
    {"X-Forwarded-For": "127.0.0.1"},
    {"Referer": None},
    {"X-Forwarded-Host": None},
    {"X-Http-Method-Override": "GET"},
]

# Permutation patterns to try for target paths
BYPASS_VARIANTS = [
    "{p}",
    "{p}.", "{p}%20", "{p}%09", "{p}//", "{p}/.", "{p}/%2e", "{p}%2e", "{p}%00",
    "%2e{p}", "%2f{p}", "/%2e/{p}", "/%2f/{p}",
    "{p}//..;/", "{p}/..%2f", "{p}/..\\", "{p}%2f.", "{p}/./",
    "{p}?", "{p}?test=1", "{p}#", "{p}%23", "{p}?a=/..",
    "{p}/%2e", "{p}/%2e/", "{p}%2e%2e", "{p}/.%2e/",
    "../{p}", "..%2f{p}", "%2e/{p}", "%2e%2e/{p}"
]

# Encodings (functions) to transform path segments
ENCODINGS = [
    lambda p: p,
    lambda p: quote(p, safe="/"),
    lambda p: p + "%00",
    lambda p: p + "%20",
    lambda p: p.replace("/", "/%2e/"),
    lambda p: p + "/%2e",
    lambda p: p.replace(".", "%2e"),
]

# Baseline markers for homepage/default detection
HOMEPAGE_MARKERS = [
    "<html", "<body", "index of", "not found", "page not found",
    "welcome to", "nginx", "apache", "iis", "error", "404", "homepage"
]

# -------------------------
# Utility helpers
# -------------------------
def now_ts(fmt="%Y-%m-%d_%H-%M-%S"):
    return datetime.utcnow().strftime(fmt)

def rand_headers(extra=None):
    h = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9"
    }
    if extra and isinstance(extra, dict):
        for k, v in extra.items():
            if v is None:
                # intelligent defaults
                if k.lower() == "referer":
                    h[k] = "https://example.com/"
                elif k.lower() == "user-agent":
                    h[k] = random.choice(USER_AGENTS)
                else:
                    h[k] = "127.0.0.1"
            else:
                h[k] = v
    return h

def similarity(a, b):
    try:
        if a is None or b is None:
            return 0.0
        return SequenceMatcher(None, a[:4000], b[:4000]).ratio()
    except Exception:
        return 0.0

def sanitize(obj):
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(i) for i in obj]
    if isinstance(obj, set):
        return [sanitize(i) for i in sorted(list(obj))]
    if isinstance(obj, (bytes, bytearray)):
        try:
            return obj.decode("utf-8", errors="ignore")
        except:
            return str(obj)
    if hasattr(obj, "isoformat"):
        try:
            return obj.isoformat()
        except:
            return str(obj)
    return obj

def looks_like_homepage(text, threshold=2):
    if not text:
        return True
    t = text.lower()
    score = sum(1 for m in HOMEPAGE_MARKERS if m in t)
    return score >= threshold

# Small safe wrapper for requests with exceptions handled
def safe_request(method, url, headers=None, timeout=REQUEST_TIMEOUT, allow_redirects=True):
    try:
        func = getattr(requests, method.lower())
        r = func(url, headers=headers or rand_headers(), timeout=timeout, allow_redirects=allow_redirects, verify=True)
        return {
            "status": r.status_code,
            "length": len(r.content or b""),
            "text": (r.text or ""),
            "headers": dict(r.headers or {})
        }
    except Exception as e:
        return None

# Heuristic to judge whether asset string looks public
def is_public_asset(asset):
    a = (asset or "").lower()
    if a.startswith("http"):
        if "localhost" in a or "127.0.0.1" in a:
            return False
        return True
    ipm = re.match(r"(\d+)\.(\d+)\.(\d+)\.(\d+)", a)
    if ipm:
        first = int(ipm.group(1))
        if first == 10 or first == 127 or (first == 172) or first == 192:
            return False
        return True
    return False

# End of Part 1
# bypass_tester_pro_enterprise.py  (Part 2/3)
# Core BypassTester class (calibration, path generation, probes, evaluation)

class BypassTester:
    def __init__(self, base, threads=THREADS_DEFAULT, aggressive=False, proxies=None, pace=(PAUSE_MIN, PAUSE_MAX)):
        self.base = base.rstrip("/")
        self.threads = max(2, int(threads))
        self.aggressive = aggressive
        self.pace = pace
        self.proxies = proxies or []
        self.session = requests.Session()
        self.queue = Queue()
        self.lock = threading.Lock()
        self.findings = []
        self.visited = set()
        # baseline parameters
        self.baseline_status = None
        self.baseline_text = None
        self.baseline_length = 0

    # -------------------------
    # Baseline calibration
    # -------------------------
    def calibrate_baseline(self):
        rnd = f"this-path-should-not-exist-{random.randint(100000,999999)}.txt"
        url = urljoin(self.base + "/", rnd)
        print(Fore.CYAN + f"[CALIBRATE] requesting baseline: {url}")
        res = safe_request("get", url)
        if res:
            self.baseline_status = res.get("status")
            self.baseline_text = res.get("text") or ""
            self.baseline_length = res.get("length") or 0
            print(Fore.CYAN + f"[CALIBRATE] baseline status={self.baseline_status} len={self.baseline_length}")
        else:
            # fallback defaults
            self.baseline_status = 404
            self.baseline_text = ""
            self.baseline_length = 0
            print(Fore.YELLOW + "[CALIBRATE] baseline failed; using defaults")

    # -------------------------
    # Test path generation
    # -------------------------
    def build_test_paths(self, targets, extra_wordlist=None):
        tests = []
        for p in targets:
            p = p.lstrip("/")
            for v in BYPASS_VARIANTS:
                try:
                    candidate = v.format(p=p)
                except Exception:
                    candidate = v.replace("{p}", p)
                tests.append(candidate)
            for enc in ENCODINGS:
                try:
                    tests.append(enc(p))
                except Exception:
                    pass
        # optional extra list
        if extra_wordlist and os.path.isfile(extra_wordlist):
            try:
                with open(extra_wordlist, "r", encoding="utf-8") as ef:
                    for l in ef:
                        l = l.strip()
                        if l and l not in tests:
                            tests.append(l)
            except Exception:
                pass
        # dedupe preserve order
        out = []
        seen = set()
        for t in tests:
            if t not in seen:
                seen.add(t)
                out.append(t)
        return out

    # -------------------------
    # Single probe (HEAD/GET/OPTIONS)
    # -------------------------
    def probe_once(self, full_url, method="HEAD", headers=None):
        # use safe_request wrapper
        if method not in ("HEAD","GET","OPTIONS"):
            return None
        res = safe_request(method, full_url, headers=headers)
        return res

    # -------------------------
    # Core evaluation: decide if response is an actual bypass
    # -------------------------
    def evaluate_response(self, target_path, candidate, method, headers, resp):
        if resp is None:
            return None
        status = resp.get("status")
        length = resp.get("length") or 0
        text = resp.get("text") or ""
        hdrs = resp.get("headers") or {}

        interesting = False
        reasons = []

        # immediate positive: 200 OK with substantive body differing from baseline
        if status == 200:
            reasons.append("status=200")
            interesting = True

        # status difference vs baseline
        if self.baseline_status is not None and status != self.baseline_status:
            reasons.append(f"status_diff({self.baseline_status}->{status})")
            # if baseline was 403 and we get 200 -> strong indicator
            if self.baseline_status == 403 and status == 200:
                interesting = True

        # textual analysis
        if text:
            sim = similarity(text, self.baseline_text or "")
            if sim < 0.70 and status in (200,301,302):
                reasons.append(f"low_sim({sim:.2f})")
                interesting = True
            # length delta check
            if self.baseline_length and length > max(200, self.baseline_length * 1.5):
                reasons.append(f"len_up({length})")
                interesting = True

        # header hints (content-type textual)
        ctype = hdrs.get("Content-Type","").lower()
        if ctype and ("text" in ctype or "json" in ctype) and length > 20:
            reasons.append(f"ctype:{ctype}")
            interesting = True

        # homepage filtering: avoid default pages or generic error pages
        if text and looks_like_homepage(text):
            # treat homepage-like responses as not interesting
            return None

        # if we decided it's interesting, prepare finding
        if interesting:
            find = {
                "target": target_path,
                "candidate": candidate,
                "url": urljoin(self.base + "/", candidate),
                "method": method,
                "headers_tried": headers,
                "status": status,
                "length": length,
                "reasons": reasons,
                "sample_text": text[:200]
            }
            return find
        return None

    # -------------------------
    # Worker function
    # -------------------------
    def worker(self):
        methods = SAFE_METHODS + (AGGRESSIVE_METHODS if self.aggressive else [])
        header_sets = [None] + HEADER_TRICKS
        while True:
            try:
                item = self.queue.get(timeout=1)
            except Empty:
                return
            path = item
            if path in self.visited:
                self.queue.task_done(); continue
            self.visited.add(path)
            candidate = path
            for method in methods:
                for h in header_sets:
                    headers = rand_headers(extra=h)
                    full_url = urljoin(self.base + "/", candidate)
                    # Prefer HEAD (fast) and if HEAD looks suspicious then GET verify
                    resp_head = self.probe_once(full_url, method="HEAD", headers=headers)
                    # If HEAD is None (error), try GET depending on method
                    if resp_head is None:
                        resp = self.probe_once(full_url, method="GET", headers=headers)
                    else:
                        # If HEAD returns 200, always verify with GET to avoid HEAD-only false positives
                        if resp_head.get("status") == 200:
                            resp_get = self.probe_once(full_url, method="GET", headers=headers)
                            resp = resp_get if resp_get is not None else resp_head
                        else:
                            resp = resp_head
                    result = self.evaluate_response(path, candidate, method, headers, resp)
                    if result:
                        with self.lock:
                            self.findings.append(result)
                            print(Fore.RED + f"[BYPASS?] {result['status']} {result['url']} | reasons={result['reasons']}")
                    time.sleep(random.uniform(self.pace[0], self.pace[1]))
            self.queue.task_done()

    # -------------------------
    # Runner: enqueue and start threads
    # -------------------------
    def run(self, targets, extra_wordlist=None, proxies_file=None):
        # load proxies if provided (not used in current code, but reserved)
        if proxies_file and os.path.isfile(proxies_file):
            try:
                with open(proxies_file, "r", encoding="utf-8") as pf:
                    for l in pf:
                        l = l.strip()
                        if l:
                            self.proxies.append(l)
            except Exception:
                pass

        # calibrate baseline
        self.calibrate_baseline()

        # build candidate paths
        candidates = self.build_test_paths(targets, extra_wordlist)
        print(Fore.CYAN + f"[i] Generated {len(candidates)} candidate paths. Starting {self.threads} workers.")
        for c in candidates:
            self.queue.put(c)

        workers = []
        for _ in range(self.threads):
            t = threading.Thread(target=self.worker, daemon=True)
            t.start()
            workers.append(t)

        try:
            while any(t.is_alive() for t in workers):
                time.sleep(0.6)
                if self.queue.empty():
                    time.sleep(1)
                    break
        except KeyboardInterrupt:
            print(Fore.YELLOW + "[!] Interrupted by user. Attempting graceful shutdown...")

        # join threads
        for t in workers:
            t.join(timeout=0.1)

        return self.findings

# End of Part 2
# bypass_tester_pro_enterprise.py  (Part 3/3)
# Reporting, CLI, and entrypoint

def write_reports(client, base, findings):
    ts = now_ts()
    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', client)[:30]
    host = urlparse(base).hostname or "target"
    basefn = f"{safe}_bypass_{host}_{ts}"
    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")

    # TXT
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== 403 BYPASS & ACCESS CONTROL TEST REPORT ===\n\n")
        tf.write(f"Client: {client}\nTarget: {base}\nGenerated: {datetime.utcnow()}\n\n")
        tf.write(f"Findings: {len(findings)}\n\n")
        for f in findings:
            tf.write(f"- URL: {f.get('url')}\n")
            tf.write(f"  Method: {f.get('method')} | Status: {f.get('status')} | Reasons: {', '.join(f.get('reasons') or [])}\n")
            s = f.get('sample_text') or ""
            if s:
                tf.write(f"  Sample: {s.replace('\\n',' ')[:700]}\n")
            tf.write("\n")

    # JSON
    out = {
        "client": client,
        "target": base,
        "generated": str(datetime.utcnow()),
        "findings": findings
    }
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(sanitize(out), jf, indent=2, ensure_ascii=False)

    # CSV
    try:
        import csv as _csv
        with open(csv_path, "w", newline='', encoding="utf-8") as cf:
            writer = _csv.writer(cf)
            writer.writerow(["url","method","status","reasons","sample"])
            for f in findings:
                writer.writerow([f.get("url"), f.get("method"), f.get("status"), ";".join(f.get("reasons") or []), (f.get("sample_text") or "")[:400]])
    except Exception:
        pass

    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")
    return txt_path, json_path, csv_path

def parse_args():
    p = argparse.ArgumentParser(prog="bypass_tester_pro_enterprise.py", description="403 Bypass & Access Control Tester PRO — Enterprise")
    p.add_argument("--aggressive", action="store_true", help="Enable aggressive methods (PUT/POST/DELETE) - use only with permission")
    p.add_argument("--threads", type=int, default=THREADS_DEFAULT, help="Worker threads")
    p.add_argument("--wordlist", type=str, help="Extra wordlist file (one path per line)")
    p.add_argument("--proxies", type=str, help="Proxies file (one proxy per line)")
    return p.parse_args()

def main():
    args = parse_args()
    print("\n=== 403 BYPASS & ACCESS CONTROL TESTER PRO — ENTERPRISE ===\n")
    client = input("Client name: ").strip() or "client"
    base = input("Enter base URL (https://example.com): ").strip()
    if not base:
        print("Base URL required."); return
    if not base.startswith("http"):
        base = "https://" + base

    thr = input(f"Threads (default {args.threads}): ").strip()
    threads = int(thr) if thr.isdigit() else args.threads
    extra_word = input("Extra wordlist file (optional): ").strip() or args.wordlist or None
    proxies = input("Proxies file (optional): ").strip() or args.proxies or None

    print(Fore.YELLOW + "\n[!] WARNING: Only run this tool on targets you own or have explicit permission to test.")
    ok = input("Type 'YES' to confirm you have permission: ").strip()
    if ok != "YES":
        print("Permission not confirmed. Exiting.")
        return

    tester = BypassTester(base, threads=threads, aggressive=args.aggressive, proxies=None)
    # default target list (sensitive paths)
    base_targets = [
        ".git/HEAD", ".git/config", ".env", "backup.zip", "backup.tar.gz", ".svn/entries", ".htpasswd",
        "config.php", "wp-config.php", "phpinfo.php", "debug.log", "dump.sql", "db.sql", "admin/.git", ".git/objects/info/packs"
    ]
    # run
    findings = tester.run(base_targets, extra_wordlist=extra_word, proxies_file=proxies)
    if findings:
        print(Fore.CYAN + f"[i] {len(findings)} potentially interesting responses detected. Generating reports...")
        write_reports(client, base, findings)
    else:
        print(Fore.GREEN + "[i] No bypasses or unusual responses detected.")
    print("\nDone.\n")

if __name__ == "__main__":
    main()
