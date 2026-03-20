#!/usr/bin/env python3
"""
DFE-ENTERPRISE — Directory & File Enumerator (Enterprise Edition)

Features:
 - Recursive scanning (configurable depth)
 - Extensions bruteforce
 - HTML/JS parsing for discovery (auto-augment wordlist)
 - 404 calibration & false-200 detection
 - Random UA/header rotation + pacing (WAF-aware)
 - Optional proxies file support
 - Resume ability (state file)
 - TXT / JSON / CSV outputs, sorted by risk
 - Threaded workers with progress counts
 - Risk scoring and remediation hints

Usage: interactive. Use only on targets you own or are authorized to test.
"""

import requests, os, re, json, csv, random, time, threading
from queue import Queue, Empty
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from datetime import datetime
from collections import defaultdict
from colorama import init as colorama_init, Fore, Style
from difflib import SequenceMatcher

# Optional: tqdm for progress bar (if installed)
try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except Exception:
    TQDM_AVAILABLE = False

colorama_init(autoreset=True)

# -------------------------
# Configurable defaults
# -------------------------
OUTPUT_BASE = "reports/directory_scan_enterprise"
TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
JSON_DIR = os.path.join(OUTPUT_BASE, "json")
CSV_DIR = os.path.join(OUTPUT_BASE, "csv")
STATE_DIR = os.path.join(OUTPUT_BASE, "state")
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)
os.makedirs(CSV_DIR, exist_ok=True)
os.makedirs(STATE_DIR, exist_ok=True)

DEFAULT_WORDS = [
    "admin","administrator","login","dashboard","cpanel","config",".env",".htaccess","backup","backup.zip",
    "backup.tar.gz","db","database","old","dev","staging","test","private","portal","api","v1","v2","uploads",
    "wp-admin","wp-login.php","xmlrpc.php","phpinfo.php",".git",".git/config",".svn",".env.example",".env.bak",
    "config.php","wp-config.php",".env.php",".DS_Store","robots.txt","sitemap.xml",".DS_Store","server-status",
    "debug","logs","error","errors","private",".aws",".credentials",".backup","backup.sql"
]

EXTENSIONS = [
    "", ".php", ".html", ".htm", ".bak", ".old", ".orig", ".zip", ".tar.gz", ".tar", ".gz", ".sql", ".json", ".xml", ".txt"
]

BACKUP_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".bak", ".old", ".backup", ".sql"]

# Keywords mapping to risk increase and remediation note
RISK_KEYWORDS = {
    ".env": (95, "Contains environment variables — likely leaking secrets. Remove or restrict access."),
    "config": (80, "Config file exposure — may contain DB credentials."),
    "backup": (70, "Backup file found — likely contains sensitive data."),
    "admin": (50, "Admin panel exposed — consider LDAP/2FA, IP allowlist."),
    "login": (40, "Login page — monitor for brute-force."),
    "wp-": (45, "WordPress endpoint — check plugins & versions."),
    "phpinfo": (85, "phpinfo exposure — reveals server config; remove."),
    ".git": (90, "Git repo exposure — may leak source code. Restrict access.")
}

# UA rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    "curl/7.88.1", "Wget/1.21.3", "python-requests/2.x", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
]

COMMON_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Threading defaults
DEFAULT_THREADS = 40
REQUEST_TIMEOUT = 6
DEFAULT_MAX_DEPTH = 2
SLEEP_MIN = 0.01
SLEEP_MAX = 0.15

# similarity threshold to detect false-200 pages (higher => stricter)
SIMILARITY_THRESHOLD = 0.90

# -------------------------
# Utility functions
# -------------------------
def now_str():
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

def sanitize_base(base):
    if not base.startswith("http://") and not base.startswith("https://"):
        base = "https://" + base
    return base.rstrip("/")

def rand_headers():
    h = COMMON_HEADERS.copy()
    h["User-Agent"] = random.choice(USER_AGENTS)
    # add an accept header occasionally
    if random.random() < 0.2:
        h["Referer"] = "https://www.google.com/"
    return h

def content_similarity(a, b):
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a[:5000], b[:5000]).ratio()

def save_state(statefile, state):
    with open(statefile, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)

def load_state(statefile):
    if os.path.exists(statefile):
        with open(statefile, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except:
                return None
    return None

# -------------------------
# Scanner core
# -------------------------
class DFEScanner:
    def __init__(self, base, client, threads=DEFAULT_THREADS, max_depth=DEFAULT_MAX_DEPTH, proxies=None, pace=(SLEEP_MIN,SLEEP_MAX), resume=False, statefile=None):
        self.base = sanitize_base(base)
        self.client = client
        self.threads = threads
        self.max_depth = max_depth
        self.session = requests.Session()
        self.queue = Queue()
        self.visited = set()
        self.discovered = []
        self.lock = threading.Lock()
        self.proxies = proxies or []
        self.pace = pace
        self.resume = resume
        self.statefile = statefile or os.path.join(STATE_DIR, f"{client}_{urlparse(base).hostname}_{now_str()}.state.json")
        self.total_jobs = 0
        self._stop = False

        # baseline (404) page signature for false-200 detection
        self.baseline_content = None
        self.baseline_length = None

    # -------------------------
    # Wordlist & augmentation
    # -------------------------
    def build_initial_words(self, custom_file=None):
        words = list(DEFAULT_WORDS)
        if custom_file and os.path.isfile(custom_file):
            with open(custom_file, "r", encoding="utf-8") as f:
                for w in f:
                    w = w.strip()
                    if w and w not in words:
                        words.append(w)
        return words

    def augment_from_html(self, content):
        """Parse HTML/JS and extract candidate paths."""
        try:
            soup = BeautifulSoup(content, "html.parser")
            candidates = set()
            # find links
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if href.startswith("/") and len(href) > 1:
                    candidates.add(href.lstrip("/").split("?")[0].rstrip("/"))
            # scripts, css
            for tag in soup.find_all(["script","link"]):
                attr = tag.get("src") or tag.get("href")
                if attr and attr.startswith("/"):
                    candidates.add(attr.lstrip("/").split("?")[0].rstrip("/"))
            # look for JS endpoints in inline scripts
            for script in soup.find_all("script"):
                if script.string:
                    found = re.findall(r'["\']\/([a-zA-Z0-9_\-\/\.]+)["\']', script.string)
                    for f in found:
                        if "/" in f:
                            candidates.add(f.split("?")[0].rstrip("/"))
                        else:
                            candidates.add(f)
            return list(candidates)
        except Exception:
            return []

    # -------------------------
    # Baseline 404 calibration
    # -------------------------
    def calibrate_404(self):
        """Hit a random unlikely path to get baseline content/length."""
        rnd = f"this-should-not-exist-{random.randint(100000,999999)}.txt"
        url = urljoin(self.base + "/", rnd)
        try:
            r = self.session.get(url, headers=rand_headers(), timeout=REQUEST_TIMEOUT, allow_redirects=True, verify=True)
            self.baseline_content = (r.text or "")[:5000]
            self.baseline_length = len(r.content or b"")
            # print small debug
            print(Fore.CYAN + f"[CALIBRATE] Baseline length={self.baseline_length}")
        except Exception as e:
            self.baseline_content = ""
            self.baseline_length = 0
            print(Fore.YELLOW + f"[CALIBRATE] baseline failed: {e}")

    def is_false_positive(self, resp_text, resp_length):
        """Decide if a 200 is a false-200 by similarity to baseline content/length."""
        if self.baseline_content is None:
            return False
        # length heuristic: if lengths equal or very close and similarity high -> false positive
        try:
            if self.baseline_length and resp_length:
                ratio_len = min(resp_length, self.baseline_length) / max(resp_length, self.baseline_length)
            else:
                ratio_len = 0.0
        except:
            ratio_len = 0.0
        sim = content_similarity(self.baseline_content, resp_text or "")
        # if similarity > threshold and length ratio close -> false positive
        if sim >= SIMILARITY_THRESHOLD and ratio_len >= 0.9:
            return True
        return False

    # -------------------------
    # Risk scoring
    # -------------------------
    def compute_risk(self, path, status, size, depth):
        score = 0
        notes = []
        # status
        if status == 200:
            score += 10
        if status in (301,302):
            score += 6
            notes.append("redirect")
        if status == 403:
            score += 25
            notes.append("forbidden - likely exists but protected")
        if status >= 500:
            score += 8
            notes.append("server error")

        # keyword boosts
        for k, (boost, msg) in RISK_KEYWORDS.items():
            if k in path.lower():
                score += boost
                notes.append(msg)

        # extension boosts
        for ext in BACKUP_EXTENSIONS:
            if path.lower().endswith(ext):
                score += 40
                notes.append("backup file extension")

        # deeper paths slightly more risky
        score += min(depth * 3, 15)

        # clamp
        score = min(score, 100)
        return int(score), list(dict.fromkeys(notes))

    # -------------------------
    # Worker & request logic
    # -------------------------
    def request_url(self, full_url):
        headers = rand_headers()
        # choose proxy if provided
        proxies = None
        if self.proxies:
            p = random.choice(self.proxies)
            proxies = {"http": p, "https": p}
        try:
            r = self.session.get(full_url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True, verify=True, proxies=proxies)
            return r
        except Exception as e:
            return None

    def worker(self):
        while not self._stop:
            try:
                item = self.queue.get(timeout=1)
            except Empty:
                return
            path, depth = item
            if path in self.visited:
                self.queue.task_done()
                continue
            self.visited.add(path)

            # try all extensions permutations
            for ext in EXTENSIONS:
                candidate = f"{path}{ext}" if not path.endswith(ext) else path
                full = urljoin(self.base + "/", candidate)
                r = self.request_url(full)
                # optional pacing
                time.sleep(random.uniform(self.pace[0], self.pace[1]))
                if r is None:
                    continue
                status = r.status_code
                size = len(r.content or b"")
                text = r.text or ""

                # meaningful statuses
                if status in (200, 301, 302, 403, 500):
                    false200 = False
                    if status == 200:
                        false200 = self.is_false_positive(text, size)
                    if false200:
                        # skip false 200
                        pass
                    else:
                        score, notes = self.compute_risk(candidate, status, size, depth)
                        item_obj = {
                            "path": candidate,
                            "url": full,
                            "status": status,
                            "size": size,
                            "depth": depth,
                            "risk_score": score,
                            "notes": notes
                        }
                        with self.lock:
                            self.discovered.append(item_obj)
                            print(Fore.RED + f"[FOUND] {status} | {candidate} | risk={score}")
                        # augmentation: if HTML, extract subpaths and add recursively
                        if "text/html" in r.headers.get("Content-Type","").lower() and depth < self.max_depth:
                            new_paths = self.augment_from_html(text)
                            for np in new_paths:
                                normalized = np.strip().lstrip("/")
                                if normalized and normalized not in self.visited:
                                    self.queue.put((normalized, depth+1))
                # stop early check
            self.queue.task_done()

    # -------------------------
    # Public run
    # -------------------------
    def run(self, initial_words, custom_wordfile=None):
        # 1) calibrate baseline 404
        print(Fore.CYAN + "[*] Calibrating baseline 404 page...")
        self.calibrate_404()

        # 2) augment initial words with HTML of base (try)
        print(Fore.CYAN + "[*] Fetching base URL to extract candidate paths...")
        try:
            rbase = self.request_url(self.base + "/")
            if rbase and rbase.status_code == 200:
                aug = self.augment_from_html(rbase.text)
                for a in aug:
                    if a and a not in initial_words:
                        initial_words.append(a)
                # also add detected root-level directories from links
                print(Fore.CYAN + f"[+] Augmented {len(aug)} words from base HTML")
        except Exception:
            pass

        # 3) allow custom wordlist file
        if custom_wordfile and os.path.isfile(custom_wordfile):
            with open(custom_wordfile, "r", encoding="utf-8") as f:
                for l in f:
                    w = l.strip()
                    if w and w not in initial_words:
                        initial_words.append(w)

        # 4) put initial words in queue
        for w in initial_words:
            w2 = w.strip().lstrip("/")
            if w2:
                self.queue.put((w2, 0))
        self.total_jobs = self.queue.qsize()

        # 5) resume if available
        if self.resume:
            prev = load_state(self.statefile)
            if prev and "visited" in prev:
                self.visited.update(set(prev.get("visited", [])))
                print(Fore.YELLOW + f"[RESUME] Loaded state with {len(prev.get('visited', []))} visited paths")

        # 6) spawn workers
        workers = []
        worker_count = min(self.threads, max(2, self.total_jobs))
        print(Fore.CYAN + f"[*] Starting {worker_count} workers...")
        for _ in range(worker_count):
            t = threading.Thread(target=self.worker, daemon=True)
            workers.append(t)
            t.start()

        # 7) monitor progress
        try:
            if TQDM_AVAILABLE:
                pbar = tqdm(total=self.total_jobs, desc="Jobs")
            last_count = 0
            while any(t.is_alive() for t in workers):
                time.sleep(0.5)
                # update pbar if available
                if TQDM_AVAILABLE:
                    done = self.total_jobs - self.queue.qsize()
                    pbar.n = done
                    pbar.refresh()
                # periodic state save
                if random.random() < 0.05:
                    state = {"visited": list(self.visited)}
                    save_state(self.statefile, state)
            if TQDM_AVAILABLE:
                pbar.close()
        except KeyboardInterrupt:
            print(Fore.YELLOW + "\n[!] Interrupted by user, saving state...")
            state = {"visited": list(self.visited)}
            save_state(self.statefile, state)
            self._stop = True

        # 8) finish
        # sort by risk
        self.discovered.sort(key=lambda x: x["risk_score"], reverse=True)
        return self.discovered

# -------------------------
# Output writers
# -------------------------
def write_outputs(client, base_url, discoveries):
    ts = now_str()
    basefn = f"{client}_dfe_{urlparse(base_url).hostname}_{ts}"
    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")

    # TXT
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=== DFE-ENTERPRISE REPORT ===\n\n")
        f.write(f"Client: {client}\nBase: {base_url}\nGenerated: {datetime.now()}\n\n")
        f.write(f"Discovered endpoints: {len(discoveries)}\n\n")
        for d in discoveries:
            f.write(f"- {d['status']} {d['path']} | risk={d['risk_score']}\n")
            if d.get("notes"):
                for n in d["notes"]:
                    f.write(f"    * {n}\n")
            f.write(f"    URL: {d['url']}\n\n")

    # JSON
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump({"client": client, "base": base_url, "generated": str(datetime.now()), "results": discoveries},
                  jf, indent=2, ensure_ascii=False)

    # CSV
    with open(csv_path, "w", newline='', encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow(["path","url","status","size","depth","risk_score","notes"])
        for d in discoveries:
            writer.writerow([d.get("path"), d.get("url"), d.get("status"), d.get("size"), d.get("depth"), d.get("risk_score"), "; ".join(d.get("notes") or [])])

    print(Fore.GREEN + f"\n[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}\n")

# -------------------------
# Interactive CLI
# -------------------------
def main():
    print("\n=== DFE-ENTERPRISE (Directory & File Enumerator — Enterprise Edition) ===\n")
    client = input("Client name: ").strip() or "unknown_client"
    base = input("Enter base URL (https://example.com): ").strip()
    if not base:
        print("Base URL required.")
        return
    base = sanitize_base(base)

    threads = input(f"Threads (default {DEFAULT_THREADS}): ").strip()
    threads = int(threads) if threads.isdigit() else DEFAULT_THREADS

    depth = input(f"Recursive depth (default {DEFAULT_MAX_DEPTH}): ").strip()
    depth = int(depth) if depth.isdigit() else DEFAULT_MAX_DEPTH

    custom_word = input("Extra wordlist file (optional): ").strip()
    proxies_file = input("Proxies file (optional, one http(s) proxy per line) leave blank: ").strip()
    resume_choice = input("Resume mode? (y/N): ").strip().lower().startswith("y")

    proxies = []
    if proxies_file and os.path.isfile(proxies_file):
        with open(proxies_file, "r", encoding="utf-8") as pf:
            for l in pf:
                l = l.strip()
                if l:
                    proxies.append(l)

    # Build initial wordlist
    scanner = DFEScanner(base, client, threads=threads, max_depth=depth, proxies=proxies, resume=resume_choice)
    words = scanner.build_initial_words(custom_word if custom_word else None)

    print(Fore.CYAN + f"\n[*] Loaded {len(words)} seed words (plus dynamic augmentation)\n")
    print(Fore.CYAN + "[*] Starting enterprise scan. This may take some time depending on depth & wordlist size.\n")

    discoveries = scanner.run(words, custom_wordfile=custom_word if custom_word else None)
    write_outputs(client, base, discoveries)

    print(Style.BRIGHT + "Scan complete. Exported reports ready for clients.\n")

if __name__ == "__main__":
    main()
