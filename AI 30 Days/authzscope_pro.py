# ==========================================================
# AuthZScope Pro — Enterprise Edition
# Tool 18/30
# Part 1/4 — Core & Authorization Schema
# ==========================================================

import re
import os
import sys
import json
import csv
import time
import random
import threading
from datetime import datetime, timezone
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
OUTPUT_BASE = os.path.join("reports", "authzscope_pro")
TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
JSON_DIR = os.path.join(OUTPUT_BASE, "json")
CSV_DIR = os.path.join(OUTPUT_BASE, "csv")

for d in (TXT_DIR, JSON_DIR, CSV_DIR):
    os.makedirs(d, exist_ok=True)

# ----------------------------------------------------------
# Defaults (enterprise-safe, authorization testing only)
# ----------------------------------------------------------
REQUEST_TIMEOUT = 10
THREADS_DEFAULT = 6
DEFAULT_THREADS = 4
MAX_WORKERS = 8
DELAY_BETWEEN_REQUESTS = 0.4

# Common endpoints for authorization testing
AUTHORIZATION_ENDPOINTS = [
    "/api/users/{id}/profile",
    "/api/admin/users",
    "/api/account",
    "/api/settings",
    "/api/data",
    "/api/v1/user",
    "/api/v1/admin",
    "/dashboard",
    "/profile",
    "/admin"
]

# Role patterns for testing (safe, non-invasive)
ROLE_PATTERNS = {
    "user": ["/api/user/", "/profile", "/dashboard"],
    "admin": ["/api/admin/", "/admin", "/settings"],
    "public": ["/api/public/", "/info", "/status"]
}

# HTTP methods to test authorization boundaries
AUTHORIZATION_METHODS = ["GET", "POST", "PUT", "DELETE"]

# Parameter patterns that might indicate user/role context
CONTEXT_PARAMETERS = [
    "user_id", "userid", "uid", "id", 
    "account_id", "accountid", "account",
    "role", "scope", "permission"
]

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
            "AuthZScope-Pro/1.0"
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

def safe_request(session, method, url, headers=None, cookies=None, allow_redirects=False):
    """Safe HTTP wrapper - no parameter manipulation, no destructive actions."""
    try:
        r = session.request(
            method=method,
            url=url,
            headers=headers or random_headers(),
            cookies=cookies,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=allow_redirects,
            verify=True
        )
        return {
            "status": r.status_code,
            "headers": dict(r.headers),
            "cookies": dict(r.cookies),
            "length": len(r.content or b""),
            "time": r.elapsed.total_seconds(),
            "url": r.url
        }
    except Exception as e:
        return {"error": str(e)}

# ----------------------------------------------------------
# Canonical Finding Schema (LOCKED)
# ----------------------------------------------------------
def new_finding():
    """Canonical finding object for authorization analysis."""
    return {
        "url": None,
        "path": None,
        "method": None,
        
        # Authorization Context
        "role_tested": None,
        "context_parameters": [],
        "authorization_boundary": None,
        
        # Observed Behavior
        "observed_response": None,
        "expected_response": None,
        "evidence": [],
        "status_codes": [],
        
        # Authorization Issues
        "missing_authorization": False,
        "role_inconsistency": False,
        "privilege_overreach": False,
        "boundary_leakage": False,
        "horizontal_violation": False,
        "vertical_violation": False,
        
        # Analysis Results
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
    f.setdefault("role_tested", None)
    f.setdefault("context_parameters", [])
    f.setdefault("authorization_boundary", None)
    f.setdefault("observed_response", None)
    f.setdefault("expected_response", None)
    f.setdefault("evidence", [])
    f.setdefault("status_codes", [])
    f.setdefault("missing_authorization", False)
    f.setdefault("role_inconsistency", False)
    f.setdefault("privilege_overreach", False)
    f.setdefault("boundary_leakage", False)
    f.setdefault("horizontal_violation", False)
    f.setdefault("vertical_violation", False)
    f.setdefault("classification", [])
    f.setdefault("score", 0)
    f.setdefault("severity", "INFO")
    return f

# ==========================================================
# End of Part 1/4
# ==========================================================

# ==========================================================
# AuthZScope Pro — Enterprise Edition
# Tool 18/30
# Part 2/4 — Authorization Detection Engine
# ==========================================================

class AuthorizationAnalyzer:
    """Authorization boundary and role consistency analyzer."""
    
    def __init__(self, base_url):
        self.base = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(random_headers())
        
    def build_url(self, path):
        """Build full URL from path."""
        return urljoin(self.base + "/", path.lstrip("/"))
    
    def extract_context_parameters(self, url: str):
        """Extract potential context parameters from URL."""
        parsed = urlparse(url)
        params = []
        
        # Extract from path segments
        path_segments = parsed.path.strip("/").split("/")
        for i, segment in enumerate(path_segments):
            if any(param in segment.lower() for param in CONTEXT_PARAMETERS):
                params.append({
                    "type": "path_segment",
                    "position": i,
                    "value": segment,
                    "key": segment.split("_")[0] if "_" in segment else segment
                })
        
        # Extract from query parameters
        query_params = parse_qs(parsed.query)
        for key, values in query_params.items():
            if any(param in key.lower() for param in CONTEXT_PARAMETERS):
                params.append({
                    "type": "query_param",
                    "key": key,
                    "values": values
                })
        
        return params
    
    def infer_role_from_path(self, path: str):
        """Infer probable role from endpoint path patterns."""
        path_lower = path.lower()
        
        if "admin" in path_lower or "settings" in path_lower:
            return "admin"
        elif "user" in path_lower or "profile" in path_lower:
            return "user"
        elif "public" in path_lower or "info" in path_lower:
            return "public"
        else:
            return None
    
    def test_endpoint_authorization(self, url: str, method: str = "GET"):
        """Test endpoint authorization without authentication."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = method
        
        # Extract context parameters
        context_params = self.extract_context_parameters(url)
        finding["context_parameters"] = context_params
        
        # Infer role from path
        inferred_role = self.infer_role_from_path(url)
        finding["role_tested"] = inferred_role
        
        # Test endpoint without authentication
        resp = safe_request(self.session, method, url)
        
        if not resp or "error" in resp:
            finding["classification"].append("endpoint_unreachable")
            finding["score"] = 5
            return finding
        
        status = resp.get("status", 0)
        finding["status_codes"] = [status]
        finding["observed_response"] = {
            "status": status,
            "length": resp.get("length", 0)
        }
        
        # Analyze authorization based on status code
        if status in [200, 201, 204]:
            # Endpoint accessible without authentication
            finding["missing_authorization"] = True
            finding["classification"].append("missing_authorization")
            
            if inferred_role in ["admin", "user"]:
                finding["score"] = 80
                finding["classification"].append("privileged_endpoint_unprotected")
            else:
                finding["score"] = 40
        
        elif status in [401, 403]:
            # Proper authorization required
            finding["classification"].append("authorization_required")
            finding["score"] = 10
            
            # Check if proper WWW-Authenticate header is present
            headers = resp.get("headers", {})
            if status == 401 and "WWW-Authenticate" not in headers:
                finding["classification"].append("missing_www_authenticate")
                finding["score"] = 30
        
        elif status in [404, 405]:
            finding["classification"].append(f"endpoint_{status}")
            finding["score"] = 5
        
        else:
            finding["classification"].append(f"unexpected_status_{status}")
            finding["score"] = 20
        
        finding["severity"] = score_to_severity(finding["score"])
        return finding
    
    def test_role_consistency(self, endpoint_patterns: dict):
        """Test consistency of authorization across role-based endpoints."""
        findings = []
        
        for role, patterns in endpoint_patterns.items():
            for pattern in patterns[:2]:  # Test up to 2 patterns per role
                url = self.build_url(pattern)
                finding = self.test_endpoint_authorization(url)
                finding["role_tested"] = role
                findings.append(finding)
                time.sleep(DELAY_BETWEEN_REQUESTS)
        
        return findings
    
    def detect_authorization_boundaries(self, endpoints: list):
        """Detect authorization boundaries across different endpoint types."""
        findings = []
        
        for endpoint in endpoints:
            # Test with placeholder ID (safe, non-manipulative)
            if "{id}" in endpoint:
                # Replace with a safe placeholder
                test_url = endpoint.replace("{id}", "test123")
            else:
                test_url = endpoint
            
            url = self.build_url(test_url)
            
            # Test with different HTTP methods
            for method in AUTHORIZATION_METHODS[:2]:  # Test GET and POST only
                finding = self.test_endpoint_authorization(url, method)
                
                # Determine authorization boundary
                status = finding.get("observed_response", {}).get("status", 0)
                if status in [200, 201, 204]:
                    finding["authorization_boundary"] = "none"
                elif status in [401, 403]:
                    finding["authorization_boundary"] = "present"
                else:
                    finding["authorization_boundary"] = "unknown"
                
                findings.append(finding)
                time.sleep(DELAY_BETWEEN_REQUESTS)
        
        return findings

# ==========================================================
# End of Part 2/4
# ==========================================================

# ==========================================================
# AuthZScope Pro — Enterprise Edition
# Tool 18/30
# Part 3/4 — Risk Scoring & Reporting
# ==========================================================

class AuthorizationScorer:
    """Score authorization risks based on analysis findings."""
    
    @staticmethod
    def score_finding(finding: dict) -> dict:
        """Calculate risk score for authorization finding."""
        score = 0
        
        # Base score adjustments
        if finding.get("missing_authorization"):
            score += 60
            
            # Adjust based on role
            role = finding.get("role_tested")
            if role == "admin":
                score += 25
            elif role == "user":
                score += 15
        
        if finding.get("privilege_overreach"):
            score += 70
        
        if finding.get("role_inconsistency"):
            score += 50
        
        if finding.get("boundary_leakage"):
            score += 55
        
        if finding.get("horizontal_violation"):
            score += 65
        
        if finding.get("vertical_violation"):
            score += 75
        
        # Context parameter exposure
        context_params = finding.get("context_parameters", [])
        if context_params and finding.get("missing_authorization"):
            score += 10
        
        # Status code analysis
        status = finding.get("observed_response", {}).get("status", 0)
        if status == 200 and finding.get("role_tested") in ["admin", "user"]:
            score += 20
        
        # Classification adjustments
        classifications = finding.get("classification", [])
        for classification in classifications:
            if "privileged_endpoint_unprotected" in classification:
                score = max(score, 80)
            elif "missing_www_authenticate" in classification:
                score = max(score, 30)
        
        # Cap score at 100
        score = min(100, score)
        
        finding["score"] = score
        finding["severity"] = score_to_severity(score)
        
        return finding
    
    @staticmethod
    def generate_recommendations(finding: dict):
        """Generate security recommendations based on findings."""
        recommendations = []
        
        if finding.get("missing_authorization"):
            role = finding.get("role_tested", "unknown")
            recommendations.append(f"Implement authentication and authorization for {role} endpoints")
        
        if finding.get("privilege_overreach"):
            recommendations.append("Implement proper role-based access control (RBAC)")
        
        if finding.get("role_inconsistency"):
            recommendations.append("Ensure consistent authorization enforcement across similar endpoints")
        
        if finding.get("boundary_leakage"):
            recommendations.append("Review and tighten authorization boundaries between roles")
        
        if finding.get("horizontal_violation"):
            recommendations.append("Implement user context validation to prevent horizontal privilege escalation")
        
        if finding.get("vertical_violation"):
            recommendations.append("Implement strict role separation to prevent vertical privilege escalation")
        
        context_params = finding.get("context_parameters", [])
        if context_params and finding.get("missing_authorization"):
            recommendations.append("Validate user context parameters with proper authorization checks")
        
        # Always include general recommendations
        recommendations.append("Use framework-based authorization middleware")
        recommendations.append("Implement centralized access control policies")
        recommendations.append("Regularly audit authorization logic and test boundaries")
        
        finding["recommendations"] = recommendations[:5]  # Limit to 5 recommendations
    
    @staticmethod
    def analyze_authorization_patterns(findings: list):
        """Analyze patterns across multiple findings."""
        analysis = {
            "total_findings": len(findings),
            "high_risk_endpoints": 0,
            "missing_authorization": 0,
            "role_inconsistencies": 0,
            "privilege_issues": 0,
            "endpoint_coverage": {}
        }
        
        for finding in findings:
            score = finding.get("score", 0)
            if score >= 70:
                analysis["high_risk_endpoints"] += 1
            
            if finding.get("missing_authorization"):
                analysis["missing_authorization"] += 1
            
            if finding.get("role_inconsistency"):
                analysis["role_inconsistencies"] += 1
            
            if finding.get("privilege_overreach") or finding.get("boundary_leakage"):
                analysis["privilege_issues"] += 1
            
            # Track endpoint coverage by role
            role = finding.get("role_tested", "unknown")
            if role not in analysis["endpoint_coverage"]:
                analysis["endpoint_coverage"][role] = 0
            analysis["endpoint_coverage"][role] += 1
        
        return analysis

def write_reports(client: str, base: str, findings: list):
    """Generate authorization analysis reports."""
    ts = now_ts()
    safe_client = re.sub(r"[^A-Za-z0-9_-]", "_", client)[:25]
    host = urlparse(base).hostname or "target"
    basefn = f"{safe_client}_authzscope_{host}_{ts}"
    
    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")
    
    normalized = [normalize_finding(f) for f in findings]
    
    # Score all findings
    scorer = AuthorizationScorer()
    scored_findings = []
    for finding in normalized:
        finding = scorer.score_finding(finding)
        scorer.generate_recommendations(finding)
        scored_findings.append(finding)
    
    # TXT REPORT
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== AUTHZSCOPE PRO — AUTHORIZATION SECURITY ANALYSIS ===\n\n")
        tf.write(f"Client: {client}\n")
        tf.write(f"Target: {base}\n")
        tf.write(f"Generated: {datetime.utcnow()}\n")
        tf.write(f"Scope: Authorization boundary & role consistency testing\n\n")
        tf.write(f"Total Findings: {len(scored_findings)}\n\n")
        
        # Analysis summary
        analysis = AuthorizationScorer.analyze_authorization_patterns(scored_findings)
        tf.write("Analysis Summary:\n")
        tf.write(f"  High Risk Endpoints: {analysis['high_risk_endpoints']}\n")
        tf.write(f"  Missing Authorization: {analysis['missing_authorization']}\n")
        tf.write(f"  Role Inconsistencies: {analysis['role_inconsistencies']}\n")
        tf.write(f"  Privilege Issues: {analysis['privilege_issues']}\n\n")
        
        tf.write("Endpoint Coverage by Role:\n")
        for role, count in analysis["endpoint_coverage"].items():
            tf.write(f"  {role}: {count} endpoints\n")
        tf.write("\n")
        
        # Detailed findings
        tf.write("DETAILED FINDINGS:\n")
        tf.write("=" * 60 + "\n\n")
        
        for f in sorted(scored_findings, key=lambda x: x["score"], reverse=True):
            if f["score"] < 20:
                continue  # Skip very low relevance findings
            
            tf.write(f"URL: {f['url']}\n")
            tf.write(f"Method: {f['method']}\n")
            tf.write(f"Role Tested: {f.get('role_tested', 'Unknown')}\n")
            tf.write(f"Severity: {f['severity']} (Score: {f['score']})\n")
            
            # Issues
            issues = []
            if f.get("missing_authorization"):
                issues.append("Missing Authorization")
            if f.get("role_inconsistency"):
                issues.append("Role Inconsistency")
            if f.get("privilege_overreach"):
                issues.append("Privilege Overreach")
            if f.get("boundary_leakage"):
                issues.append("Boundary Leakage")
            
            if issues:
                tf.write(f"Issues: {', '.join(issues)}\n")
            
            # Response information
            obs = f.get("observed_response", {})
            if obs:
                tf.write(f"Response: HTTP {obs.get('status', 0)} (Length: {obs.get('length', 0)} bytes)\n")
            
            # Context parameters
            context_params = f.get("context_parameters", [])
            if context_params:
                tf.write("Context Parameters Detected:\n")
                for param in context_params[:3]:  # Limit to 3
                    tf.write(f"  • {param.get('type')}: {param.get('key', 'unknown')}\n")
            
            # Recommendations
            recs = f.get("recommendations", [])
            if recs:
                tf.write("Recommendations:\n")
                for rec in recs[:3]:  # Limit to 3
                    tf.write(f"  • {rec}\n")
            
            tf.write("\n" + "-" * 40 + "\n\n")
    
    # JSON REPORT
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(
            sanitize({
                "tool": "AuthZScope Pro",
                "version": "1.0",
                "client": client,
                "target": base,
                "scan_type": "authorization_analysis",
                "generated": ts,
                "analysis_summary": analysis,
                "findings": scored_findings
            }),
            jf,
            indent=2,
            ensure_ascii=False
        )
    
    # CSV REPORT
    with open(csv_path, "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow([
            "severity", "score", "url", "method", "role_tested",
            "missing_auth", "privilege_overreach", "role_inconsistency",
            "boundary_leakage", "context_params", "recommendations"
        ])
        
        for f in scored_findings:
            if f["score"] < 20:
                continue
            
            context_count = len(f.get("context_parameters", []))
            recs = f.get("recommendations", [])
            
            writer.writerow([
                f["severity"],
                f["score"],
                f["url"],
                f["method"],
                f.get("role_tested", ""),
                f.get("missing_authorization", False),
                f.get("privilege_overreach", False),
                f.get("role_inconsistency", False),
                f.get("boundary_leakage", False),
                context_count,
                ";".join(recs[:2])  # Limit to 2 recommendations
            ])
    
    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")
    
    return txt_path, json_path, csv_path

# ==========================================================
# End of Part 3/4
# ==========================================================

# ==========================================================
# AuthZScope Pro — Enterprise Edition
# Tool 18/30
# Part 4/4 — CLI & Main Orchestrator
# ==========================================================

class AuthZScopePro:
    """Enterprise Authorization Security Analyzer."""
    
    def __init__(self, base_url, threads=None):
        self.base = base_url.rstrip("/")
        self.threads = min(threads or DEFAULT_THREADS, MAX_WORKERS)
        
        self.analyzer = AuthorizationAnalyzer(base_url)
        self.scorer = AuthorizationScorer()
        
        self.findings = []
        self.task_queue = Queue()
        self.results_queue = Queue()
        self.workers = []
    
    def _worker(self):
        """Worker thread for authorization testing."""
        while True:
            try:
                task = self.task_queue.get(timeout=2)
                if task is None:
                    break
                
                endpoint = task.get("endpoint")
                method = task.get("method", "GET")
                
                finding = self.analyzer.test_endpoint_authorization(
                    self.analyzer.build_url(endpoint),
                    method
                )
                
                self.results_queue.put(finding)
                self.task_queue.task_done()
                time.sleep(DELAY_BETWEEN_REQUESTS)
                
            except Empty:
                break
            except Exception as e:
                print(Fore.YELLOW + f"[!] Worker error: {e}")
                self.task_queue.task_done()
    
    def run(self, endpoints=None, custom_patterns=None):
        """Execute authorization security analysis."""
        print(Fore.CYAN + f"[i] Starting AuthZScope Pro analysis on {self.base}")
        print(Fore.CYAN + f"[i] Scope: Authorization boundary & role consistency detection")
        
        # Build endpoint list
        test_endpoints = endpoints or AUTHORIZATION_ENDPOINTS
        
        # Start worker threads
        for _ in range(self.threads):
            worker = threading.Thread(target=self._worker)
            worker.daemon = True
            worker.start()
            self.workers.append(worker)
        
        # Queue tasks
        for endpoint in test_endpoints:
            # Test with GET method
            self.task_queue.put({
                "endpoint": endpoint,
                "method": "GET"
            })
            
            # Test with POST method for privileged endpoints
            if any(role in endpoint.lower() for role in ["admin", "user", "settings"]):
                self.task_queue.put({
                    "endpoint": endpoint,
                    "method": "POST"
                })
        
        # Wait for completion
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
        
        # Score all findings
        scored_findings = []
        for finding in all_findings:
            finding = self.scorer.score_finding(finding)
            self.scorer.generate_recommendations(finding)
            scored_findings.append(finding)
        
        self.findings = scored_findings
        
        # Summary
        high_risk = sum(1 for f in scored_findings if f.get("score", 0) >= 70)
        medium_risk = sum(1 for f in scored_findings if 40 <= f.get("score", 0) < 70)
        
        print(Fore.CYAN + f"[i] Analysis complete.")
        print(Fore.CYAN + f"[i] Endpoints tested: {len(scored_findings)}")
        print(Fore.CYAN + f"[i] High risk findings: {high_risk}")
        print(Fore.CYAN + f"[i] Medium risk findings: {medium_risk}")
        
        return self.findings

def main():
    """Command-line interface for AuthZScope Pro."""
    print("\n" + "="*60)
    print("AUTHZSCOPE PRO — ENTERPRISE AUTHORIZATION SECURITY ANALYZER")
    print("="*60)
    print("Scope: Authorization boundary & role consistency detection")
    print("No exploitation, no parameter manipulation, safe testing only\n")
    
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
    
    print("\nOptional: Custom endpoint file")
    wordlist = input("Custom endpoints file (optional): ").strip() or None
    
    # Load custom endpoints if provided
    custom_endpoints = []
    if wordlist and os.path.exists(wordlist):
        try:
            with open(wordlist, 'r') as f:
                custom_endpoints = [line.strip() for line in f if line.strip()]
            print(Fore.CYAN + f"[i] Loaded {len(custom_endpoints)} custom endpoints")
        except Exception as e:
            print(Fore.YELLOW + f"[!] Could not load wordlist: {e}")
    
    print("\n[!] PERMISSION & SCOPE CONFIRMATION")
    print("This tool performs SAFE authorization testing only:")
    print("  • No credential testing")
    print("  • No parameter manipulation")
    print("  • No destructive actions")
    print("  • Only observes authorization behavior")
    
    confirm = input("\nType 'AUTH-TESTING-ONLY' to confirm: ").strip()
    if confirm != "AUTH-TESTING-ONLY":
        print(Fore.YELLOW + "[!] Permission not confirmed. Exiting.")
        return
    
    # Run scanner
    print(Fore.CYAN + f"\n[i] Initializing authorization analyzer...")
    
    scanner = AuthZScopePro(
        base_url=base,
        threads=threads
    )
    
    # Combine endpoints
    all_endpoints = AUTHORIZATION_ENDPOINTS.copy()
    if custom_endpoints:
        all_endpoints.extend(custom_endpoints)
    
    print(Fore.CYAN + f"[i] Testing {len(all_endpoints)} endpoints...")
    print(Fore.CYAN + f"[i] Using {threads} threads with {DELAY_BETWEEN_REQUESTS}s delays")
    
    raw_findings = scanner.run(endpoints=all_endpoints)
    
    print(Fore.CYAN + f"[i] Generating authorization analysis reports...")
    
    # Generate reports
    write_reports(client, base, raw_findings)
    
    # Summary
    print(Fore.GREEN + "\n" + "="*60)
    print(Fore.GREEN + "[✓] AUTHORIZATION SECURITY ANALYSIS COMPLETE")
    print(Fore.GREEN + "="*60)
    
    # Count by severity
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in raw_findings:
        sev = f.get("severity", "INFO")
        if sev in severity_counts:
            severity_counts[sev] += 1
    
    print(Fore.CYAN + "\nAuthorization Risk Summary:")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        count = severity_counts[sev]
        if count > 0:
            color = Fore.RED if sev in ["CRITICAL", "HIGH"] else Fore.YELLOW if sev == "MEDIUM" else Fore.CYAN
            print(color + f"  {sev}: {count}")
    
    # Common findings
    missing_auth = sum(1 for f in raw_findings if f.get("missing_authorization"))
    privilege_issues = sum(1 for f in raw_findings if f.get("privilege_overreach") or f.get("boundary_leakage"))
    
    if missing_auth > 0:
        print(Fore.RED + f"\n  Missing Authorization: {missing_auth} endpoints")
    if privilege_issues > 0:
        print(Fore.YELLOW + f"  Privilege Issues: {privilege_issues} endpoints")
    
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