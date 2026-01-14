# ==========================================================
# TokenScope Pro — Enterprise Edition
# Tool 17/30
# Complete Implementation
# ==========================================================

import re
import os
import sys
import json
import csv
import time
import base64
import random
import hashlib
import threading
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin, urlparse
from queue import Queue, Empty
import requests

# JWT library - CRITICAL IMPORT
import jwt

# ---------- Color handling ----------
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except Exception:
    class _NoColor:
        def __getattr__(self, _): return ""
    Fore = Style = _NoColor()

# ----------------------------------------------------------
# Output directories
# ----------------------------------------------------------
OUTPUT_BASE = os.path.join("reports", "tokenscope_pro")
TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
JSON_DIR = os.path.join(OUTPUT_BASE, "json")
CSV_DIR = os.path.join(OUTPUT_BASE, "csv")

for d in (TXT_DIR, JSON_DIR, CSV_DIR):
    os.makedirs(d, exist_ok=True)

# ----------------------------------------------------------
# Defaults (enterprise-safe)
# ----------------------------------------------------------
REQUEST_TIMEOUT = 8
THREADS_DEFAULT = 6
DEFAULT_THREADS = 4
MAX_WORKERS = 8
DELAY_BETWEEN_REQUESTS = 0.3

# Token endpoints
TOKEN_ENDPOINTS = [
    "/api/auth/token",
    "/oauth/token",
    "/connect/token",
    "/token",
    "/api/token",
    "/auth/token",
    "/jwt",
    "/api/jwt",
    "/oauth2/token",
    "/api/v1/token"
]

# Protected endpoints for testing
PROTECTED_ENDPOINTS = [
    "/api/user/profile",
    "/api/admin/users",
    "/api/data",
    "/api/settings",
    "/api/account",
    "/dashboard",
    "/admin",
    "/api/v1/me",
    "/api/v1/user",
    "/api/v1/admin"
]

# Weak algorithms
WEAK_JWT_ALGS = {"none", "HS256"}

# Supported token types
SUPPORTED_TOKEN_TYPES = ["JWT", "OPAQUE", "BEARER"]

# ----------------------------------------------------------
# Scoring thresholds
# ----------------------------------------------------------
SCORE_LEVELS = {
    "CRITICAL": (90, 100),
    "HIGH": (70, 89),
    "MEDIUM": (40, 69),
    "LOW": (10, 39),
    "INFO": (0, 9)
}

# ----------------------------------------------------------
# Utilities
# ----------------------------------------------------------
def utc_now():
    return datetime.now(timezone.utc)

def ts_string():
    return utc_now().strftime("%Y-%m-%d_%H-%M-%S")

def now_ts(fmt="%Y-%m-%d_%H-%M-%S"):
    return datetime.utcnow().strftime(fmt)

def sanitize(obj):
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(i) for i in obj]
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, (bytes, bytearray)):
        return obj.decode(errors="ignore")
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return obj

def random_headers(extra=None):
    headers = {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "python-requests/2.x"
        ]),
        "Accept": "*/*",
        "Connection": "close"
    }
    if extra:
        headers.update(extra)
    return headers

def score_to_severity(score: int) -> str:
    for lvl, (lo, hi) in SCORE_LEVELS.items():
        if lo <= score <= hi:
            return lvl
    return "INFO"

def safe_request(session, method, url, headers=None):
    try:
        r = session.request(
            method=method,
            url=url,
            headers=headers or random_headers(),
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False
        )
        return {
            "status": r.status_code,
            "headers": dict(r.headers),
            "time": r.elapsed.total_seconds(),
            "content": r.content
        }
    except Exception:
        return None

# ----------------------------------------------------------
# Canonical Finding Schema (LOCKED)
# ----------------------------------------------------------
def new_finding():
    """
    Single source of truth for TokenScope findings.
    """
    return {
        "url": None,
        "path": None,
        "method": None,
        
        # Token properties
        "token_type": None,
        "token_value": None,
        "token_source": None,
        "algorithm": None,
        "claims": {},
        
        # Security issues
        "missing_claims": [],
        "weak_claims": [],
        "algorithm_issues": [],
        "validation_issues": [],
        
        # Token lifecycle
        "expired": False,
        "validity_seconds": None,
        
        # Abuse indicators
        "replay_possible": False,
        "over_privileged": False,
        "replay_statuses": [],
        
        # Analysis
        "classification": [],
        "score": 0,
        "severity": "INFO",
        
        # Metadata
        "timestamp": utc_now().isoformat()
    }

def normalize_finding(f: dict) -> dict:
    f.setdefault("url", "")
    f.setdefault("path", "")
    f.setdefault("method", "")
    f.setdefault("token_type", "")
    f.setdefault("token_value", None)
    f.setdefault("token_source", None)
    f.setdefault("algorithm", None)
    f.setdefault("claims", {})
    f.setdefault("missing_claims", [])
    f.setdefault("weak_claims", [])
    f.setdefault("algorithm_issues", [])
    f.setdefault("validation_issues", [])
    f.setdefault("expired", False)
    f.setdefault("validity_seconds", None)
    f.setdefault("replay_possible", False)
    f.setdefault("over_privileged", False)
    f.setdefault("replay_statuses", [])
    f.setdefault("classification", [])
    f.setdefault("score", 0)
    f.setdefault("severity", "INFO")
    return f

# ----------------------------------------------------------
# JWT Decoding & Static Analysis
# ----------------------------------------------------------
def _b64url_decode(segment: str) -> bytes:
    """Base64URL decode with padding fix."""
    segment += "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment.encode())

def decode_jwt(token: str):
    """
    Decode JWT header & payload WITHOUT verifying signature.
    Returns (header_dict, payload_dict) or (None, None)
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None, None

        header = json.loads(_b64url_decode(parts[0]))
        payload = json.loads(_b64url_decode(parts[1]))
        return header, payload
    except Exception:
        return None, None

# Claim analysis
REQUIRED_CLAIMS = {"exp", "iat"}
OPTIONAL_BUT_IMPORTANT = {"aud", "iss", "sub", "nbf", "jti"}

PRIVILEGE_KEYWORDS = {
    "admin", "root", "superuser", "sudo",
    "all", "*", "full_access"
}

ROLE_CLAIM_KEYS = {"role", "roles", "scope", "scopes", "permissions", "perm"}

def analyze_claims(payload: dict):
    """
    Inspect JWT claims for risk signals.
    """
    missing = []
    weak = []
    over_privileged = False

    # Missing required claims
    for claim in REQUIRED_CLAIMS:
        if claim not in payload:
            missing.append(claim)

    # Weak / suspicious claims
    for key, value in payload.items():
        # Overlong validity
        if key == "exp" and "iat" in payload:
            try:
                lifetime = int(payload["exp"]) - int(payload["iat"])
                if lifetime > 86400 * 7:  # > 7 days
                    weak.append("long_lived_token")
            except Exception:
                pass

        # Role / scope abuse
        if key.lower() in ROLE_CLAIM_KEYS:
            if isinstance(value, str):
                if value.lower() in PRIVILEGE_KEYWORDS:
                    over_privileged = True
            elif isinstance(value, list):
                for v in value:
                    if str(v).lower() in PRIVILEGE_KEYWORDS:
                        over_privileged = True

    return missing, weak, over_privileged

def analyze_token_static(token: str):
    """
    Perform full static JWT analysis.
    Returns populated finding object.
    """
    finding = new_finding()
    
    # Store token for reference
    finding["token_value"] = token[:50] + "..." if len(token) > 50 else token
    
    header, payload = decode_jwt(token)

    if not header or not payload:
        finding["token_type"] = "OPAQUE"
        finding["classification"].append("opaque_token")
        finding["score"] = 20
        finding["severity"] = score_to_severity(finding["score"])
        return finding

    # JWT detected
    finding["token_type"] = "JWT"
    finding["claims"] = payload

    alg = header.get("alg", "").lower()
    finding["algorithm"] = alg

    # Weak algorithm detection
    if alg in WEAK_JWT_ALGS:
        finding["algorithm_issues"].append(f"weak_jwt_alg_{alg}")
        finding["classification"].append(f"weak_jwt_alg_{alg}")
        finding["score"] = max(finding["score"], 85)

    # Claim analysis
    missing, weak, over_priv = analyze_claims(payload)
    finding["missing_claims"] = missing
    finding["weak_claims"] = weak
    finding["over_privileged"] = over_priv

    if missing:
        finding["validation_issues"].extend([f"missing_{c}" for c in missing])
        finding["classification"].append("missing_required_claims")
        finding["score"] = max(finding["score"], 60)

    if weak:
        finding["validation_issues"].extend(weak)
        finding["classification"].extend(weak)
        finding["score"] = max(finding["score"], 70)

    if over_priv:
        finding["classification"].append("over_privileged_token")
        finding["score"] = max(finding["score"], 80)

    # Expiry check
    now = int(time.time())
    exp = payload.get("exp")

    if isinstance(exp, int):
        if exp < now:
            finding["expired"] = True
            finding["classification"].append("token_expired")
            finding["score"] = max(finding["score"], 50)
        else:
            finding["validity_seconds"] = exp - now

    # Check for missing jti
    if "jti" not in payload:
        finding["classification"].append("missing_jti")
        finding["score"] = max(finding["score"], 40)

    # Final severity
    finding["severity"] = score_to_severity(finding["score"])
    return finding

# ----------------------------------------------------------
# Token Reuse & Replay Analysis
# ----------------------------------------------------------
REPLAY_SENSITIVE_HEADERS = {
    "authorization",
    "x-auth-token",
    "x-access-token"
}

def _extract_auth_header(headers: dict):
    """
    Extract Bearer token from headers safely.
    """
    for k, v in headers.items():
        if k.lower() in REPLAY_SENSITIVE_HEADERS:
            if isinstance(v, str) and "bearer " in v.lower():
                return v.split(" ", 1)[1].strip()
    return None

def safe_token_probe(session, url: str, token: str, method: str = "GET"):
    """
    Send a single authenticated request to observe behavior.
    """
    headers = random_headers({
        "Authorization": f"Bearer {token}"
    })

    try:
        resp = session.request(
            method=method,
            url=url,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False
        )

        return {
            "status": resp.status_code,
            "headers": dict(resp.headers),
            "length": len(resp.content or b""),
            "time": resp.elapsed.total_seconds()
        }
    except Exception:
        return None

def replay_probe(session, url: str, token: str, attempts: int = 2):
    """
    Replay the same token multiple times to detect invalidation.
    """
    results = []

    for i in range(attempts):
        r = safe_token_probe(session, url, token)
        if r:
            results.append(r)
        time.sleep(0.6)

    return results

def analyze_replay_behavior(finding: dict, probe_results: list):
    """
    Compare responses to determine token reuse behavior.
    """
    if len(probe_results) < 2:
        return finding

    statuses = [r["status"] for r in probe_results if "status" in r]
    finding["replay_statuses"] = statuses

    # Token invalidated after first use
    if statuses[0] in (200, 201, 302) and any(s in (401, 403) for s in statuses[1:]):
        finding["classification"].append("single_use_token")
        finding["score"] = min(finding["score"], 40)

    # Token remains valid repeatedly
    elif all(s == statuses[0] for s in statuses):
        finding["classification"].append("token_reusable")
        finding["replay_possible"] = True
        finding["score"] = max(finding["score"], 80)

    finding["severity"] = score_to_severity(finding["score"])
    return finding

def analyze_token_runtime(session, base_url: str, token: str, finding: dict):
    """
    Full runtime-safe token analysis.
    """
    test_url = base_url

    probe_results = replay_probe(
        session=session,
        url=test_url,
        token=token,
        attempts=2
    )

    finding["runtime_probes"] = probe_results
    finding = analyze_replay_behavior(finding, probe_results)
    
    # Assess replay risk
    if "missing_jti" in finding.get("classification", []):
        finding["score"] = max(finding["score"], 60)
    
    finding["severity"] = score_to_severity(finding["score"])
    return finding

# ----------------------------------------------------------
# Main Scanner Class
# ----------------------------------------------------------
class TokenScopePro:
    def __init__(self, base_url, threads=THREADS_DEFAULT):
        self.base = base_url.rstrip("/")
        self.threads = min(threads, MAX_WORKERS)

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "TokenScopePro/Enterprise"
        })

        self.queue = Queue()
        self.findings = []
        self.discovered_tokens = []
        
        # Thread pool
        self.workers = []
        self.results_queue = Queue()

    def build_url(self, path):
        return urljoin(self.base + "/", path.lstrip("/"))

    def _worker(self):
        """Worker thread for scanning endpoints."""
        while True:
            try:
                task = self.queue.get(timeout=2)
                if task is None:
                    break
                
                task_type = task.get("type")
                url = task.get("url")
                
                if task_type == "token_endpoint_scan":
                    result = self._scan_token_endpoint(url)
                elif task_type == "protected_endpoint_test":
                    result = self._test_protected_endpoint(url)
                else:
                    result = None
                
                if result:
                    self.results_queue.put(result)
                
                self.queue.task_done()
                time.sleep(DELAY_BETWEEN_REQUESTS)
                
            except Empty:
                break
            except Exception as e:
                print(Fore.YELLOW + f"[!] Worker error: {e}")
                self.queue.task_done()

    def _scan_token_endpoint(self, url):
        """Scan token endpoint for tokens."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "POST"
        
        # Try to get a token
        test_data = {
            "grant_type": "client_credentials",
            "client_id": "test",
            "client_secret": "test"
        }
        
        resp = safe_request(
            self.session,
            "POST",
            url,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if not resp:
            finding["classification"].append("endpoint_unreachable")
            finding["score"] = 5
            return finding
        
        # Check for tokens in response
        content = resp.get("content", b"")
        if content:
            try:
                body = content.decode('utf-8', errors='ignore')
                # Look for JSON tokens
                if "application/json" in resp.get("headers", {}).get("Content-Type", ""):
                    try:
                        data = json.loads(body)
                        token_keys = ["access_token", "token", "jwt", "accessToken", "id_token"]
                        
                        for key in token_keys:
                            if key in data and data[key]:
                                token = data[key]
                                finding["token_value"] = token[:50] + "..." if len(token) > 50 else token
                                finding["token_source"] = f"JSON body: {key}"
                                finding["token_type"] = "JWT" if self._is_jwt(token) else "BEARER"
                                
                                # Analyze token
                                if self._is_jwt(token):
                                    static_finding = analyze_token_static(token)
                                    finding.update(static_finding)
                                    self.discovered_tokens.append(token)
                                
                                finding["classification"].append("token_found")
                                finding["score"] = 40
                                break
                    except:
                        pass
            except:
                pass
        
        if not finding.get("token_value"):
            finding["classification"].append("no_token_found")
            finding["score"] = 10
        
        finding["severity"] = score_to_severity(finding["score"])
        return finding

    def _test_protected_endpoint(self, url):
        """Test protected endpoint authorization."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "GET"
        
        # Test without token
        resp = safe_request(self.session, "GET", url)
        if resp and resp.get("status") not in [401, 403]:
            finding["classification"].append("unprotected_endpoint")
            finding["score"] = 80
        
        # Test with discovered tokens if any
        if self.discovered_tokens:
            token = self.discovered_tokens[0]
            probe_result = safe_token_probe(self.session, url, token)
            if probe_result and probe_result.get("status") not in [401, 403]:
                finding["classification"].append("token_accepted")
                finding["score"] = max(finding["score"], 60)
        
        if finding["score"] == 0:
            finding["score"] = 20
            finding["classification"].append("properly_protected")
        
        finding["severity"] = score_to_severity(finding["score"])
        return finding

    def _is_jwt(self, token: str) -> bool:
        """Check if string appears to be a JWT."""
        pattern = r'^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$'
        return bool(re.match(pattern, token))

    def run(self, endpoints=None):
        """Execute token security scan."""
        print(Fore.CYAN + f"[i] Starting TokenScope Pro on {self.base}")
        
        # Build endpoint lists
        token_urls = [self.build_url(ep) for ep in (endpoints or TOKEN_ENDPOINTS)]
        protected_urls = [self.build_url(ep) for ep in PROTECTED_ENDPOINTS]
        
        # Start worker threads
        for _ in range(self.threads):
            worker = threading.Thread(target=self._worker)
            worker.daemon = True
            worker.start()
            self.workers.append(worker)
        
        # Queue tasks
        for url in token_urls:
            self.queue.put({
                "type": "token_endpoint_scan",
                "url": url
            })
        
        for url in protected_urls[:5]:  # Limit to 5 protected endpoints
            self.queue.put({
                "type": "protected_endpoint_test",
                "url": url
            })
        
        # Wait for completion
        self.queue.join()
        
        # Stop workers
        for _ in self.workers:
            self.queue.put(None)
        
        for worker in self.workers:
            worker.join(timeout=5)
        
        # Collect results
        all_findings = []
        while not self.results_queue.empty():
            try:
                finding = self.results_queue.get_nowait()
                all_findings.append(finding)
            except Empty:
                break
        
        self.findings = all_findings
        print(Fore.CYAN + f"[i] Scan complete. Found {len(all_findings)} findings.")
        return self.findings

# ----------------------------------------------------------
# Reporting Engine
# ----------------------------------------------------------
def write_reports(client: str, base: str, findings: list):
    ts = now_ts()
    safe_client = re.sub(r"[^A-Za-z0-9_-]", "_", client)[:25]
    host = urlparse(base).hostname or "target"
    basefn = f"{safe_client}_tokenscope_{host}_{ts}"

    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")

    normalized = [normalize_finding(f) for f in findings]

    # TXT REPORT
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== TOKENSCOPE PRO — TOKEN SECURITY REPORT ===\n\n")
        tf.write(f"Client: {client}\n")
        tf.write(f"Target: {base}\n")
        tf.write(f"Generated: {datetime.utcnow()}\n\n")
        tf.write(f"Total Findings: {len(normalized)}\n\n")

        for f in sorted(normalized, key=lambda x: x["score"], reverse=True):
            tf.write("-" * 60 + "\n")
            tf.write(f"Severity: {f['severity']}\n")
            tf.write(f"Score: {f['score']}\n")
            tf.write(f"URL: {f.get('url', '')}\n")
            
            if f.get("token_type"):
                tf.write(f"Token Type: {f['token_type']}\n")
            
            if f.get("algorithm"):
                tf.write(f"Algorithm: {f['algorithm']}\n")
            
            if f["classification"]:
                tf.write(f"Issues: {', '.join(f['classification'])}\n")
            
            claims = f.get("claims", {})
            if claims:
                tf.write("Key Claims:\n")
                for k in ["iss", "aud", "exp", "nbf", "iat", "jti", "scope", "role"]:
                    if k in claims:
                        tf.write(f"  {k}: {claims[k]}\n")
            
            tf.write("\n")

    # JSON REPORT
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(
            sanitize({
                "tool": "TokenScope Pro",
                "client": client,
                "target": base,
                "generated": ts,
                "findings": normalized
            }),
            jf,
            indent=2,
            ensure_ascii=False
        )

    # CSV REPORT
    with open(csv_path, "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow([
            "severity", "score", "url", "token_type", "algorithm",
            "issues", "expired", "replay_possible", "over_privileged"
        ])

        for f in normalized:
            writer.writerow([
                f["severity"],
                f["score"],
                f.get("url", ""),
                f.get("token_type", ""),
                f.get("algorithm", ""),
                ";".join(f.get("classification", [])),
                f.get("expired", False),
                f.get("replay_possible", False),
                f.get("over_privileged", False)
            ])

    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")

    return txt_path, json_path, csv_path

# ----------------------------------------------------------
# CLI Interface
# ----------------------------------------------------------
def main():
    print("\n=== TOKENSCOPE PRO — ENTERPRISE TOKEN SECURITY ANALYZER ===\n")

    # User inputs
    client = input("Client name: ").strip() or "client"
    base = input("Base URL (https://example.com): ").strip()

    if not base.startswith(("http://", "https://")):
        base = "https://" + base

    threads_in = input(f"Threads (default {THREADS_DEFAULT}): ").strip()
    threads = int(threads_in) if threads_in.isdigit() else THREADS_DEFAULT

    print("\n[!] WARNING: Only analyze tokens from systems you own or have permission to test.")
    confirm = input("Type 'YES' to confirm permission: ").strip()
    if confirm != "YES":
        print("Permission not granted. Exiting.")
        return

    # Run scanner
    print(Fore.CYAN + f"\n[i] Initializing scanner...")
    
    scanner = TokenScopePro(
        base_url=base,
        threads=threads
    )
    
    print(Fore.CYAN + f"[i] Scanning {len(TOKEN_ENDPOINTS)} token endpoints...")
    
    raw_findings = scanner.run()
    
    print(Fore.CYAN + f"[i] Generating reports...")
    
    # Generate reports
    write_reports(client, base, raw_findings)
    
    # Summary
    print(Fore.GREEN + "\n" + "="*60)
    print(Fore.GREEN + "[✓] TokenScope Pro Analysis Complete")
    print(Fore.GREEN + "="*60)
    
    # Count findings
    high_risk = sum(1 for f in raw_findings if f.get("score", 0) >= 70)
    medium_risk = sum(1 for f in raw_findings if 40 <= f.get("score", 0) < 70)
    low_risk = sum(1 for f in raw_findings if f.get("score", 0) < 40)
    
    print(Fore.CYAN + f"\nRisk Summary:")
    if high_risk > 0:
        print(Fore.RED + f"  High Risk Findings: {high_risk}")
    if medium_risk > 0:
        print(Fore.YELLOW + f"  Medium Risk Findings: {medium_risk}")
    if low_risk > 0:
        print(Fore.GREEN + f"  Low Risk Findings: {low_risk}")
    
    print(Fore.GREEN + "\n" + "="*60 + Style.RESET_ALL + "\n")

# ----------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(Fore.YELLOW + "\n[!] Analysis interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(Fore.RED + f"\n[!] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)