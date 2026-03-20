#!/usr/bin/env python3
"""
API Endpoint Enumerator PRO
- Crawl website (HTML + linked JS)
- Extract API-like paths
- Probe endpoints (GET / OPTIONS)
- Detect JSON responses, CORS headers, authentication hints
- Risk score + TXT/JSON reports
Use only on targets you own or are authorized to test.
"""
import os
import re
import json
import time
import random
import threading
from queue import Queue, Empty
from urllib.parse import urljoin, urlparse
from datetime import datetime
from collections import defaultdict
import requests
from bs4 import BeautifulSoup

# optional color output
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except Exception:
    class Dummy:
        def __getattr__(self, k): return ""
    Fore = Style = Dummy()

# --------------------
# Config
# --------------------
REPORT_TXT_DIR = "reports/api_enum/txt"
REPORT_JSON_DIR = "reports/api_enum/json"
os.makedirs(REPORT_TXT_DIR, exist_ok=True)
os.makedirs(REPORT_JSON_DIR, exist_ok=True)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
    "python-requests/2.x",
    "curl/7.88.1"
]

HEADERS_BASE = {
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 6
THREADS = 30

# heuristics for API-like paths
API_PATH_PATTERNS = [
    r"/api/[-\w/]*",
    r"/v\d+/[-\w/]*",
    r"/graphql",
    r"/_next/data/[-\w/]*",
    r"/wp-json/[-\w/]*",
    r"/rest/[-\w/]*",
    r"/ajax/[-\w/]*",
    r"/auth/[-\w/]*",
    r"/oauth/[-\w/]*",
    r"/account/[-\w/]*",
    r"/user/[-\w/]*",
    r"/users/[-\w/]*",
    r"/orders/[-\w/]*",
]

EXTRA_EXT_PATTERNS = [r"\.json\b", r"\.php\b", r"\.asp\b"]

# endpoint probe methods (GET and OPTIONS safe)
PROBE_METHODS = ["GET", "OPTIONS"]

# --------------------
# Utilities
# --------------------
def now_str():
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

def rand_headers():
    h = HEADERS_BASE.copy()
    h["User-Agent"] = random.choice(USER_AGENTS)
    return h

def fetch(url, allow_redirects=True):
    try:
        r = requests.get(url, headers=rand_headers(), timeout=REQUEST_TIMEOUT, allow_redirects=allow_redirects, verify=True)
        return r
    except Exception:
        return None

def fetch_text(url):
    r = fetch(url)
    return (r.text if r else ""), (r.headers if r else {}), (r.status_code if r else None)

# --------------------
# Extractors
# --------------------
def extract_links_from_html(base_url, html_text):
    soup = BeautifulSoup(html_text, "html.parser")
    links = set()

    # anchor hrefs
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("http"):
            links.add(href)
        elif href.startswith("/"):
            links.add(urljoin(base_url, href))

    # script src, link href
    for tag in soup.find_all(["script","link"], src=True):
        src = tag.get("src") or tag.get("href")
        if not src:
            continue
        if src.startswith("http"):
            links.add(src)
        elif src.startswith("/"):
            links.add(urljoin(base_url, src))

    # look for inline JS endpoints (simple regex)
    js_hits = re.findall(r'["\'](\/[a-zA-Z0-9_\-\/\.\?=&%]+)["\']', html_text)
    for j in js_hits:
        if j.startswith("/"):
            links.add(urljoin(base_url, j.split("?")[0]))

    return links

def extract_api_candidates_from_text(base_url, text):
    found = set()
    for patt in API_PATH_PATTERNS:
        for m in re.finditer(patt, text, re.I):
            path = m.group(0)
            if path.startswith("/"):
                found.add(urljoin(base_url, path.split("?")[0]))
    for extp in EXTRA_EXT_PATTERNS:
        for m in re.finditer(r'\/[^\s"\']+' + extp, text, re.I):
            found.add(urljoin(base_url, m.group(0).split("?")[0]))
    return found

# --------------------
# Scanner worker
# --------------------
class APIEnumerator:
    def __init__(self, base, threads=THREADS):
        self.base = base.rstrip("/")
        self.host = urlparse(self.base).netloc
        self.threads = threads
        self.to_crawl = Queue()
        self.to_probe = Queue()
        self.crawled = set()
        self.probed = set()
        self.discovery = {}  # url -> info dict
        self.lock = threading.Lock()
        self.stop_flag = False

    def crawl_worker(self):
        while not self.stop_flag:
            try:
                url = self.to_crawl.get(timeout=1)
            except Empty:
                return
            if url in self.crawled:
                self.to_crawl.task_done()
                continue
            self.crawled.add(url)
            txt, headers, status = fetch_text(url)
            if status is None:
                self.to_crawl.task_done()
                continue
            # extract links and JS
            links = extract_links_from_html(self.base, txt)
            for lk in links:
                if urlparse(lk).netloc == self.host and lk not in self.crawled:
                    self.to_crawl.put(lk)
            # extract API candidates from page text
            candidates = extract_api_candidates_from_text(self.base, txt)
            for c in candidates:
                if urlparse(c).netloc == self.host and c not in self.probed:
                    self.to_probe.put(c)
            self.to_crawl.task_done()
            with self.lock:
                print(Fore.CYAN + f"[CRAWL] {url} | status={status}")

    def probe_worker(self):
        while not self.stop_flag:
            try:
                url = self.to_probe.get(timeout=1)
            except Empty:
                return
            if url in self.probed:
                self.to_probe.task_done()
                continue
            self.probed.add(url)
            info = {"url": url, "checked_at": now_str(), "results": []}
            # try safe methods
            for method in PROBE_METHODS:
                try:
                    if method == "OPTIONS":
                        r = requests.options(url, headers=rand_headers(), timeout=REQUEST_TIMEOUT, verify=True)
                    else:
                        r = requests.get(url, headers=rand_headers(), timeout=REQUEST_TIMEOUT, verify=True)
                except Exception:
                    r = None
                if not r:
                    continue
                res = {
                    "method": method,
                    "status": r.status_code,
                    "content_type": r.headers.get("Content-Type"),
                    "length": len(r.content or b""),
                    "cors": {
                        "ACAO": r.headers.get("Access-Control-Allow-Origin"),
                        "ACAC": r.headers.get("Access-Control-Allow-Credentials"),
                        "ACAH": r.headers.get("Access-Control-Allow-Headers"),
                        "ACAM": r.headers.get("Access-Control-Allow-Methods"),
                    },
                    "is_json": False,
                    "auth_required": None,
                }
                # detect JSON
                ct = r.headers.get("Content-Type","")
                if "application/json" in ct.lower() or (r.text and r.text.strip().startswith("{")):
                    res["is_json"] = True
                # detect auth hints
                if r.status_code in (401,403):
                    res["auth_required"] = True
                elif r.status_code == 200 and ("/login" in url.lower() or "auth" in url.lower()):
                    res["auth_required"] = False  # accessible login endpoint
                info["results"].append(res)

            # compute risk
            info["risk_score"], info["risk_reasons"] = self.compute_risk(info)
            with self.lock:
                self.discovery[url] = info
                # terminal output
                score = info["risk_score"]
                level = "LOW"
                if score >= 70: level = "HIGH"
                elif score >= 40: level = "MEDIUM"
                color = Fore.GREEN if level=="LOW" else (Fore.YELLOW if level=="MEDIUM" else Fore.RED)
                print(color + f"[PROBE] {level} {score} | {url}")
            self.to_probe.task_done()

    def compute_risk(self, info):
        score = 0
        reasons = []
        for res in info.get("results", []):
            st = res.get("status") or 0
            if st >= 500:
                score += 8
                reasons.append("server error on probe")
            if st == 200:
                score += 6
            if st == 301 or st == 302:
                score += 3
            if res.get("is_json"):
                score += 10
                reasons.append("JSON response exposed")
            cors = res.get("cors", {})
            if cors.get("ACAO") == "*" or (cors.get("ACAO") and cors.get("ACAO").lower().startswith("http")):
                # wildcard origin or echoing origin is risky
                score += 20
                reasons.append("Permissive CORS (ACAO)")
            if cors.get("ACAC") == "true" and cors.get("ACAO") in ("*", None):
                score += 15
                reasons.append("Credentials allowed with wildcard origin")
            if res.get("auth_required"):
                score += 12
                reasons.append("Auth required (401/403)")
        # endpoint path heuristics
        p = info.get("url","")
        for kw, boost in [("admin", 25), ("login", 15), ("auth", 20), ("/api/", 12), ("graphql", 30), ("/v1/", 8)]:
            if kw in p.lower():
                score += boost
                reasons.append(f"keyword match: {kw}")
        score = min(score, 100)
        reasons = list(dict.fromkeys(reasons))
        return score, reasons

    def run(self):
        # seed with base url
        self.to_crawl.put(self.base + "/")
        # start crawl workers
        crawlers = []
        for _ in range(max(2, int(self.threads/3))):
            t = threading.Thread(target=self.crawl_worker, daemon=True)
            crawlers.append(t); t.start()
        # start probe workers
        probers = []
        for _ in range(self.threads):
            t = threading.Thread(target=self.probe_worker, daemon=True)
            probers.append(t); t.start()

        # wait until crawl queue empties
        try:
            while any(t.is_alive() for t in crawlers + probers):
                time.sleep(0.6)
                # if crawl finished but probes remain, keep waiting
                # break condition: both queues empty
                if self.to_crawl.empty() and self.to_probe.empty():
                    # allow some time for workers to finish
                    time.sleep(1)
                    # stop flag and break
                    self.stop_flag = True
                    break
        except KeyboardInterrupt:
            self.stop_flag = True

        # final join
        return self.discovery

# --------------------
# Reporting
# --------------------
def write_reports(client, base, discovery):
    ts = now_str()
    safe_host = urlparse(base).hostname.replace(":", "_")
    txt_fn = os.path.join(REPORT_TXT_DIR, f"{client}_apienum_{safe_host}_{ts}.txt")
    json_fn = os.path.join(REPORT_JSON_DIR, f"{client}_apienum_{safe_host}_{ts}.json")

    with open(txt_fn, "w", encoding="utf-8") as f:
        f.write("=== API ENUMERATOR PRO REPORT ===\n\n")
        f.write(f"Client: {client}\nBase: {base}\nGenerated: {datetime.now()}\n\n")
        f.write(f"Discovered endpoints: {len(discovery)}\n\n")
        for url, info in sorted(discovery.items(), key=lambda x: x[1]["risk_score"], reverse=True):
            f.write(f"- {info['risk_score']:>3} | {url}\n")
            if info.get("risk_reasons"):
                for r in info["risk_reasons"]:
                    f.write(f"    * {r}\n")
            for res in info.get("results", []):
                f.write(f"      - {res.get('method')} {res.get('status')} | json={res.get('is_json')} | len={res.get('length')}\n")
                f.write(f"        CORS: {res.get('cors')}\n")
            f.write("\n")

    with open(json_fn, "w", encoding="utf-8") as jf:
        json.dump({"client": client, "base": base, "generated": str(datetime.now()), "results": discovery}, jf, indent=2, ensure_ascii=False)

    print(Fore.GREEN + f"\n[✓] TXT → {txt_fn}")
    print(Fore.GREEN + f"[✓] JSON → {json_fn}\n")

# --------------------
# CLI runner
# --------------------
def main():
    print("\n=== API ENDPOINT ENUMERATOR PRO ===\n")
    client = input("Client name: ").strip() or "client"
    base = input("Enter base URL (https://example.com): ").strip()
    if not base:
        print("Base URL required.")
        return
    if not base.startswith("http"):
        base = "https://" + base
    thr = input(f"Threads (default {THREADS}): ").strip()
    thr = int(thr) if thr.isdigit() else THREADS

    print("\nStarting discovery (this may take a minute)...\n")
    e = APIEnumerator(base, threads=thr)
    discovery = e.run()
    write_reports(client, base, discovery)
    print("Scan complete.\n")

if __name__ == "__main__":
    main()
