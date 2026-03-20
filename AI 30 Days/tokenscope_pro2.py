# ==========================================================
# TokenScope Pro — Enterprise Edition
# Tool 21/30
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
import copy
import hashlib
import threading
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin, urlparse, parse_qs
from queue import Queue, Empty
import requests

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
REQUEST_TIMEOUT = 10
THREADS_DEFAULT = 6
DEFAULT_THREADS = 4
MAX_WORKERS = 8
DELAY_BETWEEN_REQUESTS = 0.4

# Token endpoints for discovery
TOKEN_ENDPOINTS = [
    "/api/auth/token",
    "/oauth/token",
    "/connect/token",
    "/token",
    "/api/token",
    "/auth/token",
    "/jwt",
    "/api/jwt",
    "/oauth2/token"
]

# Protected endpoints for testing
PROTECTED_ENDPOINTS = [
    "/api/user/profile",
    "/api/admin/users",
    "/api/data",
    "/api/settings",
    "/api/account"
]

# JWT regex pattern
JWT_REGEX = re.compile(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')

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

# OWASP Mapping
OWASP_MAP = {
    "TOKEN_TRUST_VIOLATION": {
        "owasp_api": "API2:2023 – Broken Authentication",
        "owasp_asvs": "V2.1 / V3.4",
        "impact": "Privilege escalation / account takeover"
    },
    "TOKEN_REPLAY_ALLOWED": {
        "owasp_api": "API3:2023 – Broken Object Property Level Auth",
        "owasp_asvs": "V3.8",
        "impact": "Session hijacking"
    }
}

# ----------------------------------------------------------
# Utilities
# ----------------------------------------------------------
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

def utc_now():
    return datetime.now(timezone.utc)

def random_headers(extra=None):
    headers = {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            "TokenScope-Pro/1.0"
        ]),
        "Accept": "application/json, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "close"
    }
    if extra:
        headers.update(extra)
    return headers

def score_to_severity(score: int) -> str:
    for level, (low, high) in SCORE_LEVELS.items():
        if low <= score <= high:
            return level
    return "INFO"

def safe_request(session, method, url, headers=None, allow_redirects=False):
    """Safe HTTP wrapper for token testing."""
    try:
        r = session.request(
            method=method,
            url=url,
            headers=headers or random_headers(),
            timeout=REQUEST_TIMEOUT,
            allow_redirects=allow_redirects,
            verify=True
        )
        return {
            "status": r.status_code,
            "headers": dict(r.headers),
            "content": r.content,
            "time": r.elapsed.total_seconds()
        }
    except Exception as e:
        return {"error": str(e)}

def b64url_decode(data):
    """Base64 URL decode with padding."""
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

# ----------------------------------------------------------
# Canonical Finding Schema (LOCKED)
# ----------------------------------------------------------
def new_finding():
    """Canonical finding object for token enforcement testing."""
    return {
        "url": None,
        "path": None,
        "method": None,
        
        # Token Information
        "token_found": False,
        "token_type": None,
        "token_claims": {},
        "token_algorithm": None,
        
        # Enforcement Test Results
        "enforcement_tests": [],
        "enforcement_violations": [],
        "replay_detected": False,
        
        # OWASP Mapping
        "owasp_references": [],
        
        # Risk Analysis
        "classification": [],
        "score": 0,
        "severity": "INFO",
        
        # Metadata
        "timestamp": utc_now().isoformat()
    }

def normalize_finding(f: dict) -> dict:
    """Ensure every finding has all required keys."""
    f.setdefault("url", "")
    f.setdefault("path", "")
    f.setdefault("method", "")
    f.setdefault("token_found", False)
    f.setdefault("token_type", None)
    f.setdefault("token_claims", {})
    f.setdefault("token_algorithm", None)
    f.setdefault("enforcement_tests", [])
    f.setdefault("enforcement_violations", [])
    f.setdefault("replay_detected", False)
    f.setdefault("owasp_references", [])
    f.setdefault("classification", [])
    f.setdefault("score", 0)
    f.setdefault("severity", "INFO")
    return f

# ----------------------------------------------------------
# Token Discovery & Decoding
# ----------------------------------------------------------
class TokenFinder:
    """Find tokens in HTTP responses."""
    
    @staticmethod
    def find_tokens(headers=None, cookies=None, url=None, body=None):
        tokens = set()
        
        # Headers
        if headers:
            for v in headers.values():
                if isinstance(v, str):
                    tokens.update(JWT_REGEX.findall(v))
        
        # Body content
        if body:
            if isinstance(body, bytes):
                try:
                    body_str = body.decode('utf-8', errors='ignore')
                    tokens.update(JWT_REGEX.findall(body_str))
                except:
                    pass
            elif isinstance(body, str):
                tokens.update(JWT_REGEX.findall(body))
        
        # URL parameters
        if url:
            parsed = urlparse(url)
            for values in parse_qs(parsed.query).values():
                for v in values:
                    tokens.update(JWT_REGEX.findall(v))
        
        return list(tokens)

class TokenDecoder:
    """Decode JWT tokens without verification."""
    
    @staticmethod
    def decode_jwt(token):
        """Decode JWT header and payload."""
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        try:
            header = json.loads(b64url_decode(parts[0]))
            payload = json.loads(b64url_decode(parts[1]))
        except Exception:
            return None
        
        return {
            "header": header,
            "payload": payload,
            "algorithm": header.get("alg"),
            "key_id": header.get("kid"),
            "type": header.get("typ")
        }
    
    @staticmethod
    def analyze_token(token):
        """Analyze token for security issues."""
        decoded = TokenDecoder.decode_jwt(token)
        if not decoded:
            return None
        
        payload = decoded["payload"]
        issues = []
        
        # Check for missing claims
        standard_claims = ["exp", "iat", "iss", "aud"]
        missing = [c for c in standard_claims if c not in payload]
        if missing:
            issues.append(f"missing_claims_{len(missing)}")
        
        # Check expiry
        now = int(time.time())
        exp = payload.get("exp")
        if exp and exp < now:
            issues.append("token_expired")
        
        # Check weak algorithm
        alg = decoded.get("algorithm", "").lower()
        if alg in ["none", "hs256"]:
            issues.append(f"weak_algorithm_{alg}")
        
        return {
            "decoded": decoded,
            "issues": issues,
            "claims": payload
        }

# ----------------------------------------------------------
# Claim Mutation & Enforcement Testing
# ----------------------------------------------------------
class ClaimMutator:
    """Create mutated token payloads for testing."""
    
    @staticmethod
    def mutate_payload(payload, mutation_type):
        """Create mutated payload for testing."""
        mutated = copy.deepcopy(payload)
        now = int(time.time())
        
        if mutation_type == "expired":
            mutated["exp"] = now - 3600  # 1 hour expired
        
        elif mutation_type == "future_nbf":
            mutated["nbf"] = now + 3600  # Not valid for 1 hour
        
        elif mutation_type == "role_escalation":
            if "role" in mutated:
                mutated["role"] = "admin"
            elif "roles" in mutated:
                mutated["roles"] = ["admin"]
            elif "scope" in mutated:
                mutated["scope"] = "admin write delete"
        
        elif mutation_type == "audience_mismatch":
            mutated["aud"] = "evil-audience"
        
        elif mutation_type == "issuer_mismatch":
            mutated["iss"] = "https://evil-issuer.example.com"
        
        return mutated
    
    @staticmethod
    def create_mutated_token(original_token, mutation_type):
        """Create a mutated token (header.payload.signature structure)."""
        parts = original_token.split(".")
        if len(parts) != 3:
            return None
        
        try:
            header = json.loads(b64url_decode(parts[0]))
            payload = json.loads(b64url_decode(parts[1]))
            signature = parts[2]
            
            # Mutate payload
            mutated_payload = ClaimMutator.mutate_payload(payload, mutation_type)
            
            # Re-encode (note: signature will be invalid, but we're testing server validation)
            new_header = base64.urlsafe_b64encode(
                json.dumps(header).encode()
            ).decode().rstrip("=")
            
            new_payload = base64.urlsafe_b64encode(
                json.dumps(mutated_payload).encode()
            ).decode().rstrip("=")
            
            # Keep original signature (will fail verification but tests claim validation)
            return f"{new_header}.{new_payload}.{signature}"
            
        except Exception:
            return None

class TokenEnforcementTester:
    """Test token enforcement on endpoints."""
    
    def __init__(self, session):
        self.session = session
        self.seen_tokens = set()
    
    def test_enforcement(self, url, original_token, mutated_token, mutation_type):
        """Test if server properly rejects mutated token."""
        results = {
            "test": mutation_type,
            "original_status": None,
            "mutated_status": None,
            "enforced": True,
            "evidence": ""
        }
        
        # Test with original token
        headers = random_headers({
            "Authorization": f"Bearer {original_token}"
        })
        
        resp1 = safe_request(self.session, "GET", url, headers=headers)
        if resp1 and "error" not in resp1:
            results["original_status"] = resp1.get("status", 0)
        
        # Test with mutated token
        headers = random_headers({
            "Authorization": f"Bearer {mutated_token}"
        })
        
        resp2 = safe_request(self.session, "GET", url, headers=headers)
        if resp2 and "error" not in resp2:
            results["mutated_status"] = resp2.get("status", 0)
        
        # Check if mutated token was rejected
        if results["original_status"] in [200, 201, 204] and results["mutated_status"] in [200, 201, 204]:
            results["enforced"] = False
            results["evidence"] = f"Mutated token accepted (HTTP {results['mutated_status']})"
        elif results["mutated_status"] in [401, 403]:
            results["enforced"] = True
            results["evidence"] = f"Mutated token rejected (HTTP {results['mutated_status']})"
        else:
            results["evidence"] = f"Unexpected response (HTTP {results['mutated_status']})"
        
        time.sleep(DELAY_BETWEEN_REQUESTS)
        return results
    
    def test_replay(self, url, token):
        """Test token replay detection."""
        if token in self.seen_tokens:
            return {
                "replay_detected": True,
                "status": None
            }
        
        # First request
        headers = random_headers({
            "Authorization": f"Bearer {token}"
        })
        
        resp1 = safe_request(self.session, "GET", url, headers=headers)
        
        # Second request (replay)
        resp2 = safe_request(self.session, "GET", url, headers=headers)
        
        self.seen_tokens.add(token)
        
        # Check if both requests succeeded (no replay detection)
        if resp1 and resp2 and "error" not in resp1 and "error" not in resp2:
            status1 = resp1.get("status", 0)
            status2 = resp2.get("status", 0)
            
            if status1 in [200, 201, 204] and status2 in [200, 201, 204]:
                return {
                    "replay_detected": True,
                    "status": status2,
                    "evidence": "Token accepted on replay"
                }
        
        return {
            "replay_detected": False,
            "status": resp2.get("status", 0) if resp2 else None
        }

# ----------------------------------------------------------
# Main Scanner Class
# ----------------------------------------------------------
class TokenScopePro:
    """Enterprise Token Enforcement & Security Analyzer."""
    
    def __init__(self, base_url, threads=None):
        self.base = base_url.rstrip("/")
        self.threads = min(threads or DEFAULT_THREADS, MAX_WORKERS)
        
        # Initialize components
        self.token_finder = TokenFinder()
        self.token_decoder = TokenDecoder()
        self.claim_mutator = ClaimMutator()
        
        # Create session
        self.session = requests.Session()
        self.session.headers.update(random_headers())
        
        # Results
        self.findings = []
        self.discovered_tokens = []
        
        # Thread pool
        self.task_queue = Queue()
        self.results_queue = Queue()
        self.workers = []
    
    def build_url(self, path):
        """Build full URL from path."""
        return urljoin(self.base + "/", path.lstrip("/"))
    
    def _worker(self):
        """Worker thread for token testing."""
        while True:
            try:
                task = self.task_queue.get(timeout=2)
                if task is None:
                    break
                
                task_type = task.get("type")
                
                if task_type == "token_discovery":
                    result = self._discover_tokens(task["url"])
                elif task_type == "enforcement_test":
                    result = self._test_enforcement(
                        task["url"],
                        task["token"],
                        task["endpoint"]
                    )
                else:
                    result = None
                
                if result:
                    self.results_queue.put(result)
                
                self.task_queue.task_done()
                time.sleep(DELAY_BETWEEN_REQUESTS)
                
            except Empty:
                break
            except Exception as e:
                print(Fore.YELLOW + f"[!] Worker error: {e}")
                self.task_queue.task_done()
    
    def _discover_tokens(self, url):
        """Discover tokens from endpoint."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "POST"
        
        # Try to get token
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
        
        if not resp or "error" in resp:
            finding["classification"].append("endpoint_unreachable")
            finding["score"] = 5
            return finding
        
        # Look for tokens in response
        tokens = self.token_finder.find_tokens(
            headers=resp.get("headers"),
            body=resp.get("content")
        )
        
        if tokens:
            finding["token_found"] = True
            token = tokens[0]
            
            # Analyze token
            analysis = self.token_decoder.analyze_token(token)
            if analysis:
                finding["token_type"] = "JWT"
                finding["token_algorithm"] = analysis["decoded"].get("algorithm")
                finding["token_claims"] = analysis["claims"]
                finding["classification"].extend(analysis["issues"])
                
                # Store for later testing
                self.discovered_tokens.append({
                    "token": token,
                    "analysis": analysis
                })
                
                finding["score"] = 40
            else:
                finding["token_type"] = "OPAQUE"
                finding["score"] = 30
        else:
            finding["classification"].append("no_token_found")
            finding["score"] = 10
        
        finding["severity"] = score_to_severity(finding["score"])
        return finding
    
    def _test_enforcement(self, token_url, token, test_endpoint):
        """Test token enforcement on protected endpoint."""
        finding = new_finding()
        finding["url"] = token_url
        finding["path"] = urlparse(token_url).path
        finding["method"] = "POST"
        finding["token_found"] = True
        
        # Analyze token
        analysis = self.token_decoder.analyze_token(token)
        if analysis:
            finding["token_type"] = "JWT"
            finding["token_algorithm"] = analysis["decoded"].get("algorithm")
            finding["token_claims"] = analysis["claims"]
            finding["classification"].extend(analysis["issues"])
        
        # Create enforcement tester
        tester = TokenEnforcementTester(self.session)
        
        # Test different mutations
        mutation_tests = [
            "expired",
            "role_escalation",
            "audience_mismatch"
        ]
        
        enforcement_results = []
        violations = []
        
        for mutation in mutation_tests:
            mutated_token = self.claim_mutator.create_mutated_token(token, mutation)
            if mutated_token:
                result = tester.test_enforcement(
                    self.build_url(test_endpoint),
                    token,
                    mutated_token,
                    mutation
                )
                
                enforcement_results.append(result)
                
                if not result["enforced"]:
                    violations.append(mutation)
                    finding["classification"].append(f"enforcement_failure_{mutation}")
        
        finding["enforcement_tests"] = enforcement_results
        finding["enforcement_violations"] = violations
        
        # Test replay
        replay_result = tester.test_replay(self.build_url(test_endpoint), token)
        finding["replay_detected"] = replay_result["replay_detected"]
        if replay_result["replay_detected"]:
            finding["classification"].append("replay_vulnerability")
        
        # Score the finding
        score = self._score_enforcement(finding, len(violations), replay_result["replay_detected"])
        finding["score"] = score
        finding["severity"] = score_to_severity(score)
        
        # Add OWASP references
        if violations or replay_result["replay_detected"]:
            if violations:
                finding["owasp_references"].append(OWASP_MAP["TOKEN_TRUST_VIOLATION"])
            if replay_result["replay_detected"]:
                finding["owasp_references"].append(OWASP_MAP["TOKEN_REPLAY_ALLOWED"])
        
        return finding
    
    def _score_enforcement(self, finding, violation_count, replay_detected):
        """Score enforcement test results."""
        score = 0
        
        # Base score for having a token
        if finding.get("token_found"):
            score = 20
        
        # Add for token issues
        issues = finding.get("classification", [])
        for issue in issues:
            if "weak_algorithm" in issue:
                score += 30
            elif "missing_claims" in issue:
                score += 20
            elif "token_expired" in issue:
                score += 15
        
        # Add for enforcement violations
        score += violation_count * 25
        
        # Add for replay vulnerability
        if replay_detected:
            score += 40
        
        # Cap at 100
        return min(100, score)
    
    def run(self, endpoints=None):
        """Execute token enforcement analysis."""
        print(Fore.CYAN + f"[i] Starting TokenScope Pro on {self.base}")
        print(Fore.CYAN + f"[i] Scope: Token enforcement & claim validation testing")
        
        # Build endpoint lists
        token_urls = [self.build_url(ep) for ep in (endpoints or TOKEN_ENDPOINTS)]
        
        # Start worker threads
        for _ in range(self.threads):
            worker = threading.Thread(target=self._worker)
            worker.daemon = True
            worker.start()
            self.workers.append(worker)
        
        # Queue token discovery tasks
        for url in token_urls:
            self.task_queue.put({
                "type": "token_discovery",
                "url": url
            })
        
        # Wait for discovery to complete
        self.task_queue.join()
        
        # Queue enforcement tests if we found tokens
        if self.discovered_tokens and PROTECTED_ENDPOINTS:
            for token_info in self.discovered_tokens[:2]:  # Test first 2 tokens
                for endpoint in PROTECTED_ENDPOINTS[:3]:  # Test first 3 endpoints
                    self.task_queue.put({
                        "type": "enforcement_test",
                        "url": token_urls[0],  # Use first token URL for reference
                        "token": token_info["token"],
                        "endpoint": endpoint
                    })
        
        # Wait for all tasks
        self.task_queue.join()
        
        # Stop workers
        for _ in self.workers:
            self.task_queue.put(None)
        
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
        
        # Summary
        tokens_found = sum(1 for f in all_findings if f.get("token_found"))
        enforcement_issues = sum(len(f.get("enforcement_violations", [])) for f in all_findings)
        replay_issues = sum(1 for f in all_findings if f.get("replay_detected"))
        
        print(Fore.CYAN + f"[i] Analysis complete.")
        print(Fore.CYAN + f"[i] Tokens discovered: {tokens_found}")
        print(Fore.CYAN + f"[i] Enforcement violations: {enforcement_issues}")
        print(Fore.CYAN + f"[i] Replay vulnerabilities: {replay_issues}")
        
        return self.findings

# ----------------------------------------------------------
# Reporting Engine
# ----------------------------------------------------------
def write_reports(client: str, base: str, findings: list):
    """Generate token enforcement analysis reports."""
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
        tf.write("=== TOKENSCOPE PRO — TOKEN ENFORCEMENT ANALYSIS ===\n\n")
        tf.write(f"Client: {client}\n")
        tf.write(f"Target: {base}\n")
        tf.write(f"Generated: {datetime.utcnow()}\n")
        tf.write(f"Scope: Token enforcement & claim validation testing\n\n")
        tf.write(f"Total Findings: {len(normalized)}\n\n")
        
        # Summary statistics
        tokens_found = sum(1 for f in normalized if f.get("token_found"))
        enforcement_issues = sum(len(f.get("enforcement_violations", [])) for f in normalized)
        replay_issues = sum(1 for f in normalized if f.get("replay_detected"))
        
        tf.write("Analysis Summary:\n")
        tf.write(f"  Tokens Discovered: {tokens_found}\n")
        tf.write(f"  Enforcement Violations: {enforcement_issues}\n")
        tf.write(f"  Replay Vulnerabilities: {replay_issues}\n\n")
        
        # Detailed findings
        tf.write("DETAILED FINDINGS:\n")
        tf.write("=" * 60 + "\n\n")
        
        for f in sorted(normalized, key=lambda x: x["score"], reverse=True):
            if f["score"] < 30:
                continue  # Skip low relevance findings
            
            tf.write(f"URL: {f['url']}\n")
            tf.write(f"Severity: {f['severity']} (Score: {f['score']})\n")
            
            if f.get("token_type"):
                tf.write(f"Token Type: {f['token_type']}\n")
                if f.get("token_algorithm"):
                    tf.write(f"Algorithm: {f['token_algorithm']}\n")
            
            # Token issues
            issues = f.get("classification", [])
            if issues:
                tf.write(f"Token Issues: {', '.join(issues)}\n")
            
            # Enforcement violations
            violations = f.get("enforcement_violations", [])
            if violations:
                tf.write(f"Enforcement Violations: {', '.join(violations)}\n")
            
            # Replay detection
            if f.get("replay_detected"):
                tf.write("✓ Token replay vulnerability detected\n")
            
            # OWASP references
            owasp_refs = f.get("owasp_references", [])
            if owasp_refs:
                tf.write("OWASP References:\n")
                for ref in owasp_refs:
                    tf.write(f"  • {ref['owasp_api']}: {ref['impact']}\n")
            
            # Enforcement test results
            tests = f.get("enforcement_tests", [])
            if tests:
                tf.write("Enforcement Test Results:\n")
                for test in tests[:3]:  # Limit to 3 tests
                    status = "✓ ENFORCED" if test.get("enforced") else "✗ VIOLATION"
                    tf.write(f"  {test['test']}: {status} - {test.get('evidence', '')}\n")
            
            tf.write("\n" + "-" * 40 + "\n\n")
    
    # JSON REPORT
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(
            sanitize({
                "tool": "TokenScope Pro",
                "version": "1.0",
                "client": client,
                "target": base,
                "scan_type": "token_enforcement_analysis",
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
            "enforcement_violations", "replay_detected", "owasp_references"
        ])
        
        for f in normalized:
            if f["score"] < 30:
                continue
            
            violations = f.get("enforcement_violations", [])
            owasp_refs = f.get("owasp_references", [])
            
            writer.writerow([
                f["severity"],
                f["score"],
                f["url"],
                f.get("token_type", ""),
                f.get("token_algorithm", ""),
                ";".join(violations),
                f.get("replay_detected", False),
                ";".join([r["owasp_api"] for r in owasp_refs])
            ])
    
    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")
    
    return txt_path, json_path, csv_path

# ----------------------------------------------------------
# CLI Interface
# ----------------------------------------------------------
def main():
    """Command-line interface for TokenScope Pro."""
    print("\n" + "="*60)
    print("TOKENSCOPE PRO — ENTERPRISE TOKEN ENFORCEMENT ANALYZER")
    print("="*60)
    print("Scope: Token enforcement & claim validation testing")
    print("No credential testing, safe mutation testing only\n")
    
    # User inputs
    client = input("Client/Project name: ").strip() or "client"
    base = input("Base URL (https://example.com): ").strip()
    
    if not base.startswith(("http://", "https://")):
        base = "https://" + base
    
    threads_in = input(f"Threads (1-{MAX_WORKERS}, default {THREADS_DEFAULT}): ").strip()
    try:
        threads = max(1, min(int(threads_in), MAX_WORKERS)) if threads_in.isdigit() else THREADS_DEFAULT
    except:
        threads = THREADS_DEFAULT
    
    print("\n[!] PERMISSION & SCOPE CONFIRMATION")
    print("This tool performs SAFE token enforcement testing:")
    print("  • Discovers tokens from endpoints")
    print("  • Tests claim validation (safe mutations)")
    print("  • Tests replay detection")
    print("  • No credential testing, no destructive actions")
    
    confirm = input("\nType 'TOKEN-TESTING-ONLY' to confirm: ").strip()
    if confirm != "TOKEN-TESTING-ONLY":
        print(Fore.YELLOW + "[!] Permission not confirmed. Exiting.")
        return
    
    # Run scanner
    print(Fore.CYAN + f"\n[i] Initializing token enforcement analyzer...")
    
    scanner = TokenScopePro(
        base_url=base,
        threads=threads
    )
    
    print(Fore.CYAN + f"[i] Testing {len(TOKEN_ENDPOINTS)} token endpoints...")
    print(Fore.CYAN + f"[i] Using {threads} threads with {DELAY_BETWEEN_REQUESTS}s delays")
    
    raw_findings = scanner.run()
    
    print(Fore.CYAN + f"[i] Generating enforcement analysis reports...")
    
    # Generate reports
    write_reports(client, base, raw_findings)
    
    # Summary
    print(Fore.GREEN + "\n" + "="*60)
    print(Fore.GREEN + "[✓] TOKEN ENFORCEMENT ANALYSIS COMPLETE")
    print(Fore.GREEN + "="*60)
    
    # Count by severity
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in raw_findings:
        sev = f.get("severity", "INFO")
        if sev in severity_counts:
            severity_counts[sev] += 1
    
    print(Fore.CYAN + "\nEnforcement Risk Summary:")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        count = severity_counts[sev]
        if count > 0:
            color = Fore.RED if sev in ["CRITICAL", "HIGH"] else Fore.YELLOW if sev == "MEDIUM" else Fore.CYAN
            print(color + f"  {sev}: {count}")
    
    # Common issues
    enforcement_violations = sum(len(f.get("enforcement_violations", [])) for f in raw_findings)
    replay_issues = sum(1 for f in raw_findings if f.get("replay_detected"))
    
    if enforcement_violations > 0:
        print(Fore.RED + f"\n  Enforcement Violations: {enforcement_violations}")
    if replay_issues > 0:
        print(Fore.YELLOW + f"  Replay Vulnerabilities: {replay_issues}")
    
    print(Fore.GREEN + "\n" + "="*60)
    print(Fore.GREEN + "Reports saved to: " + os.path.join(OUTPUT_BASE, "*"))
    print(Fore.GREEN + "="*60 + Style.RESET_ALL + "\n")

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