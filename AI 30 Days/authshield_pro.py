# ==========================================================
# AuthAudit Pro — Enterprise Edition
# Tool 16/30
# Authentication & Session Security Analyzer
# Scope: Configuration Analysis Only - Non-Destructive
# ==========================================================

import re
import os
import sys
import time
import json
import csv
import random
import threading
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin, urlparse
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
OUTPUT_BASE = os.path.join("reports", "authaudit_pro")
TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
JSON_DIR = os.path.join(OUTPUT_BASE, "json")
CSV_DIR = os.path.join(OUTPUT_BASE, "csv")

for d in (TXT_DIR, JSON_DIR, CSV_DIR):
    os.makedirs(d, exist_ok=True)

# ----------------------------------------------------------
# Defaults (enterprise-safe, non-destructive)
# ----------------------------------------------------------
REQUEST_TIMEOUT = 10
DEFAULT_THREADS = 4
THREADS_DEFAULT = 6
MAX_WORKERS = 8
DELAY_BETWEEN_REQUESTS = 0.5  # Conservative delay for production safety

# Authentication endpoints (observation only)
AUTH_ENDPOINTS = [
    "/login",
    "/signin",
    "/auth",
    "/oauth2/authorize",
    "/api/auth/login",
    "/api/v1/auth",
    "/account/login",
    "/user/login",
    "/admin/login",
    "/wp-login.php",
    "/administrator/index.php"
]

# Session management endpoints
SESSION_ENDPOINTS = [
    "/logout",
    "/signout",
    "/auth/logout",
    "/session",
    "/api/session",
    "/profile",
    "/account",
    "/dashboard",
    "/home"
]

# Security headers to check on auth pages
SECURITY_HEADERS = {
    "X-Frame-Options": "Prevents clickjacking",
    "X-Content-Type-Options": "Prevents MIME sniffing",
    "Content-Security-Policy": "Prevents XSS",
    "Strict-Transport-Security": "Enforces HTTPS",
    "Referrer-Policy": "Controls referrer information"
}

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

def random_headers():
    return {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
            "AuthAudit-Pro-Scanner/1.0"
        ]),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "close"
    }

def score_to_severity(score: int) -> str:
    for level, (low, high) in SCORE_LEVELS.items():
        if low <= score <= high:
            return level
    return "INFO"

def safe_request(session, method, url, headers=None, cookies=None, allow_redirects=True):
    """Safe HTTP wrapper - no POST data, no credential testing."""
    try:
        r = session.request(
            method=method,
            url=url,
            headers=headers or random_headers(),
            cookies=cookies,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=allow_redirects,
            verify=True  # SSL verification ON for enterprise safety
        )
        return {
            "status": r.status_code,
            "headers": dict(r.headers),
            "cookies": dict(r.cookies),
            "length": len(r.content or b""),
            "time": r.elapsed.total_seconds(),
            "url": r.url,
            "history": [resp.url for resp in r.history]
        }
    except Exception as e:
        return {"error": str(e)}

# ----------------------------------------------------------
# Canonical Finding Schema (LOCKED)
# ----------------------------------------------------------
def new_finding():
    """Canonical finding object - Configuration Analysis Only."""
    return {
        "url": None,
        "path": None,
        "method": None,
        
        # Authentication/Session Configuration
        "auth_endpoint_detected": False,
        "session_cookies_found": [],
        "cookie_attributes": {},
        "security_headers_present": {},
        "security_headers_missing": [],
        "csrf_token_detected": False,
        "logout_implementation": None,
        "session_management_observed": None,
        
        # Analysis Results
        "configuration_issues": [],
        "best_practice_violations": [],
        "security_recommendations": [],
        
        # Scoring
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
    f.setdefault("auth_endpoint_detected", False)
    f.setdefault("session_cookies_found", [])
    f.setdefault("cookie_attributes", {})
    f.setdefault("security_headers_present", {})
    f.setdefault("security_headers_missing", [])
    f.setdefault("csrf_token_detected", False)
    f.setdefault("logout_implementation", None)
    f.setdefault("session_management_observed", None)
    f.setdefault("configuration_issues", [])
    f.setdefault("best_practice_violations", [])
    f.setdefault("security_recommendations", [])
    f.setdefault("classification", [])
    f.setdefault("score", 0)
    f.setdefault("severity", "INFO")
    return f

# ----------------------------------------------------------
# Analysis Engines (Observation Only)
# ----------------------------------------------------------
class CookieAnalyzer:
    """Analyze cookie security attributes - Read Only."""
    
    @staticmethod
    def analyze_cookie_security(headers):
        """Analyze Set-Cookie headers for security attributes."""
        cookie_analysis = {
            "http_only_present": False,
            "secure_present": False,
            "same_site_value": None,
            "max_age_seconds": None,
            "expires_set": False,
            "path_restricted": False,
            "domain_restricted": False
        }
        
        set_cookie_headers = []
        for k, v in headers.items():
            if k.lower() == "set-cookie":
                set_cookie_headers.append(v)
            elif k.lower() == "set-cookie2":
                set_cookie_headers.append(v)
        
        for cookie_header in set_cookie_headers:
            cookie_lower = cookie_header.lower()
            
            # Check security attributes
            if "httponly" in cookie_lower:
                cookie_analysis["http_only_present"] = True
            if "secure" in cookie_lower:
                cookie_analysis["secure_present"] = True
            
            # Check SameSite
            if "samesite=" in cookie_lower:
                if "samesite=strict" in cookie_lower:
                    cookie_analysis["same_site_value"] = "Strict"
                elif "samesite=lax" in cookie_lower:
                    cookie_analysis["same_site_value"] = "Lax"
                elif "samesite=none" in cookie_lower:
                    cookie_analysis["same_site_value"] = "None"
            
            # Check Max-Age
            max_age_match = re.search(r'max-age=(\d+)', cookie_lower)
            if max_age_match:
                cookie_analysis["max_age_seconds"] = int(max_age_match.group(1))
            
            # Check Expires
            if "expires=" in cookie_lower:
                cookie_analysis["expires_set"] = True
            
            # Check Path
            path_match = re.search(r'path=([^;]+)', cookie_lower)
            if path_match and path_match.group(1).strip() not in ["/", "/*"]:
                cookie_analysis["path_restricted"] = True
            
            # Check Domain
            domain_match = re.search(r'domain=([^;]+)', cookie_lower)
            if domain_match:
                cookie_analysis["domain_restricted"] = True
        
        return cookie_analysis
    
    @staticmethod
    def detect_session_cookies(cookies):
        """Identify likely session cookies by name patterns."""
        session_patterns = [
            r'session', r'sess', r'token', r'auth', r'jwt', 
            r'php.?sess', r'jsession', r'asp.?session'
        ]
        
        session_cookies = []
        for cookie_name in cookies.keys():
            cookie_lower = cookie_name.lower()
            if any(re.search(pattern, cookie_lower) for pattern in session_patterns):
                session_cookies.append(cookie_name)
        
        return session_cookies

class AuthPageAnalyzer:
    """Analyze authentication pages for security configuration."""
    
    @staticmethod
    def analyze_security_headers(headers):
        """Check for presence of security headers."""
        present = {}
        missing = []
        
        for header, description in SECURITY_HEADERS.items():
            if header in headers:
                present[header] = {
                    "value": headers[header],
                    "description": description
                }
            else:
                missing.append(header)
        
        return present, missing
    
    @staticmethod
    def detect_csrf_token(content: str) -> bool:
        """Detect potential CSRF tokens in page content (non-invasive)."""
        csrf_patterns = [
            r'csrf.*token.*=.*["\']([^"\']+)["\']',
            r'_token.*=.*["\']([^"\']+)["\']',
            r'csrfmiddlewaretoken.*value.*=.*["\']([^"\']+)["\']',
            r'name=["\']csrf["\']',
            r'name=["\']_token["\']',
            r'name=["\']csrf_token["\']'
        ]
        
        content_lower = content.lower()
        for pattern in csrf_patterns:
            if re.search(pattern, content_lower):
                return True
        
        return False
    
    @staticmethod
    def analyze_form_security(content: str):
        """Analyze form security configuration (observation only)."""
        findings = []
        content_lower = content.lower()
        
        # Check for autocomplete on password fields
        if 'autocomplete="off"' not in content_lower and 'type="password"' in content_lower:
            findings.append("password_autocomplete_enabled")
        
        # Check for insecure form attributes
        if 'method="get"' in content_lower and ('password' in content_lower or 'login' in content_lower):
            findings.append("auth_form_uses_get_method")
        
        return findings

# ----------------------------------------------------------
# Main Scanner Class
# ----------------------------------------------------------
class AuthAuditPro:
    """Enterprise Authentication Configuration Analyzer - Non-Destructive."""
    
    def __init__(self, base_url, threads=None, timeout=REQUEST_TIMEOUT):
        self.base = base_url.rstrip("/")
        self.timeout = timeout
        self.threads = min(threads or DEFAULT_THREADS, MAX_WORKERS)
        
        # Initialize analyzers
        self.cookie_analyzer = CookieAnalyzer()
        self.auth_analyzer = AuthPageAnalyzer()
        
        # Results storage
        self.findings = []
        self.discovered_endpoints = set()
        
        # Create session with conservative settings
        self.session = requests.Session()
        self.session.headers.update(random_headers())
        
        # Thread pool
        self.task_queue = Queue()
        self.results_queue = Queue()
        self.workers = []
        
    def build_url(self, path):
        """Build full URL from path."""
        return urljoin(self.base + "/", path.lstrip("/"))
    
    def _worker(self):
        """Worker thread for safe, controlled scanning."""
        while True:
            try:
                task = self.task_queue.get(timeout=2)
                if task is None:
                    break
                
                task_type = task.get("type")
                url = task.get("url")
                
                if task_type == "auth_page_analysis":
                    result = self._analyze_auth_page(url)
                elif task_type == "session_analysis":
                    result = self._analyze_session_endpoint(url)
                elif task_type == "logout_analysis":
                    result = self._analyze_logout(url)
                else:
                    result = None
                
                if result:
                    self.results_queue.put(result)
                
                self.task_queue.task_done()
                time.sleep(DELAY_BETWEEN_REQUESTS)  # Conservative delay
                
            except Empty:
                break
            except Exception as e:
                print(Fore.YELLOW + f"[!] Worker observation error (non-critical): {e}")
                self.task_queue.task_done()
    
    def _analyze_auth_page(self, url):
        """Analyze authentication page configuration."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "GET"
        
        # Safe observation only - GET request
        resp = safe_request(self.session, "GET", url)
        
        if not resp or "error" in resp:
            finding["classification"].append("endpoint_unreachable")
            finding["score"] = 5
            return finding
        
        # Check if this appears to be an auth endpoint
        is_auth_endpoint = self._is_auth_endpoint(url, resp)
        finding["auth_endpoint_detected"] = is_auth_endpoint
        
        # Analyze security headers
        headers = resp.get("headers", {})
        present_headers, missing_headers = self.auth_analyzer.analyze_security_headers(headers)
        finding["security_headers_present"] = present_headers
        finding["security_headers_missing"] = missing_headers
        
        # Analyze cookies
        cookies = resp.get("cookies", {})
        cookie_analysis = self.cookie_analyzer.analyze_cookie_security(headers)
        finding["cookie_attributes"] = cookie_analysis
        
        session_cookies = self.cookie_analyzer.detect_session_cookies(cookies)
        finding["session_cookies_found"] = session_cookies
        
        # Detect CSRF tokens (observation only)
        try:
            content = resp.get("content", b"").decode('utf-8', errors='ignore')
            finding["csrf_token_detected"] = self.auth_analyzer.detect_csrf_token(content)
        except:
            finding["csrf_token_detected"] = False
        
        # Score based on configuration analysis
        score = self._score_auth_configuration(finding, is_auth_endpoint)
        finding["score"] = score
        finding["severity"] = score_to_severity(score)
        
        # Generate recommendations
        self._generate_recommendations(finding)
        
        return finding
    
    def _analyze_session_endpoint(self, url):
        """Analyze session management endpoints."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "GET"
        
        resp = safe_request(self.session, "GET", url)
        
        if not resp or "error" in resp:
            finding["classification"].append("endpoint_unreachable")
            finding["score"] = 5
            return finding
        
        # Check for session-related functionality
        cookies = resp.get("cookies", {})
        headers = resp.get("headers", {})
        
        session_cookies = self.cookie_analyzer.detect_session_cookies(cookies)
        finding["session_cookies_found"] = session_cookies
        
        # Analyze cookie security
        cookie_analysis = self.cookie_analyzer.analyze_cookie_security(headers)
        finding["cookie_attributes"] = cookie_analysis
        
        # Check if this appears to be a session management endpoint
        if "session" in url.lower() or "profile" in url.lower() or "account" in url.lower():
            finding["session_management_observed"] = "session_endpoint_detected"
        
        # Score based on session security
        score = self._score_session_security(finding)
        finding["score"] = score
        finding["severity"] = score_to_severity(score)
        
        self._generate_recommendations(finding)
        
        return finding
    
    def _analyze_logout(self, url):
        """Analyze logout endpoint behavior."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "GET"
        
        # First, get a session cookie (if any)
        home_resp = safe_request(self.session, "GET", self.build_url("/"))
        cookies_before = home_resp.get("cookies", {}) if home_resp else {}
        
        # Call logout endpoint
        logout_resp = safe_request(self.session, "GET", url, cookies=cookies_before)
        
        if not logout_resp or "error" in logout_resp:
            finding["classification"].append("logout_endpoint_unreachable")
            finding["score"] = 30
            return finding
        
        # Check if session cookies were cleared
        cookies_after = logout_resp.get("cookies", {})
        
        session_cleared = True
        for cookie_name, cookie_value in cookies_after.items():
            if cookie_value and cookie_value.strip():  # Cookie still has value
                session_cleared = False
                break
        
        if session_cleared:
            finding["logout_implementation"] = "proper_session_clearing"
            finding["classification"].append("logout_clears_session")
            finding["score"] = 20
        else:
            finding["logout_implementation"] = "session_persists_after_logout"
            finding["classification"].append("logout_does_not_clear_session")
            finding["configuration_issues"].append("incomplete_session_termination")
            finding["score"] = 60
        
        finding["severity"] = score_to_severity(finding["score"])
        self._generate_recommendations(finding)
        
        return finding
    
    def _is_auth_endpoint(self, url: str, response) -> bool:
        """Heuristically determine if this is an auth endpoint."""
        url_lower = url.lower()
        path = urlparse(url).path.lower()
        
        # URL patterns
        auth_patterns = ["login", "signin", "auth", "oauth", "sso"]
        if any(pattern in url_lower for pattern in auth_patterns):
            return True
        
        # Page content patterns (non-invasive)
        try:
            content = response.get("content", b"").decode('utf-8', errors='ignore').lower()
            content_patterns = ["password", "username", "sign in", "log in", "forgot password"]
            if any(pattern in content for pattern in content_patterns):
                return True
        except:
            pass
        
        return False
    
    def _score_auth_configuration(self, finding, is_auth_endpoint: bool) -> int:
        """Score authentication page security configuration."""
        score = 50  # Neutral starting point
        
        if not is_auth_endpoint:
            return 10  # Not an auth endpoint, low relevance
        
        # Positive factors
        cookie_attrs = finding.get("cookie_attributes", {})
        if cookie_attrs.get("http_only_present"):
            score += 10
        if cookie_attrs.get("secure_present"):
            score += 10
        if cookie_attrs.get("same_site_value") in ["Strict", "Lax"]:
            score += 10
        if finding.get("csrf_token_detected"):
            score += 10
        
        # Security headers
        missing_headers = finding.get("security_headers_missing", [])
        score -= len(missing_headers) * 5
        
        # Session cookies on auth pages (should be minimal)
        session_cookies = finding.get("session_cookies_found", [])
        if session_cookies and is_auth_endpoint:
            score -= 15  # Pre-existing session cookies on login page
        
        # Ensure score stays in bounds
        return max(0, min(100, score))
    
    def _score_session_security(self, finding) -> int:
        """Score session security configuration."""
        score = 50
        
        cookie_attrs = finding.get("cookie_attributes", {})
        
        # Cookie security attributes
        if not cookie_attrs.get("http_only_present"):
            score -= 20
            finding["best_practice_violations"].append("missing_httponly")
        
        if not cookie_attrs.get("secure_present"):
            score -= 15
            finding["best_practice_violations"].append("missing_secure_flag")
        
        same_site = cookie_attrs.get("same_site_value")
        if not same_site or same_site == "None":
            score -= 10
            finding["best_practice_violations"].append("weak_samesite_policy")
        
        # Session timeout
        max_age = cookie_attrs.get("max_age_seconds")
        if max_age and max_age > 86400:  # More than 24 hours
            score -= 10
            finding["configuration_issues"].append("excessive_session_timeout")
        
        return max(0, min(100, score))
    
    def _generate_recommendations(self, finding):
        """Generate security recommendations based on analysis."""
        recs = []
        
        # Cookie security recommendations
        cookie_attrs = finding.get("cookie_attributes", {})
        if not cookie_attrs.get("http_only_present"):
            recs.append("Add HttpOnly flag to session cookies to prevent XSS access")
        
        if not cookie_attrs.get("secure_present"):
            recs.append("Add Secure flag to session cookies (requires HTTPS)")
        
        same_site = cookie_attrs.get("same_site_value")
        if not same_site or same_site == "None":
            recs.append("Implement SameSite=Strict or Lax for session cookies")
        
        # Security headers recommendations
        missing_headers = finding.get("security_headers_missing", [])
        for header in missing_headers:
            recs.append(f"Add {header} security header to authentication pages")
        
        # CSRF protection
        if finding.get("auth_endpoint_detected") and not finding.get("csrf_token_detected"):
            recs.append("Implement CSRF tokens on authentication forms")
        
        # Logout behavior
        if finding.get("logout_implementation") == "session_persists_after_logout":
            recs.append("Ensure logout endpoint properly clears all session cookies")
        
        finding["security_recommendations"] = recs
    
    def run(self, endpoints=None):
        """Execute non-destructive authentication configuration scan."""
        print(Fore.CYAN + f"[i] Starting AuthAudit Pro - Configuration Analysis on {self.base}")
        print(Fore.CYAN + f"[i] Mode: Non-destructive observation only")
        
        # Build endpoint lists
        auth_endpoints = [self.build_url(ep) for ep in (endpoints or AUTH_ENDPOINTS)]
        session_endpoints = [self.build_url(ep) for ep in SESSION_ENDPOINTS]
        
        # Start worker threads
        for _ in range(self.threads):
            worker = threading.Thread(target=self._worker)
            worker.daemon = True
            worker.start()
            self.workers.append(worker)
        
        # Queue analysis tasks
        for url in auth_endpoints:
            self.task_queue.put({
                "type": "auth_page_analysis",
                "url": url
            })
        
        for url in session_endpoints:
            if "logout" in url.lower() or "signout" in url.lower():
                self.task_queue.put({
                    "type": "logout_analysis",
                    "url": url
                })
            else:
                self.task_queue.put({
                    "type": "session_analysis",
                    "url": url
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
        
        self.findings = all_findings
        
        print(Fore.CYAN + f"[i] Analysis complete. Found {len(self.findings)} configuration observations.")
        return self.findings

# ----------------------------------------------------------
# Reporting Engine
# ----------------------------------------------------------
def write_reports(client: str, base: str, findings: list):
    """Generate configuration analysis reports."""
    ts = now_ts()
    safe_client = re.sub(r"[^A-Za-z0-9_-]", "_", client)[:25]
    host = urlparse(base).hostname or "target"
    basefn = f"{safe_client}_authaudit_config_{host}_{ts}"
    
    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")
    
    normalized = [normalize_finding(f) for f in findings]
    
    # TXT Report
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== AUTHAUDIT PRO — AUTHENTICATION CONFIGURATION ANALYSIS ===\n\n")
        tf.write(f"Client: {client}\n")
        tf.write(f"Target: {base}\n")
        tf.write(f"Generated: {datetime.utcnow()}\n")
        tf.write(f"Scope: Non-destructive configuration analysis only\n\n")
        tf.write(f"Total Observations: {len(normalized)}\n\n")
        
        # Summary
        auth_endpoints = sum(1 for f in normalized if f.get("auth_endpoint_detected"))
        session_issues = sum(1 for f in normalized if f.get("best_practice_violations"))
        missing_headers = sum(len(f.get("security_headers_missing", [])) for f in normalized)
        
        tf.write("Analysis Summary:\n")
        tf.write(f"  Authentication Endpoints Identified: {auth_endpoints}\n")
        tf.write(f"  Session Configuration Issues: {session_issues}\n")
        tf.write(f"  Missing Security Headers: {missing_headers}\n\n")
        
        # Detailed findings
        for f in sorted(normalized, key=lambda x: x["score"], reverse=True):
            if f["score"] < 10:
                continue  # Skip very low relevance findings
            
            tf.write("-" * 60 + "\n")
            tf.write(f"URL: {f['url']}\n")
            tf.write(f"Path: {f['path']}\n")
            tf.write(f"Severity: {f['severity']} (Score: {f['score']})\n")
            
            if f.get("auth_endpoint_detected"):
                tf.write("Type: Authentication Endpoint\n")
            
            if f.get("session_cookies_found"):
                tf.write(f"Session Cookies: {', '.join(f['session_cookies_found'])}\n")
            
            # Cookie Security
            cookie_attrs = f.get("cookie_attributes", {})
            if cookie_attrs:
                tf.write("Cookie Security Analysis:\n")
                tf.write(f"  HttpOnly: {cookie_attrs.get('http_only_present', False)}\n")
                tf.write(f"  Secure: {cookie_attrs.get('secure_present', False)}\n")
                tf.write(f"  SameSite: {cookie_attrs.get('same_site_value', 'Not Set')}\n")
                if cookie_attrs.get('max_age_seconds'):
                    hours = cookie_attrs['max_age_seconds'] / 3600
                    tf.write(f"  Max-Age: {cookie_attrs['max_age_seconds']}s ({hours:.1f} hours)\n")
            
            # Security Headers
            missing = f.get("security_headers_missing", [])
            if missing:
                tf.write(f"Missing Security Headers: {', '.join(missing)}\n")
            
            # Issues
            issues = f.get("configuration_issues", []) + f.get("best_practice_violations", [])
            if issues:
                tf.write(f"Configuration Issues: {', '.join(issues)}\n")
            
            # Recommendations
            recs = f.get("security_recommendations", [])
            if recs:
                tf.write("Recommendations:\n")
                for rec in recs[:3]:  # Limit to top 3
                    tf.write(f"  • {rec}\n")
            
            tf.write("\n")
    
    # JSON Report
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(
            sanitize({
                "tool": "AuthAudit Pro",
                "version": "1.0",
                "client": client,
                "target": base,
                "scan_type": "configuration_analysis",
                "scope": "non_destructive",
                "generated": ts,
                "findings": normalized
            }),
            jf,
            indent=2,
            ensure_ascii=False
        )
    
    # CSV Report
    with open(csv_path, "w", newline="", encoding="utf-8") as cf:
        writer = csv.writer(cf)
        writer.writerow([
            "severity", "score", "url", "auth_endpoint", "session_cookies",
            "http_only", "secure", "same_site", "csrf_detected",
            "missing_headers", "issues", "recommendations"
        ])
        
        for f in normalized:
            if f["score"] < 10:
                continue
            
            cookie_attrs = f.get("cookie_attributes", {})
            issues = f.get("configuration_issues", []) + f.get("best_practice_violations", [])
            recs = f.get("security_recommendations", [])
            
            writer.writerow([
                f["severity"],
                f["score"],
                f["url"],
                f.get("auth_endpoint_detected", False),
                ";".join(f.get("session_cookies_found", [])),
                cookie_attrs.get("http_only_present", False),
                cookie_attrs.get("secure_present", False),
                cookie_attrs.get("same_site_value", ""),
                f.get("csrf_token_detected", False),
                ";".join(f.get("security_headers_missing", [])),
                ";".join(issues[:3]),  # Limit issues
                ";".join(recs[:2])     # Limit recommendations
            ])
    
    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")
    
    return txt_path, json_path, csv_path

# ----------------------------------------------------------
# CLI Interface
# ----------------------------------------------------------
def main():
    """Command-line interface for AuthAudit Pro."""
    print("\n" + "="*60)
    print("AUTHAUDIT PRO — ENTERPRISE AUTH CONFIGURATION ANALYZER")
    print("="*60)
    print("Scope: Non-destructive configuration analysis only")
    print("No credential testing, no exploitation, no destructive actions\n")
    
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
    print("This tool performs NON-DESTRUCTIVE configuration analysis only:")
    print("  • No credential testing")
    print("  • No form submission")
    print("  • No account lockout risk")
    print("  • Observation of security headers and cookie settings only")
    
    confirm = input("\nType 'CONFIG-ANALYSIS-ONLY' to confirm: ").strip()
    if confirm != "CONFIG-ANALYSIS-ONLY":
        print(Fore.YELLOW + "[!] Permission not confirmed. Exiting.")
        return
    
    # Run scanner
    print(Fore.CYAN + f"\n[i] Initializing configuration analyzer...")
    
    scanner = AuthAuditPro(
        base_url=base,
        threads=threads
    )
    
    print(Fore.CYAN + f"[i] Analyzing {len(AUTH_ENDPOINTS) + len(SESSION_ENDPOINTS)} endpoints...")
    print(Fore.CYAN + f"[i] Using {threads} threads with {DELAY_BETWEEN_REQUESTS}s delays")
    
    raw_findings = scanner.run()
    
    print(Fore.CYAN + f"[i] Generating configuration analysis reports...")
    
    # Generate reports
    write_reports(client, base, raw_findings)
    
    # Summary
    print(Fore.GREEN + "\n" + "="*60)
    print(Fore.GREEN + "[✓] AUTHENTICATION CONFIGURATION ANALYSIS COMPLETE")
    print(Fore.GREEN + "="*60)
    
    # Count findings by severity
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in raw_findings:
        sev = f.get("severity", "INFO")
        if sev in severity_counts:
            severity_counts[sev] += 1
    
    print(Fore.CYAN + "\nConfiguration Observations Summary:")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        count = severity_counts[sev]
        if count > 0:
            color = Fore.RED if sev in ["CRITICAL", "HIGH"] else Fore.YELLOW if sev == "MEDIUM" else Fore.CYAN
            print(color + f"  {sev}: {count}")
    
    # Top recommendations
    print(Fore.CYAN + "\nCommon Configuration Recommendations:")
    all_recs = []
    for f in raw_findings:
        all_recs.extend(f.get("security_recommendations", []))
    
    unique_recs = list(set(all_recs))[:5]  # Top 5 unique recommendations
    for i, rec in enumerate(unique_recs, 1):
        print(Fore.WHITE + f"  {i}. {rec}")
    
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
        print(Fore.RED + f"\n[!] Analysis error: {e}")
        sys.exit(1)