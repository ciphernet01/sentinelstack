# ==========================================================
# SessionGuard Pro — Enterprise Edition
# Tool 22/30
# Complete Enhanced Implementation
# ==========================================================

import os
import re
import sys
import json
import csv
import math
import time
import random
import hashlib
import secrets
import threading
import statistics
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
OUTPUT_BASE = os.path.join("reports", "sessionguard_pro")
TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
JSON_DIR = os.path.join(OUTPUT_BASE, "json")
CSV_DIR = os.path.join(OUTPUT_BASE, "csv")

for d in (TXT_DIR, JSON_DIR, CSV_DIR):
    os.makedirs(d, exist_ok=True)

# ----------------------------------------------------------
# Defaults (enterprise-safe)
# ----------------------------------------------------------
REQUEST_TIMEOUT = 12
THREADS_DEFAULT = 6
DEFAULT_THREADS = 4
MAX_WORKERS = 8
DELAY_BETWEEN_REQUESTS = 0.5

# Session cookie patterns
SESSION_COOKIE_PATTERNS = [
    r'session', r'sess', r'auth', r'token', r'jwt', r'access',
    r'php.?sess', r'jsession', r'asp.?session', r'laravel',
    r'connect\.sid', r'sid', r'csrf', r'xsrf'
]

# Login endpoints
LOGIN_ENDPOINTS = [
    "/login", "/signin", "/auth", "/sign-in",
    "/api/login", "/api/auth/login", "/api/v1/auth",
    "/account/login", "/user/login", "/admin/login",
    "/wp-login.php", "/administrator/index.php"
]

# Session-related endpoints
SESSION_ENDPOINTS = [
    "/logout", "/signout", "/auth/logout", "/api/logout",
    "/session", "/api/session", "/profile", "/dashboard",
    "/account", "/user", "/admin", "/settings"
]

# Security headers for session protection
SESSION_SECURITY_HEADERS = [
    "Strict-Transport-Security",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Content-Security-Policy",
    "Referrer-Policy",
    "Permissions-Policy"
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
            "SessionGuard-Pro/1.0"
        ]),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

def safe_request(session, method, url, headers=None, cookies=None, data=None, allow_redirects=True):
    """Safe HTTP wrapper for session testing."""
    try:
        r = session.request(
            method=method,
            url=url,
            headers=headers or random_headers(),
            cookies=cookies,
            data=data,
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
            "url": r.url,
            "history": [resp.url for resp in r.history]
        }
    except Exception as e:
        return {"error": str(e)}

# ----------------------------------------------------------
# Canonical Finding Schema (LOCKED)
# ----------------------------------------------------------
def new_finding():
    """Canonical finding object for session security analysis."""
    return {
        "url": None,
        "path": None,
        "method": None,
        
        # Session Cookie Analysis
        "session_cookies_found": [],
        "cookie_attributes": {},
        "session_entropy_bits": None,
        "session_length": None,
        "session_pattern_analysis": {},
        
        # Session Flow Analysis
        "session_fixation_detected": False,
        "session_reuse_after_logout": False,
        "concurrent_sessions_allowed": False,
        "session_timeout_analysis": {},
        "session_regeneration_analysis": {},
        
        # Security Headers
        "security_headers_present": {},
        "security_headers_missing": [],
        
        # Session Management Issues
        "classification": [],
        "vulnerabilities": [],
        "best_practice_violations": [],
        
        # Scoring
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
    f.setdefault("session_cookies_found", [])
    f.setdefault("cookie_attributes", {})
    f.setdefault("session_entropy_bits", 0)  # Changed from None to 0
    f.setdefault("session_length", 0)
    f.setdefault("session_pattern_analysis", {})
    f.setdefault("session_fixation_detected", False)
    f.setdefault("session_reuse_after_logout", False)
    f.setdefault("concurrent_sessions_allowed", False)
    f.setdefault("session_timeout_analysis", {})
    f.setdefault("session_regeneration_analysis", {})
    f.setdefault("security_headers_present", {})
    f.setdefault("security_headers_missing", [])
    f.setdefault("classification", [])
    f.setdefault("vulnerabilities", [])
    f.setdefault("best_practice_violations", [])
    f.setdefault("score", 0)
    f.setdefault("severity", "INFO")
    return f

# ----------------------------------------------------------
# Session Analysis Engines
# ----------------------------------------------------------
class SessionCookieAnalyzer:
    """Analyze session cookies for security characteristics."""
    
    @staticmethod
    def is_session_cookie(cookie_name: str) -> bool:
        """Check if cookie appears to be a session cookie."""
        cookie_lower = cookie_name.lower()
        for pattern in SESSION_COOKIE_PATTERNS:
            if re.search(pattern, cookie_lower):
                return True
        return False
    
    @staticmethod
    def analyze_cookie_value(cookie_value: str):
        """Analyze cookie value for security characteristics."""
        analysis = {
            "length": len(cookie_value) if cookie_value else 0,
            "entropy_bits": 0,
            "character_distribution": {},
            "appears_random": False,
            "weak_patterns": []
        }
        
        # Calculate entropy
        if cookie_value and len(cookie_value) > 0:
            freq = {}
            for c in cookie_value:
                freq[c] = freq.get(c, 0) + 1
            
            entropy = 0.0
            for count in freq.values():
                p = count / len(cookie_value)
                entropy -= p * math.log2(p)
            
            analysis["entropy_bits"] = round(entropy * len(cookie_value), 2)
            analysis["character_distribution"] = dict(sorted(freq.items(), key=lambda x: x[1], reverse=True)[:10])
        
        # Check for weak patterns
        if cookie_value:
            # Check if appears to be numeric only
            if cookie_value.isdigit():
                analysis["weak_patterns"].append("numeric_only")
            
            # Check for short length
            if len(cookie_value) < 16:
                analysis["weak_patterns"].append("short_length")
            
            # Check for predictable patterns
            if cookie_value.startswith("test") or cookie_value.startswith("admin"):
                analysis["weak_patterns"].append("predictable_prefix")
            
            # Check for common weak values
            weak_values = ["test", "admin", "user", "123", "temp", "session"]
            if any(weak in cookie_value.lower() for weak in weak_values):
                analysis["weak_patterns"].append("common_weak_value")
        
        # Determine if appears random
        if analysis["entropy_bits"] > 60 and len(cookie_value) >= 32:
            analysis["appears_random"] = True
        
        return analysis
    
    @staticmethod
    def extract_cookie_attributes(headers: dict):
        """Extract security attributes from Set-Cookie headers."""
        cookie_attrs = {
            "http_only": False,
            "secure": False,
            "same_site": None,
            "max_age": None,
            "expires": None,
            "path": "/",
            "domain": None
        }
        
        # Check all Set-Cookie headers
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
                cookie_attrs["http_only"] = True
            if "secure" in cookie_lower:
                cookie_attrs["secure"] = True
            
            # Check SameSite
            if "samesite=" in cookie_lower:
                if "samesite=strict" in cookie_lower:
                    cookie_attrs["same_site"] = "Strict"
                elif "samesite=lax" in cookie_lower:
                    cookie_attrs["same_site"] = "Lax"
                elif "samesite=none" in cookie_lower:
                    cookie_attrs["same_site"] = "None"
            
            # Extract Max-Age
            max_age_match = re.search(r'max-age=(\d+)', cookie_lower)
            if max_age_match:
                cookie_attrs["max_age"] = int(max_age_match.group(1))
            
            # Extract Expires
            expires_match = re.search(r'expires=([^;]+)', cookie_lower, re.IGNORECASE)
            if expires_match:
                cookie_attrs["expires"] = expires_match.group(1).strip()
            
            # Extract Path
            path_match = re.search(r'path=([^;]+)', cookie_lower)
            if path_match:
                cookie_attrs["path"] = path_match.group(1).strip()
            
            # Extract Domain
            domain_match = re.search(r'domain=([^;]+)', cookie_lower)
            if domain_match:
                cookie_attrs["domain"] = domain_match.group(1).strip()
        
        return cookie_attrs

class SessionFlowAnalyzer:
    """Analyze session lifecycle and flow security."""
    
    def __init__(self, base_url, session):
        self.base = base_url.rstrip("/")
        self.session = session
        self.session_states = {}  # Track session states
    
    def test_session_fixation(self, login_url):
        """Test for session fixation vulnerability."""
        results = {
            "vulnerable": False,
            "pre_login_session": None,
            "post_login_session": None,
            "evidence": ""
        }
        
        # Step 1: Get initial session before login
        resp1 = safe_request(self.session, "GET", self.base)
        if not resp1 or "error" in resp1:
            return results
        
        cookies_before = resp1.get("cookies", {})
        session_cookies_before = [
            k for k in cookies_before.keys() 
            if SessionCookieAnalyzer.is_session_cookie(k)
        ]
        
        if not session_cookies_before:
            results["evidence"] = "No session cookie found before login"
            return results
        
        # Step 2: Attempt login (with test credentials - safe, non-destructive)
        test_creds = {"username": "testuser", "password": "testpass123"}
        resp2 = safe_request(
            self.session, "POST", login_url,
            data=test_creds,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if not resp2 or "error" in resp2:
            return results
        
        cookies_after = resp2.get("cookies", {})
        
        # Check if session cookies changed
        for cookie_name in session_cookies_before:
            if cookie_name in cookies_before and cookie_name in cookies_after:
                if cookies_before[cookie_name] == cookies_after[cookie_name]:
                    results["vulnerable"] = True
                    results["pre_login_session"] = cookies_before[cookie_name][:20] + "..."
                    results["post_login_session"] = cookies_after[cookie_name][:20] + "..."
                    results["evidence"] = f"Session cookie '{cookie_name}' unchanged after login"
                    break
        
        return results
    
    def test_logout_functionality(self, logout_url):
        """Test if logout properly invalidates sessions."""
        results = {
            "session_cleared": False,
            "session_persists": False,
            "evidence": ""
        }
        
        # First establish a session
        resp1 = safe_request(self.session, "GET", self.base)
        if not resp1 or "error" in resp1:
            return results
        
        cookies_before = resp1.get("cookies", {})
        session_cookies = [
            k for k in cookies_before.keys() 
            if SessionCookieAnalyzer.is_session_cookie(k)
        ]
        
        if not session_cookies:
            results["evidence"] = "No session cookie to test logout"
            return results
        
        # Call logout endpoint
        resp2 = safe_request(
            self.session, "GET", logout_url,
            cookies=cookies_before
        )
        
        if not resp2 or "error" in resp2:
            return results
        
        cookies_after = resp2.get("cookies", {})
        
        # Check if session was cleared
        session_cleared = True
        for cookie_name in session_cookies:
            if cookie_name in cookies_after:
                cookie_value = cookies_after[cookie_name]
                # Check if cookie was cleared (empty or expired)
                if cookie_value and cookie_value.strip():
                    # Check for Set-Cookie with expiry in past
                    headers = resp2.get("headers", {})
                    set_cookie = headers.get("Set-Cookie", "")
                    if f"{cookie_name}=" in set_cookie:
                        # Check if cookie is being set to expire
                        if "expires=" in set_cookie.lower():
                            # Parse expiry time (simplified)
                            results["session_cleared"] = True
                            results["evidence"] = "Session cookie properly expired"
                        else:
                            session_cleared = False
                    else:
                        session_cleared = False
        
        if not session_cleared:
            results["session_persists"] = True
            results["evidence"] = "Session cookie persists after logout"
        
        return results
    
    def test_concurrent_sessions(self, login_url):
        """Test if concurrent sessions are allowed."""
        results = {
            "concurrent_allowed": False,
            "evidence": ""
        }
        
        # Create two separate sessions
        session1 = requests.Session()
        session2 = requests.Session()
        
        # Try to login with both sessions (safe test credentials)
        test_creds = {"username": "testuser", "password": "testpass123"}
        
        resp1 = safe_request(
            session1, "POST", login_url,
            data=test_creds,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        resp2 = safe_request(
            session2, "POST", login_url,
            data=test_creds,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        # Check if both got session cookies
        if resp1 and resp2 and "error" not in resp1 and "error" not in resp2:
            cookies1 = resp1.get("cookies", {})
            cookies2 = resp2.get("cookies", {})
            
            session_cookies1 = [
                k for k in cookies1.keys() 
                if SessionCookieAnalyzer.is_session_cookie(k) and cookies1[k]
            ]
            session_cookies2 = [
                k for k in cookies2.keys() 
                if SessionCookieAnalyzer.is_session_cookie(k) and cookies2[k]
            ]
            
            if session_cookies1 and session_cookies2:
                results["concurrent_allowed"] = True
                results["evidence"] = f"Multiple sessions created: {len(session_cookies1)} + {len(session_cookies2)} cookies"
        
        return results
    
    def analyze_session_timeout(self, protected_url, delay_seconds=5):
        """Analyze session timeout behavior."""
        results = {
            "timeout_seconds": None,
            "session_expires": False,
            "evidence": ""
        }
        
        # First get a session
        resp1 = safe_request(self.session, "GET", self.base)
        if not resp1 or "error" in resp1:
            return results
        
        cookies = resp1.get("cookies", {})
        session_cookies = [
            k for k in cookies.keys() 
            if SessionCookieAnalyzer.is_session_cookie(k)
        ]
        
        if not session_cookies:
            return results
        
        # Wait specified delay
        time.sleep(delay_seconds)
        
        # Try to access protected endpoint
        resp2 = safe_request(
            self.session, "GET", protected_url,
            cookies=cookies
        )
        
        if not resp2 or "error" in resp2:
            return results
        
        # Check if session still valid
        if resp2.get("status", 0) in [200, 201, 302]:
            results["session_expires"] = False
            results["evidence"] = f"Session still valid after {delay_seconds}s"
        elif resp2.get("status", 0) in [401, 403]:
            results["session_expires"] = True
            results["evidence"] = f"Session expired after {delay_seconds}s"
        
        return results

class SecurityHeaderAnalyzer:
    """Analyze security headers for session protection."""
    
    @staticmethod
    def analyze_security_headers(headers: dict):
        """Analyze security headers for session protection."""
        analysis = {
            "headers_present": {},
            "headers_missing": [],
            "recommendations": []
        }
        
        for header in SESSION_SECURITY_HEADERS:
            if header in headers:
                analysis["headers_present"][header] = headers[header]
                
                # Validate header values
                if header == "Strict-Transport-Security":
                    if "max-age" not in headers[header].lower():
                        analysis["recommendations"].append(f"{header}: Add max-age directive")
                
                elif header == "X-Frame-Options":
                    value = headers[header].lower()
                    if value not in ["deny", "sameorigin"]:
                        analysis["recommendations"].append(f"{header}: Use 'DENY' or 'SAMEORIGIN'")
                
                elif header == "X-Content-Type-Options":
                    if headers[header].lower() != "nosniff":
                        analysis["recommendations"].append(f"{header}: Should be 'nosniff'")
            
            else:
                analysis["headers_missing"].append(header)
                analysis["recommendations"].append(f"Add {header} security header")
        
        return analysis

# ----------------------------------------------------------
# Main Scanner Class
# ----------------------------------------------------------
class SessionGuardPro:
    """Enterprise Session Security Analyzer."""
    
    def __init__(self, base_url, threads=None):
        self.base = base_url.rstrip("/")
        self.threads = min(threads or DEFAULT_THREADS, MAX_WORKERS)
        
        # Initialize analyzers
        self.cookie_analyzer = SessionCookieAnalyzer()
        self.flow_analyzer = None
        self.header_analyzer = SecurityHeaderAnalyzer()
        
        # Create session
        self.session = requests.Session()
        self.session.headers.update(random_headers())
        
        # Results
        self.findings = []
        
        # Thread pool
        self.task_queue = Queue()
        self.results_queue = Queue()
        self.workers = []
    
    def build_url(self, path):
        """Build full URL from path."""
        return urljoin(self.base + "/", path.lstrip("/"))
    
    def _worker(self):
        """Worker thread for session analysis."""
        while True:
            try:
                task = self.task_queue.get(timeout=2)
                if task is None:
                    break
                
                task_type = task.get("type")
                
                if task_type == "cookie_analysis":
                    result = self._analyze_cookies(task["url"])
                elif task_type == "session_flow":
                    result = self._analyze_session_flow(
                        task["login_url"],
                        task.get("logout_url")
                    )
                elif task_type == "security_headers":
                    result = self._analyze_security_headers(task["url"])
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
    
    def _analyze_cookies(self, url):
        """Analyze cookies from endpoint."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "GET"
        
        resp = safe_request(self.session, "GET", url)
        
        if not resp or "error" in resp:
            finding["classification"].append("endpoint_unreachable")
            finding["score"] = 5
            return finding
        
        # Analyze cookies
        cookies = resp.get("cookies", {})
        headers = resp.get("headers", {})
        
        # Find session cookies
        session_cookies = []
        cookie_analysis = {}
        
        for cookie_name, cookie_value in cookies.items():
            if self.cookie_analyzer.is_session_cookie(cookie_name):
                session_cookies.append(cookie_name)
                
                # Analyze cookie value
                analysis = self.cookie_analyzer.analyze_cookie_value(cookie_value)
                cookie_analysis[cookie_name] = analysis
                
                # Check for weak patterns
                if analysis["weak_patterns"]:
                    for pattern in analysis["weak_patterns"]:
                        finding["vulnerabilities"].append(f"{cookie_name}_{pattern}")
        
        finding["session_cookies_found"] = session_cookies
        
        if session_cookies:
            # Analyze cookie attributes
            cookie_attrs = self.cookie_analyzer.extract_cookie_attributes(headers)
            finding["cookie_attributes"] = cookie_attrs
            
            # Check for missing security attributes
            missing_attrs = []
            if not cookie_attrs["http_only"]:
                missing_attrs.append("HttpOnly")
            if not cookie_attrs["secure"]:
                missing_attrs.append("Secure")
            if not cookie_attrs["same_site"]:
                missing_attrs.append("SameSite")
            
            if missing_attrs:
                finding["best_practice_violations"].extend(
                    [f"missing_{attr.lower()}" for attr in missing_attrs]
                )
            
            # Calculate average entropy
            entropies = []
            for name in session_cookies:
                analysis = cookie_analysis.get(name, {})
                entropy = analysis.get("entropy_bits", 0)
                if entropy is not None:
                    entropies.append(entropy)
            
            if entropies:
                finding["session_entropy_bits"] = round(statistics.mean(entropies), 2)
                
                if finding["session_entropy_bits"] < 60:
                    finding["vulnerabilities"].append("low_session_entropy")
            
            finding["session_pattern_analysis"] = cookie_analysis
            finding["classification"].append("session_cookies_detected")
            finding["score"] = 30
        
        else:
            finding["classification"].append("no_session_cookies")
            finding["score"] = 10
        
        finding["severity"] = score_to_severity(finding["score"])
        return finding
    
    def _analyze_session_flow(self, login_url, logout_url=None):
        """Analyze session flow and lifecycle."""
        finding = new_finding()
        finding["url"] = login_url
        finding["path"] = urlparse(login_url).path
        finding["method"] = "POST"
        
        # Initialize flow analyzer with fresh session
        flow_session = requests.Session()
        flow_session.headers.update(random_headers())
        flow_analyzer = SessionFlowAnalyzer(self.base, flow_session)
        
        # Test session fixation
        fixation_results = flow_analyzer.test_session_fixation(login_url)
        if fixation_results["vulnerable"]:
            finding["session_fixation_detected"] = True
            finding["vulnerabilities"].append("session_fixation")
            finding["classification"].append("session_fixation_vulnerability")
        
        # Test logout functionality if URL provided
        if logout_url:
            logout_results = flow_analyzer.test_logout_functionality(logout_url)
            if logout_results["session_persists"]:
                finding["session_reuse_after_logout"] = True
                finding["vulnerabilities"].append("logout_doesnt_clear_session")
                finding["classification"].append("incomplete_logout_implementation")
        
        # Test concurrent sessions
        concurrent_results = flow_analyzer.test_concurrent_sessions(login_url)
        if concurrent_results["concurrent_allowed"]:
            finding["concurrent_sessions_allowed"] = True
            finding["vulnerabilities"].append("concurrent_sessions_allowed")
            finding["classification"].append("concurrent_session_vulnerability")
        
        # Analyze session timeout
        timeout_results = flow_analyzer.analyze_session_timeout(self.base)
        finding["session_timeout_analysis"] = timeout_results
        
        # Score based on findings
        score = self._score_session_flow(finding)
        finding["score"] = score
        finding["severity"] = score_to_severity(score)
        
        return finding
    
    def _analyze_security_headers(self, url):
        """Analyze security headers on endpoint."""
        finding = new_finding()
        finding["url"] = url
        finding["path"] = urlparse(url).path
        finding["method"] = "GET"
        
        resp = safe_request(self.session, "GET", url)
        
        if not resp or "error" in resp:
            finding["classification"].append("endpoint_unreachable")
            finding["score"] = 5
            return finding
        
        headers = resp.get("headers", {})
        
        # Analyze security headers
        header_analysis = self.header_analyzer.analyze_security_headers(headers)
        
        finding["security_headers_present"] = header_analysis["headers_present"]
        finding["security_headers_missing"] = header_analysis["headers_missing"]
        
        # Add recommendations as classification
        for rec in header_analysis["recommendations"]:
            finding["best_practice_violations"].append(rec.replace(" ", "_").lower())
        
        # Score based on missing headers
        missing_count = len(header_analysis["headers_missing"])
        score = max(0, 100 - (missing_count * 15))
        
        if missing_count > 3:
            finding["classification"].append("inadequate_security_headers")
        elif missing_count > 0:
            finding["classification"].append("partial_security_headers")
        else:
            finding["classification"].append("comprehensive_security_headers")
        
        finding["score"] = score
        finding["severity"] = score_to_severity(score)
        
        return finding
    
    def _score_session_flow(self, finding):
        """Score session flow analysis."""
        score = 50  # Neutral starting point
        
        # Deduct for vulnerabilities
        vulnerabilities = finding.get("vulnerabilities", [])
        for vuln in vulnerabilities:
            if "session_fixation" in vuln:
                score -= 30
            elif "logout_doesnt_clear_session" in vuln:
                score -= 25
            elif "concurrent_sessions_allowed" in vuln:
                score -= 20
            elif "low_session_entropy" in vuln:
                score -= 15
        
        # Add for security measures
        classification = finding.get("classification", [])
        if "comprehensive_security_headers" in classification:
            score += 20
        
        # Ensure score is in bounds
        return max(0, min(100, score))
    
    def run(self, login_endpoints=None, session_endpoints=None):
        """Execute comprehensive session security analysis."""
        print(Fore.CYAN + f"[i] Starting SessionGuard Pro on {self.base}")
        print(Fore.CYAN + f"[i] Scope: Comprehensive session security analysis")
        
        # Build endpoint lists
        login_urls = [self.build_url(ep) for ep in (login_endpoints or LOGIN_ENDPOINTS)]
        session_urls = [self.build_url(ep) for ep in (session_endpoints or SESSION_ENDPOINTS)]
        
        # Find matching logout URLs
        logout_pairs = []
        for login_url in login_urls:
            # Try to find corresponding logout URL
            login_base = login_url.rsplit("/", 1)[0] if "/" in login_url else login_url
            logout_candidates = [
                url for url in session_urls 
                if "logout" in url.lower() and url.startswith(login_base)
            ]
            logout_url = logout_candidates[0] if logout_candidates else None
            logout_pairs.append((login_url, logout_url))
        
        # Start worker threads
        for _ in range(self.threads):
            worker = threading.Thread(target=self._worker)
            worker.daemon = True
            worker.start()
            self.workers.append(worker)
        
        # Queue analysis tasks
        # 1. Cookie analysis on home page
        self.task_queue.put({
            "type": "cookie_analysis",
            "url": self.base
        })
        
        # 2. Cookie analysis on login pages
        for login_url in login_urls[:3]:  # Limit to 3 login pages
            self.task_queue.put({
                "type": "cookie_analysis",
                "url": login_url
            })
        
        # 3. Session flow analysis
        for login_url, logout_url in logout_pairs[:2]:  # Limit to 2 login/logout pairs
            self.task_queue.put({
                "type": "session_flow",
                "login_url": login_url,
                "logout_url": logout_url
            })
        
        # 4. Security headers analysis
        for url in [self.base] + login_urls[:2]:
            self.task_queue.put({
                "type": "security_headers",
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
        
        # Summary statistics
        session_cookies = sum(len(f.get("session_cookies_found", [])) for f in all_findings)
        fixation_issues = sum(1 for f in all_findings if f.get("session_fixation_detected"))
        logout_issues = sum(1 for f in all_findings if f.get("session_reuse_after_logout"))
        
        print(Fore.CYAN + f"[i] Analysis complete.")
        print(Fore.CYAN + f"[i] Session cookies found: {session_cookies}")
        print(Fore.CYAN + f"[i] Fixation vulnerabilities: {fixation_issues}")
        print(Fore.CYAN + f"[i] Logout issues: {logout_issues}")
        
        return self.findings

# ----------------------------------------------------------
# Reporting Engine
# ----------------------------------------------------------
def write_reports(client: str, base: str, findings: list):
    """Generate session security analysis reports."""
    ts = now_ts()
    safe_client = re.sub(r"[^A-Za-z0-9_-]", "_", client)[:25]
    host = urlparse(base).hostname or "target"
    basefn = f"{safe_client}_sessionguard_{host}_{ts}"
    
    txt_path = os.path.join(TXT_DIR, basefn + ".txt")
    json_path = os.path.join(JSON_DIR, basefn + ".json")
    csv_path = os.path.join(CSV_DIR, basefn + ".csv")
    
    normalized = [normalize_finding(f) for f in findings]
    
    # TXT REPORT
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== SESSIONGUARD PRO — COMPREHENSIVE SESSION SECURITY ANALYSIS ===\n\n")
        tf.write(f"Client: {client}\n")
        tf.write(f"Target: {base}\n")
        tf.write(f"Generated: {datetime.utcnow()}\n")
        tf.write(f"Scope: Session cookie analysis, flow security, and header validation\n\n")
        tf.write(f"Total Findings: {len(normalized)}\n\n")
        
        # Summary statistics
        session_cookies = sum(len(f.get("session_cookies_found", [])) for f in normalized)
        fixation_issues = sum(1 for f in normalized if f.get("session_fixation_detected"))
        logout_issues = sum(1 for f in normalized if f.get("session_reuse_after_logout"))
        concurrent_issues = sum(1 for f in normalized if f.get("concurrent_sessions_allowed"))
        
        tf.write("Analysis Summary:\n")
        tf.write(f"  Session Cookies Found: {session_cookies}\n")
        tf.write(f"  Session Fixation Issues: {fixation_issues}\n")
        tf.write(f"  Logout Implementation Issues: {logout_issues}\n")
        tf.write(f"  Concurrent Session Issues: {concurrent_issues}\n\n")
        
        # Detailed findings
        tf.write("DETAILED FINDINGS:\n")
        tf.write("=" * 60 + "\n\n")
        
        for f in sorted(normalized, key=lambda x: x["score"], reverse=True):
            if f["score"] < 20:
                continue  # Skip low relevance findings
            
            tf.write(f"URL: {f['url']}\n")
            tf.write(f"Path: {f['path']}\n")
            tf.write(f"Severity: {f['severity']} (Score: {f['score']})\n")
            
            # Session cookies
            session_cookies = f.get("session_cookies_found", [])
            if session_cookies:
                tf.write(f"Session Cookies: {', '.join(session_cookies)}\n")
            
            # Cookie security attributes
            cookie_attrs = f.get("cookie_attributes", {})
            if cookie_attrs:
                tf.write("Cookie Security:\n")
                tf.write(f"  HttpOnly: {cookie_attrs.get('http_only', False)}\n")
                tf.write(f"  Secure: {cookie_attrs.get('secure', False)}\n")
                tf.write(f"  SameSite: {cookie_attrs.get('same_site', 'Not Set')}\n")
                if cookie_attrs.get('max_age'):
                    tf.write(f"  Max-Age: {cookie_attrs['max_age']} seconds\n")
            
            # Session entropy
            entropy = f.get("session_entropy_bits")
            if entropy and entropy > 0:
                tf.write(f"Session Entropy: {entropy} bits\n")
                if entropy < 60:
                    tf.write("  ⚠️  Low entropy - session may be predictable\n")
            
            # Vulnerabilities
            vulnerabilities = f.get("vulnerabilities", [])
            if vulnerabilities:
                tf.write(f"Vulnerabilities: {', '.join(vulnerabilities)}\n")
            
            # Security headers
            missing_headers = f.get("security_headers_missing", [])
            if missing_headers:
                tf.write(f"Missing Security Headers: {', '.join(missing_headers)}\n")
            
            # Flow analysis results
            if f.get("session_fixation_detected"):
                tf.write("⚠️  SESSION FIXATION VULNERABILITY DETECTED\n")
            if f.get("session_reuse_after_logout"):
                tf.write("⚠️  Session persists after logout\n")
            if f.get("concurrent_sessions_allowed"):
                tf.write("⚠️  Concurrent sessions allowed\n")
            
            # Recommendations
            best_practices = f.get("best_practice_violations", [])
            if best_practices:
                tf.write("Recommendations:\n")
                for bp in best_practices[:3]:  # Limit to 3
                    tf.write(f"  • {bp.replace('_', ' ').title()}\n")
            
            tf.write("\n" + "-" * 40 + "\n\n")
    
    # JSON REPORT
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(
            sanitize({
                "tool": "SessionGuard Pro",
                "version": "1.0",
                "client": client,
                "target": base,
                "scan_type": "session_security_analysis",
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
            "severity", "score", "url", "session_cookies",
            "http_only", "secure", "same_site", "entropy_bits",
            "fixation_detected", "logout_issues", "concurrent_sessions",
            "missing_headers", "vulnerabilities"
        ])
        
        for f in normalized:
            if f["score"] < 20:
                continue
            
            cookie_attrs = f.get("cookie_attributes", {})
            session_cookies = f.get("session_cookies_found", [])
            missing_headers = f.get("security_headers_missing", [])
            vulnerabilities = f.get("vulnerabilities", [])
            entropy = f.get("session_entropy_bits", 0) or 0  # Ensure numeric value
            
            writer.writerow([
                f["severity"],
                f["score"],
                f["url"],
                ";".join(session_cookies),
                cookie_attrs.get("http_only", False),
                cookie_attrs.get("secure", False),
                cookie_attrs.get("same_site", ""),
                entropy,
                f.get("session_fixation_detected", False),
                f.get("session_reuse_after_logout", False),
                f.get("concurrent_sessions_allowed", False),
                ";".join(missing_headers),
                ";".join(vulnerabilities[:3])  # Limit to 3
            ])
    
    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")
    
    return txt_path, json_path, csv_path

# ----------------------------------------------------------
# CLI Interface
# ----------------------------------------------------------
def main():
    """Command-line interface for SessionGuard Pro."""
    print("\n" + "="*60)
    print("SESSIONGUARD PRO — ENTERPRISE SESSION SECURITY ANALYZER")
    print("="*60)
    print("Scope: Comprehensive session security analysis")
    print("Includes: Cookie analysis, flow security, header validation\n")
    
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
    print("This tool performs SAFE session analysis only:")
    print("  • No credential brute forcing")
    print("  • No destructive actions")
    print("  • Safe test credentials used (non-invasive)")
    print("  • Only observes session behavior")
    
    confirm = input("\nType 'SESSION-TESTING-ONLY' to confirm: ").strip()
    if confirm != "SESSION-TESTING-ONLY":
        print(Fore.YELLOW + "[!] Permission not confirmed. Exiting.")
        return
    
    # Run scanner
    print(Fore.CYAN + f"\n[i] Initializing session security analyzer...")
    
    scanner = SessionGuardPro(
        base_url=base,
        threads=threads
    )
    
    print(Fore.CYAN + f"[i] Analyzing session endpoints...")
    print(Fore.CYAN + f"[i] Using {threads} threads with {DELAY_BETWEEN_REQUESTS}s delays")
    
    raw_findings = scanner.run()
    
    print(Fore.CYAN + f"[i] Generating session security reports...")
    
    # Generate reports
    write_reports(client, base, raw_findings)
    
    # Summary
    print(Fore.GREEN + "\n" + "="*60)
    print(Fore.GREEN + "[✓] SESSION SECURITY ANALYSIS COMPLETE")
    print(Fore.GREEN + "="*60)
    
    # Count by severity
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in raw_findings:
        sev = f.get("severity", "INFO")
        if sev in severity_counts:
            severity_counts[sev] += 1
    
    print(Fore.CYAN + "\nSession Risk Summary:")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        count = severity_counts[sev]
        if count > 0:
            color = Fore.RED if sev in ["CRITICAL", "HIGH"] else Fore.YELLOW if sev == "MEDIUM" else Fore.CYAN
            print(color + f"  {sev}: {count}")
    
    # Common issues - FIXED: Handle None values properly
    fixation_issues = sum(1 for f in raw_findings if f.get("session_fixation_detected"))
    logout_issues = sum(1 for f in raw_findings if f.get("session_reuse_after_logout"))
    low_entropy = sum(1 for f in raw_findings if (f.get("session_entropy_bits") or 100) < 60)  # FIXED LINE
    
    if fixation_issues > 0:
        print(Fore.RED + f"\n  Session Fixation Vulnerabilities: {fixation_issues}")
    if logout_issues > 0:
        print(Fore.YELLOW + f"  Logout Implementation Issues: {logout_issues}")
    if low_entropy > 0:
        print(Fore.YELLOW + f"  Low Entropy Sessions: {low_entropy}")
    
    # Security headers summary
    missing_headers_total = sum(len(f.get("security_headers_missing", [])) for f in raw_findings)
    if missing_headers_total > 0:
        print(Fore.CYAN + f"  Missing Security Headers: {missing_headers_total}")
    
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