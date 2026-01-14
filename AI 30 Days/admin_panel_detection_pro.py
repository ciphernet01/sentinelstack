#!/usr/bin/env python3
"""
Admin Panel Discovery PRO (Tool 12)

- Multi-threaded admin/login/dashboard discovery
- HEAD -> GET verification (small snippet)
- Reports: TXT, JSON, CSV -> reports/admin_panels/
- Integrates cleanly with reports/ for Tool 9 ingestion
- Use ONLY on targets you own or have explicit permission to test
"""

import os, re, time, json, csv, random
from queue import Queue, Empty
from threading import Thread, Lock
from urllib.parse import urljoin, urlparse
from datetime import datetime
import requests

# optional colors
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except Exception:
    class _C: 
        def __getattr__(self, k): return ""
    Fore = Style = _C()

# ---------- CONFIG ----------
REPORT_BASE = "reports/admin_panels"
TXT_DIR = os.path.join(REPORT_BASE, "txt")
JSON_DIR = os.path.join(REPORT_BASE, "json")
CSV_DIR = os.path.join(REPORT_BASE, "csv")
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)
os.makedirs(CSV_DIR, exist_ok=True)

REQUEST_TIMEOUT = 8
DEFAULT_THREADS = 30
PAUSE_MIN = 0.02
PAUSE_MAX = 0.12

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    "curl/7.88.1",
    "python-requests/2.x"
]

# Common admin/login/dashboard paths (starter list)
COMMON_PATHS = [
    "admin/", "admin/login", "admin/login.php", "admin/index.php", "administrator/", "administrator/index.php",
    "wp-admin/", "wp-login.php", "login/", "user/login", "signin", "cpanel/", "dashboard/", "manage/",
    "adminpanel/", "adminpanel/login", "admin-console/", "console/", "admin-console/login", "admin_area/",
    "login.php", "sysadmin/", "administrator/login", "admin2020/", "cms/", "backend/", "modcp/", "admincp/",
    "admin/dashboard", "controlpanel/", "adminpanel.php", "admin/login.aspx", "Account/Login", "auth/login"
]

# Extra permutations: try trailing slashes or index pages
EXTRA_PERMS = ["", "index.php", "index.html", "login.php", "login.html"]

# response markers for login pages -- if page contains any of these, it's likely an auth page
LOGIN_MARKERS = ["password", "username", "login", "sign in", "sign-in", "authenticat", "user", "captcha"]

# scoring weights
SCORES = {
    "public_login": 50,
    "admin_index": 80,
    "exposed_admin": 95,
    "redirect": 40,
    "auth_challenge": 70,
    "default_page": 10
}

# ---------- HELPERS ----------
def now_ts(fmt="%Y-%m-%d_%H-%M-%S"):
    return datetime.utcnow().strftime(fmt)

def rand_headers(extra=None):
    h = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    if extra and isinstance(extra, dict):
        h.update(extra)
    return h

def safe_request(method, url, headers=None, timeout=REQUEST_TIMEOUT):
    try:
        func = getattr(requests, method.lower())
        r = func(url, headers=headers or rand_headers(), timeout=timeout, allow_redirects=True, verify=True)
        return {
            "status": r.status_code,
            "length": len(r.content or b""),
            "text": (r.text or ""),
            "headers": dict(r.headers or {})
        }
    except Exception as e:
        return None

def infer_tags_and_score(path, status, text, headers):
    tags = []
    score = 0
    t = (text or "").lower()
    # Redirects
    if status in (301,302):
        tags.append("redirect")
        score += SCORES.get("redirect", 40)
    # Auth challenge
    if status == 401:
        tags.append("auth_challenge")
        score += SCORES.get("auth_challenge", 70)
    # 200 with login markers -> public login/admin page
    for m in LOGIN_MARKERS:
        if m in t:
            tags.append("login_page")
            score += SCORES.get("public_login", 50)
            # admin-like wording
            if "admin" in path.lower() or "dashboard" in path.lower() or "administrator" in path.lower():
                tags.append("admin_page")
                score += SCORES.get("admin_index", 80)
            break
    # path looks admin and returned 200
    if status == 200 and ("admin" in path.lower() or "manage" in path.lower() or "dashboard" in path.lower()):
        if "admin_page" not in tags:
            tags.append("admin_like")
            score += 40
    # if 200 and large body maybe default page
    if status == 200 and len(t) < 30:
        tags.append("tiny_body")
        score += 5
    # clamp
    score = max(0, min(100, int(score)))
    return list(set(tags)), score

def sanitize(obj):
    if isinstance(obj, dict):
        return {k: sanitize(v) for k,v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(i) for i in obj]
    if isinstance(obj, set):
        return [sanitize(i) for i in sorted(list(obj))]
    if isinstance(obj, (bytes, bytearray)):
        try: return obj.decode(errors="ignore")
        except: return str(obj)
    if hasattr(obj, "isoformat"):
        try: return obj.isoformat()
        except: return str(obj)
    return obj

# ---------- SCANNER ----------
class AdminScanner:
    def __init__(self, base, threads=DEFAULT_THREADS, pace=(PAUSE_MIN, PAUSE_MAX), proxies=None):
        self.base = base.rstrip("/")
        self.threads = max(2, int(threads))
        self.pace = pace
        self.proxies = proxies or []
        self.session = requests.Session()
        self.queue = Queue()
        self.lock = Lock()
        self.results = []
        self.visited = set()

    def build_candidates(self, extra_wordlist=None):
        words = []
        # base common list with perms
        for p in COMMON_PATHS:
            for perm in EXTRA_PERMS:
                candidate = p.rstrip("/") + (("" if perm=="" else "/"+perm) if not p.endswith("/") else perm)
                # normalize slashes
                candidate = candidate.replace("//", "/").lstrip("/")
                words.append(candidate)
        # append extra wordlist
        if extra_wordlist and os.path.isfile(extra_wordlist):
            try:
                with open(extra_wordlist, "r", encoding="utf-8") as wf:
                    for l in wf:
                        l = l.strip()
                        if l:
                            words.append(l.lstrip("/"))
            except Exception:
                pass
        # dedupe preserve order
        final = []
        seen = set()
        for w in words:
            if w not in seen:
                final.append(w); seen.add(w)
        return final

    def worker(self):
        while True:
            try:
                path = self.queue.get(timeout=1)
            except Empty:
                return
            if path in self.visited:
                self.queue.task_done(); continue
            self.visited.add(path)
            full = urljoin(self.base + "/", path)
            # HEAD probe first
            res_head = safe_request("head", full)
            res = res_head
            # if HEAD returned 200 or 401 -> verify with GET
            if res_head and res_head.get("status") in (200,401,403,302):
                res_get = safe_request("get", full)
                if res_get:
                    res = res_get
            if res:
                tags, score = infer_tags_and_score(path, res.get("status"), res.get("text"), res.get("headers"))
                # only add findings when interesting:
                # status 200 with login markers, 401, 302, or path contains admin keywords and some response
                interesting = False
                st = res.get("status")
                if st in (200,301,302,401):
                    # check textual markers
                    text = (res.get("text") or "").lower()
                    if any(m in text for m in LOGIN_MARKERS) or "admin" in path.lower() or st==401:
                        interesting = True
                if interesting:
                    finding = {
                        "path": path,
                        "url": full,
                        "status": res.get("status"),
                        "content_length": res.get("length"),
                        "content_type": res.get("headers",{}).get("Content-Type"),
                        "tags": tags,
                        "score": score,
                        "snippet": (res.get("text") or "")[:800],
                        "scanned_at": now_ts()
                    }
                    with self.lock:
                        self.results.append(finding)
                        col = Fore.RED if score>=80 else (Fore.YELLOW if score>=50 else Fore.CYAN)
                        print(col + f"[FOUND] {score} | {full} | status={finding['status']} tags={','.join(tags)}")
            time.sleep(random.uniform(self.pace[0], self.pace[1]))
            self.queue.task_done()

    def run(self, extra_wordlist=None):
        candidates = self.build_candidates(extra_wordlist)
        print(f"[i] Probing {len(candidates)} candidate paths with {self.threads} threads.")
        for c in candidates:
            self.queue.put(c)
        workers = []
        for _ in range(self.threads):
            t = Thread(target=self.worker, daemon=True)
            t.start()
            workers.append(t)
        try:
            while any(t.is_alive() for t in workers):
                time.sleep(0.6)
                if self.queue.empty():
                    time.sleep(0.6)
                    break
        except KeyboardInterrupt:
            print(Fore.YELLOW + "[!] Interrupted by user; finishing tasks...")
        for t in workers:
            t.join(timeout=0.1)
        return self.results

# ---------- REPORTING ----------
def write_reports(client, base, findings):
    ts = now_ts()
    safe_client = re.sub(r'[^A-Za-z0-9_-]', '_', client)[:30]
    host = urlparse(base).hostname or "target"
    basefn = f"{safe_client}_admin_{host}_{ts}"
    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")

    # TXT
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== ADMIN PANEL DISCOVERY PRO REPORT ===\n\n")
        tf.write(f"Client: {client}\nTarget: {base}\nGenerated: {datetime.utcnow()}\n\n")
        tf.write(f"Total findings: {len(findings)}\n\n")
        for f in sorted(findings, key=lambda x: x.get("score",0), reverse=True):
            tf.write(f"- [{f.get('score',0):>3}] {f.get('url')} | status={f.get('status')} | tags={','.join(f.get('tags') or [])}\n")
            if f.get("snippet"):
                tf.write(f"    Snippet: {f.get('snippet')[:300].replace('\\n',' ')}\n")
            # remediation guidance
            if "admin_page" in (f.get('tags') or []):
                tf.write("    Recommendation: Restrict access to admin pages by IP, implement MFA and strong auth.\n")
            elif "login_page" in (f.get('tags') or []):
                tf.write("    Recommendation: Rate-limit, enable MFA, monitor authentication logs.\n")
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
        with open(csv_path, "w", newline='', encoding="utf-8") as cf:
            writer = csv.writer(cf)
            writer.writerow(["score","url","status","content_type","content_length","tags","snippet"])
            for f in findings:
                writer.writerow([f.get("score"), f.get("url"), f.get("status"), f.get("content_type"), f.get("content_length"), ";".join(f.get("tags") or []), (f.get("snippet") or "")[:300]])
    except Exception:
        pass

    print(Fore.GREEN + f"[✓] TXT -> {txt_path}")
    print(Fore.GREEN + f"[✓] JSON -> {json_path}")
    print(Fore.GREEN + f"[✓] CSV -> {csv_path}")
    return txt_path, json_path, csv_path

# ---------- CLI ----------
def main():
    print("\n=== ADMIN PANEL DISCOVERY PRO ===\n")
    client = input("Client name: ").strip() or "client"
    base = input("Enter base URL (https://example.com): ").strip()
    if not base:
        print("Base URL required."); return
    if not base.startswith("http"):
        base = "https://" + base
    thr = input(f"Threads (default {DEFAULT_THREADS}): ").strip()
    thr = int(thr) if thr.isdigit() else DEFAULT_THREADS
    extra_word = input("Extra wordlist file (optional): ").strip() or None

    print(Fore.YELLOW + "\n[!] WARNING: Only run this tool on targets you own or have explicit permission to test.")
    ok = input("Type 'YES' to confirm you have permission: ").strip()
    if ok != "YES":
        print("Permission not confirmed. Exiting."); return

    scanner = AdminScanner(base, threads=thr)
    findings = scanner.run(extra_wordlist=extra_word)
    if not findings:
        print(Fore.YELLOW + "[i] No admin panels detected (or all probes returned non-interesting responses).")
    else:
        print(Fore.CYAN + f"[i] {len(findings)} findings detected. Generating reports...")
        write_reports(client, base, findings)
    print("\nDone.\n")

if __name__ == "__main__":
    main()
