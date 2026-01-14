#!/usr/bin/env python3
"""
Sensitive File & Backup Detector PRO
- Multi-threaded scanner to find exposed sensitive files, backups, and repo leaks
- Safe: uses HEAD first, GET only when necessary, and retrieves small snippets only
- Produces TXT, JSON, CSV reports in reports/sensitive_files/*
- Use only on targets you own or have permission to test
"""

import os, re, json, csv, time, random
import requests
from queue import Queue, Empty
from threading import Thread, Lock
from urllib.parse import urljoin, urlparse
from datetime import datetime

# optional color output
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except Exception:
    class _Dummy:
        def __getattr__(self, k): return ""
    Fore = Style = _Dummy()

# -----------------------
# Config
# -----------------------
REPORT_BASE = "reports/sensitive_files"
TXT_DIR = os.path.join(REPORT_BASE, "txt")
JSON_DIR = os.path.join(REPORT_BASE, "json")
CSV_DIR = os.path.join(REPORT_BASE, "csv")
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)
os.makedirs(CSV_DIR, exist_ok=True)

REQUEST_TIMEOUT = 6
THREADS_DEFAULT = 30
PAUSE_MIN = 0.02
PAUSE_MAX = 0.12

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    "curl/7.88.1", "python-requests/2.x"
]

# Common sensitive filenames and directory permutations
BASE_WORDS = [
    ".env", ".env.example", ".env.backup", "config.php", "wp-config.php", ".htpasswd",
    "phpinfo.php", ".git/HEAD", ".git/config", ".gitignore", ".svn/entries",
    "backup.zip", "site.zip", "backup.tar.gz", "backup.tar", "db.sql", "dump.sql", "database.sql",
    "backup.bak", "backup.old", "wp-config-sample.php", "config.json", "credentials.json",
    ".DS_Store", "id_rsa", "id_rsa.pub", "private.key", "server-status", "logs/error.log",
    "debug.log", "composer.json", "package.json", "settings.py", "web.config", "local.settings.json"
]

# Extra heuristics for files built from directories
DIR_WORDS = ["backup", "backups", "old", "archive", "db", "database", "dump", "site", "uploads", "export"]

EXTENSIONS = ["", ".zip", ".tar.gz", ".tar", ".bak", ".old", ".sql", ".7z", ".rar", ".gz"]

# Simple tag -> weight mapping for scoring
TAG_WEIGHTS = {
    "env_file": 95,
    "git_exposed": 90,
    "backup_file": 85,
    "db_dump": 90,
    "phpinfo": 85,
    "sensitive_file": 80,
    "log_exposed": 70,
    "misc": 30
}

# mapping keywords to tag
KEYWORD_TAGS = {
    ".env": "env_file",
    "git/": "git_exposed",
    ".git": "git_exposed",
    "backup": "backup_file",
    ".sql": "db_dump",
    "db": "db_dump",
    "phpinfo": "phpinfo",
    "debug.log": "log_exposed",
    "error.log": "log_exposed",
    ".DS_Store": "sensitive_file",
    "credentials": "sensitive_file",
    "id_rsa": "sensitive_file"
}

# -----------------------
# Utilities
# -----------------------
def now_ts():
    return datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")

def rand_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9"
    }

def sanitize(obj):
    """Recursively convert sets/bytes/datetime to JSON-friendly objects"""
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k,v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(i) for i in obj]
    if isinstance(obj, set):
        return [sanitize(i) for i in sorted(list(obj))]
    if isinstance(obj, (bytes, bytearray)):
        try:
            return obj.decode(errors="ignore")
        except:
            return str(obj)
    if hasattr(obj, 'isoformat'):
        try:
            return obj.isoformat()
        except:
            return str(obj)
    return obj

# safe head then conditional get
def probe_url(session, url, allow_get_snippet=True):
    """Probe URL: use HEAD first. If HEAD reports 200 or returns no content-length or HEAD blocked, do GET (small)."""
    try:
        r = session.head(url, headers=rand_headers(), timeout=REQUEST_TIMEOUT, allow_redirects=True, verify=True)
        status = r.status_code
        clen = r.headers.get("Content-Length")
        ctype = r.headers.get("Content-Type", "")
        # if HEAD gives 200 and Content-Length small or ctype indicates text, do GET to sample
        snippet = None
        if status == 200 and allow_get_snippet:
            # only download snippet if content-type is textual or small
            if (not clen) or (ctype and any(t in ctype.lower() for t in ("text","json","xml","application")) ) or (clen and int(clen) < 200000):
                try:
                    r2 = session.get(url, headers=rand_headers(), timeout=REQUEST_TIMEOUT, allow_redirects=True, verify=True, stream=True)
                    status = r2.status_code
                    snippet = r2.content[:1024]  # small sample
                except Exception:
                    pass
        return {
            "url": url,
            "status": status,
            "content_length": int(clen) if clen and clen.isdigit() else None,
            "content_type": ctype,
            "snippet": snippet
        }
    except Exception as e:
        # Try GET if HEAD fails (some servers block HEAD)
        try:
            r = session.get(url, headers=rand_headers(), timeout=REQUEST_TIMEOUT, allow_redirects=True, verify=True, stream=True)
            status = r.status_code
            clen = r.headers.get("Content-Length")
            ctype = r.headers.get("Content-Type", "")
            snippet = r.content[:1024]
            return {
                "url": url,
                "status": status,
                "content_length": int(clen) if clen and clen.isdigit() else None,
                "content_type": ctype,
                "snippet": snippet
            }
        except Exception as e2:
            return None

# tag inference & scoring
def infer_tags_from_path(path):
    tags = set()
    p = (path or "").lower()
    for k,v in KEYWORD_TAGS.items():
        if k in p:
            tags.add(v)
    # generic
    if re.search(r"\.zip$|\.tar|\.sql$|\.bak$|\.7z$|\.rar$", p):
        tags.add("backup_file")
    return list(tags)

def compute_score_for_tags(tags):
    score = 0
    for t in tags:
        score += TAG_WEIGHTS.get(t, 30)
    return min(100, max(0, int(score)))

# -----------------------
# Core scanner
# -----------------------
class SensitiveScanner:
    def __init__(self, base, threads=THREADS_DEFAULT, proxies=None, pace=(PAUSE_MIN, PAUSE_MAX)):
        self.base = base.rstrip("/")
        self.threads = max(2, int(threads))
        self.session = requests.Session()
        self.proxies = proxies or []
        self.pace = pace
        self.queue = Queue()
        self.results = []
        self.lock = Lock()
        self.visited = set()

    def build_candidates(self, extra_wordlist_file=None):
        words = list(BASE_WORDS)
        # add directory permutations + extensions
        for d in DIR_WORDS:
            for ext in EXTENSIONS:
                words.append(f"{d}{ext}")
                words.append(f"{d}/index{ext}")
                words.append(f"{d}/backup{ext}")
        # add permutations of base words with extensions
        perm = []
        for w in BASE_WORDS:
            for ext in EXTENSIONS:
                if w.endswith(ext) or ext == "":
                    perm.append(w)
                else:
                    perm.append(w + ext)
        words = list(dict.fromkeys(words + perm))  # dedupe but preserve order roughly
        # load custom file
        if extra_wordlist_file and os.path.isfile(extra_wordlist_file):
            with open(extra_wordlist_file, "r", encoding="utf-8") as ff:
                for l in ff:
                    l = l.strip()
                    if l and l not in words:
                        words.append(l)
        # prepare final full URLs
        candidates = []
        for w in words:
            # if word looks like a path starting with '/', avoid double slash
            path = w.lstrip("/")
            candidates.append(path)
            # also sometimes try path inside common directories
            candidates.append(os.path.join("backup", path))
            candidates.append(os.path.join("old", path))
            candidates.append(os.path.join("archive", path))
        # dedupe
        final = []
        seen = set()
        for p in candidates:
            if p not in seen:
                final.append(p)
                seen.add(p)
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
            # use proxy randomly if provided
            proxies = None
            if self.proxies:
                p = random.choice(self.proxies)
                proxies = {"http": p, "https": p}
            # probe
            res = probe_url(self.session, full, allow_get_snippet=True)
            if res:
                status = res.get("status")
                if status and status in (200, 301, 302, 403):  # interesting statuses
                    tags = infer_tags_from_path(path)
                    score = compute_score_for_tags(tags)
                    # sanitize snippet small text
                    snippet = None
                    if res.get("snippet"):
                        try:
                            snippet = res["snippet"].decode(errors="ignore")
                            snippet = snippet[:800]
                        except:
                            snippet = str(res["snippet"])[:800]
                    finding = {
                        "path": path,
                        "url": full,
                        "status": status,
                        "content_type": res.get("content_type"),
                        "content_length": res.get("content_length"),
                        "tags": tags,
                        "score": score,
                        "snippet": snippet,
                        "scanned_at": now_ts()
                    }
                    with self.lock:
                        self.results.append(finding)
                        # terminal output
                        level = "INFO"
                        if score >= 80: level = "HIGH"
                        elif score >= 60: level = "MED"
                        print((Fore.RED if score>=80 else (Fore.YELLOW if score>=60 else Fore.CYAN)) + f"[FOUND] {level} {score} | {full} | status={status}")
            time.sleep(random.uniform(self.pace[0], self.pace[1]))
            self.queue.task_done()

    def run(self, extra_wordlist_file=None, proxies_file=None):
        # load proxies optionally
        proxies = []
        if proxies_file and os.path.isfile(proxies_file):
            with open(proxies_file, "r", encoding="utf-8") as pf:
                for l in pf:
                    l = l.strip()
                    if l:
                        proxies.append(l)
            self.proxies = proxies

        candidates = self.build_candidates(extra_wordlist_file)
        print(f"[i] Will probe {len(candidates)} candidate paths — threads={self.threads}")
        for c in candidates:
            self.queue.put(c)

        workers = []
        for _ in range(self.threads):
            t = Thread(target=self.worker, daemon=True)
            t.start()
            workers.append(t)

        # wait until done
        try:
            while any(t.is_alive() for t in workers):
                time.sleep(0.7)
                if self.queue.empty():
                    # give workers time to finish
                    time.sleep(1.0)
                    break
        except KeyboardInterrupt:
            print(Fore.YELLOW + "\n[!] Interrupted by user — finishing current tasks...")

        # join (best-effort)
        for t in workers:
            t.join(timeout=0.1)
        return self.results

# -----------------------
# Reporting
# -----------------------
def write_reports(client, base, findings):
    ts = now_ts()
    safe = re.sub(r'[^a-zA-Z0-9_\-]', '_', client)[:30]
    basefn = f"{safe}_sensitive_{urlparse(base).hostname if urlparse(base).hostname else 'target'}_{ts}"
    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")

    # TXT
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== SENSITIVE FILE & BACKUP DETECTOR PRO REPORT ===\n\n")
        tf.write(f"Client: {client}\nTarget: {base}\nGenerated: {datetime.utcnow()}\n\n")
        tf.write(f"Total findings: {len(findings)}\n\n")
        for f in sorted(findings, key=lambda x: x["score"], reverse=True):
            tf.write(f"- [{f['score']:>3}] {f['url']} | status={f.get('status')} | tags={','.join(f.get('tags') or [])}\n")
            if f.get("snippet"):
                    snippet_clean = f["snippet"][:350].replace("\n", " ")
                    tf.write(f"    Snippet: {snippet_clean}\n")
            # remediation guidance (short)
            if "env_file" in (f.get("tags") or []):
                tf.write("    Recommendation: Remove .env from public root; restrict access and rotate secrets.\n")
            if "git_exposed" in (f.get("tags") or []):
                tf.write("    Recommendation: Close .git exposure; remove .git directory from webroot.\n")
            if "backup_file" in (f.get("tags") or []):
                tf.write("    Recommendation: Remove backups from webroot; move to secure storage.\n")
            tf.write("\n")

    # JSON (sanitize)
    out = {
        "client": client,
        "target": base,
        "generated": str(datetime.utcnow()),
        "findings": findings
    }
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(sanitize(out), jf, indent=2, ensure_ascii=False)

    # CSV
    with open(csv_path, "w", newline='', encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow(["score","url","status","content_type","content_length","tags","snippet"])
        for f in findings:
            writer.writerow([f.get("score"), f.get("url"), f.get("status"), f.get("content_type"), f.get("content_length"), ";".join(f.get("tags") or []), (f.get("snippet") or "")[:300]])

    print(Fore.GREEN + f"\n[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}\n")
    return txt_path, json_path, csv_path

# -----------------------
# CLI
# -----------------------
def main():
    print("\n=== SENSITIVE FILE & BACKUP DETECTOR PRO ===\n")
    client = input("Client name: ").strip() or "client"
    base = input("Enter base URL (https://example.com): ").strip()
    if not base:
        print("Base URL required."); return
    if not base.startswith("http"):
        base = "https://" + base
    threads = input(f"Threads (default {THREADS_DEFAULT}): ").strip()
    threads = int(threads) if threads.isdigit() else THREADS_DEFAULT
    extra_word = input("Extra wordlist file (optional): ").strip()
    proxies = input("Proxies file (optional): ").strip()

    print("\n[*] Building candidate list and starting scan...\n")
    scanner = SensitiveScanner(base, threads=threads)
    findings = scanner.run(extra_wordlist_file=extra_word, proxies_file=proxies)

    if not findings:
        print(Fore.YELLOW + "[i] No sensitive files found (or all probes returned non-interesting statuses).")
    else:
        print(Fore.CYAN + f"[i] {len(findings)} findings detected. Generating reports...")
        write_reports(client, base, findings)

    print("\nDone.\n")

if __name__ == "__main__":
    main()
