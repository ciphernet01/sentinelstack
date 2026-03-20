# ==========================================================
# TokenLifecycle Pro — Enhanced Enterprise Edition
# Tool 23/30
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
import hmac

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
OUTPUT_BASE = os.path.join("reports", "tokenlifecycle_pro")
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

# Token endpoints
TOKEN_ENDPOINTS = [
    "/oauth/token",
    "/api/auth/token",
    "/connect/token",
    "/token",
    "/api/token",
    "/auth/token",
    "/oauth2/token",
    "/api/oauth/token"
]

# Refresh endpoints
REFRESH_ENDPOINTS = [
    "/oauth/refresh",
    "/api/auth/refresh",
    "/token/refresh",
    "/api/token/refresh",
    "/refresh"
]

# Logout endpoints
LOGOUT_ENDPOINTS = [
    "/logout",
    "/api/logout",
    "/auth/logout",
    "/oauth/logout",
    "/api/auth/logout"
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

# Lifetime thresholds (seconds)
LIFETIME_THRESHOLDS = {
    "SHORT": 300,      # 5 minutes
    "MEDIUM": 3600,    # 1 hour
    "LONG": 86400,     # 24 hours
    "EXCESSIVE": 604800  # 7 days
}

# Clock skew tolerance (seconds)
CLOCK_SKEW_TOLERANCE = 300  # 5 minutes

# ----------------------------------------------------------
# Utilities
# ----------------------------------------------------------
def now_ts(fmt="%Y-%m%d_%H-%M-%S"):
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
            "TokenLifecycle-Pro/1.0"
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

def safe_request(session, method, url, headers=None, cookies=None, data=None, allow_redirects=False):
    """Safe HTTP wrapper for token lifecycle testing."""
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
            "content": r.content,
            "time": r.elapsed.total_seconds(),
            "url": r.url
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
    """Canonical finding object for token lifecycle analysis."""
    return {
        "url": None,
        "path": None,
        "method": None,
        
        # Token Information
        "token_type": None,  # access, refresh, id
        "token_lifetime_seconds": None,
        "token_claims": {},
        "token_algorithm": None,
        
        # Lifetime Analysis
        "missing_exp": False,
        "missing_iat": False,
        "missing_nbf": False,
        "excessive_lifetime": False,
        "clock_skew_issues": [],
        
        # Refresh Token Analysis
        "refresh_token_present": False,
        "refresh_token_reuse": False,
        "refresh_token_rotation": False,
        "refresh_token_exposed": False,
        
        # Reuse & Revocation
        "token_reuse_after_logout": False,
        "token_valid_after_logout": False,
        "refresh_token_valid_after_logout": False,
        "concurrent_use_allowed": False,
        
        # Security Analysis
        "classification": [],
        "vulnerabilities": [],
        "recommendations": [],
        
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
    f.setdefault("token_type", None)
    f.setdefault("token_lifetime_seconds", 0)
    f.setdefault("token_claims", {})
    f.setdefault("token_algorithm", None)
    f.setdefault("missing_exp", False)
    f.setdefault("missing_iat", False)
    f.setdefault("missing_nbf", False)
    f.setdefault("excessive_lifetime", False)
    f.setdefault("clock_skew_issues", [])
    f.setdefault("refresh_token_present", False)
    f.setdefault("refresh_token_reuse", False)
    f.setdefault("refresh_token_rotation", False)
    f.setdefault("refresh_token_exposed", False)
    f.setdefault("token_reuse_after_logout", False)
    f.setdefault("token_valid_after_logout", False)
    f.setdefault("refresh_token_valid_after_logout", False)
    f.setdefault("concurrent_use_allowed", False)
    f.setdefault("classification", [])
    f.setdefault("vulnerabilities", [])
    f.setdefault("recommendations", [])
    f.setdefault("score", 0)
    f.setdefault("severity", "INFO")
    return f

# ----------------------------------------------------------
# Token Analysis Engines
# ----------------------------------------------------------
class TokenAnalyzer:
    """Analyze token structure and lifetime."""
    
    @staticmethod
    def decode_jwt(token: str):
        """Decode JWT without verification."""
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        try:
            header = json.loads(b64url_decode(parts[0]))
            payload = json.loads(b64url_decode(parts[1]))
            return {
                "header": header,
                "payload": payload,
                "algorithm": header.get("alg"),
                "type": header.get("typ")
            }
        except Exception:
            return None
    
    @staticmethod
    def analyze_lifetime(payload: dict):
        """Analyze token lifetime and clock claims."""
        now = int(time.time())
        analysis = {
            "has_exp": "exp" in payload,
            "has_iat": "iat" in payload,
            "has_nbf": "nbf" in payload,
            "lifetime_seconds": None,
            "clock_skew_issues": [],
            "missing_claims": [],
            "excessive_lifetime": False
        }
        
        # Check missing claims
        if not analysis["has_exp"]:
            analysis["missing_claims"].append("exp")
        if not analysis["has_iat"]:
            analysis["missing_claims"].append("iat")
        
        # Calculate lifetime if possible
        if analysis["has_exp"] and analysis["has_iat"]:
            lifetime = payload["exp"] - payload["iat"]
            analysis["lifetime_seconds"] = lifetime
            
            # Check for excessive lifetime
            if lifetime > LIFETIME_THRESHOLDS["EXCESSIVE"]:
                analysis["excessive_lifetime"] = True
            elif lifetime > LIFETIME_THRESHOLDS["LONG"]:
                analysis["excessive_lifetime"] = True
        
        # Check clock skew issues
        if analysis["has_nbf"]:
            nbf = payload["nbf"]
            if nbf > now + CLOCK_SKEW_TOLERANCE:
                analysis["clock_skew_issues"].append("future_nbf")
        
        if analysis["has_iat"]:
            iat = payload["iat"]
            if iat > now + CLOCK_SKEW_TOLERANCE:
                analysis["clock_skew_issues"].append("future_iat")
        
        return analysis
    
    @staticmethod
    def extract_tokens_from_response(response):
        """Extract tokens from HTTP response."""
        tokens = {
            "access_token": None,
            "refresh_token": None,
            "id_token": None,
            "token_type": None
        }
        
        if not response or "content" not in response:
            return tokens
        
        content = response["content"]
        if not content:
            return tokens
        
        try:
            # Try to parse as JSON
            body = json.loads(content.decode('utf-8', errors='ignore'))
            
            # Look for standard token fields
            if "access_token" in body:
                tokens["access_token"] = body["access_token"]
            if "refresh_token" in body:
                tokens["refresh_token"] = body["refresh_token"]
            if "id_token" in body:
                tokens["id_token"] = body["id_token"]
            if "token_type" in body:
                tokens["token_type"] = body["token_type"]
            
            # Look for non-standard fields
            for key in body.keys():
                if "token" in key.lower() and key not in tokens:
                    # Try to guess token type
                    if "refresh" in key.lower():
                        tokens["refresh_token"] = body[key]
                    elif "access" in key.lower():
                        tokens["access_token"] = body[key]
                    elif "id" in key.lower():
                        tokens["id_token"] = body[key]
        
        except:
            # Try regex pattern matching
            body_str = content.decode('utf-8', errors='ignore')
            jwt_matches = JWT_REGEX.findall(body_str)
            if jwt_matches:
                tokens["access_token"] = jwt_matches[0]
        
        return tokens

class RefreshTokenAnalyzer:
    """Analyze refresh token behavior and security."""
    
    def __init__(self, session):
        self.session = session
        self.refresh_tokens_tested = set()
    
    def test_refresh_token_reuse(self, refresh_url, refresh_token, access_token=None):
        """Test if refresh token can be reused multiple times."""
        results = {
            "reuse_allowed": False,
            "attempts_successful": 0,
            "attempts_total": 3,
            "evidence": ""
        }
        
        if not refresh_token:
            return results
        
        # Prepare refresh request
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        
        if access_token:
            data["access_token"] = access_token
        
        successful_attempts = 0
        
        for i in range(results["attempts_total"]):
            resp = safe_request(
                self.session,
                "POST",
                refresh_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if resp and "error" not in resp:
                status = resp.get("status", 0)
                if status in [200, 201]:
                    successful_attempts += 1
                    
                    # Extract new tokens from response
                    new_tokens = TokenAnalyzer.extract_tokens_from_response(resp)
                    if new_tokens.get("refresh_token"):
                        # Update refresh token for next attempt
                        data["refresh_token"] = new_tokens["refresh_token"]
            
            time.sleep(1)  # Be respectful
        
        results["attempts_successful"] = successful_attempts
        results["reuse_allowed"] = successful_attempts > 1
        
        if results["reuse_allowed"]:
            results["evidence"] = f"Refresh token reused {successful_attempts} times successfully"
        else:
            results["evidence"] = f"Refresh token rotation enforced"
        
        return results
    
    def test_refresh_token_exposure(self, protected_url, access_token):
        """Test if refresh token is exposed in client-side responses."""
        results = {
            "exposed_in_response": False,
            "exposed_in_cookies": False,
            "exposed_in_headers": False,
            "evidence": ""
        }
        
        if not access_token:
            return results
        
        # Make request to protected endpoint
        headers = random_headers({
            "Authorization": f"Bearer {access_token}"
        })
        
        resp = safe_request(self.session, "GET", protected_url, headers=headers)
        
        if not resp or "error" in resp:
            return results
        
        # Check response body for refresh tokens
        content = resp.get("content", b"")
        if content:
            try:
                body_str = content.decode('utf-8', errors='ignore')
                if "refresh_token" in body_str.lower():
                    # Look for JWT patterns
                    jwt_matches = JWT_REGEX.findall(body_str)
                    if jwt_matches and len(jwt_matches) > 1:
                        results["exposed_in_response"] = True
                        results["evidence"] = "Refresh token found in response body"
            except:
                pass
        
        # Check cookies for refresh tokens
        cookies = resp.get("cookies", {})
        for cookie_name in cookies.keys():
            if "refresh" in cookie_name.lower():
                results["exposed_in_cookies"] = True
                results["evidence"] = f"Refresh token in cookie: {cookie_name}"
                break
        
        return results

class TokenRevocationAnalyzer:
    """Analyze token revocation and logout behavior."""
    
    def __init__(self, session):
        self.session = session
    
    def test_token_after_logout(self, logout_url, protected_url, access_token, refresh_token=None):
        """Test if tokens remain valid after logout."""
        results = {
            "access_token_valid_after_logout": False,
            "refresh_token_valid_after_logout": False,
            "evidence": ""
        }
        
        if not access_token:
            return results
        
        # First, verify token is valid before logout
        headers = random_headers({
            "Authorization": f"Bearer {access_token}"
        })
        
        resp1 = safe_request(self.session, "GET", protected_url, headers=headers)
        valid_before = resp1 and resp1.get("status", 0) in [200, 201, 204]
        
        if not valid_before:
            results["evidence"] = "Token invalid before logout test"
            return results
        
        # Call logout endpoint
        logout_resp = safe_request(
            self.session,
            "POST" if "logout" in logout_url.lower() else "GET",
            logout_url,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        time.sleep(2)  # Allow server to process logout
        
        # Test if access token still works
        resp2 = safe_request(self.session, "GET", protected_url, headers=headers)
        valid_after = resp2 and resp2.get("status", 0) in [200, 201, 204]
        
        results["access_token_valid_after_logout"] = valid_after
        
        if valid_after:
            results["evidence"] = "Access token still valid after logout"
        else:
            results["evidence"] = "Access token properly invalidated after logout"
        
        # Test refresh token if provided
        if refresh_token:
            # Try to use refresh token after logout
            refresh_data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token
            }
            
            refresh_resp = safe_request(
                self.session,
                "POST",
                "/oauth/token",  # Try common refresh endpoint
                data=refresh_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if refresh_resp and refresh_resp.get("status", 0) in [200, 201]:
                results["refresh_token_valid_after_logout"] = True
                results["evidence"] += " | Refresh token still valid after logout"
        
        return results
    
    def test_concurrent_token_use(self, protected_url, access_token):
        """Test if token can be used concurrently from different sessions."""
        results = {
            "concurrent_use_allowed": False,
            "evidence": ""
        }
        
        if not access_token:
            return results
        
        # Create two separate sessions
        session1 = requests.Session()
        session2 = requests.Session()
        
        # Make concurrent requests
        headers1 = random_headers({
            "Authorization": f"Bearer {access_token}"
        })
        headers2 = random_headers({
            "Authorization": f"Bearer {access_token}"
        })
        
        # Make requests close in time
        resp1 = safe_request(session1, "GET", protected_url, headers=headers1)
        resp2 = safe_request(session2, "GET", protected_url, headers=headers2)
        
        valid1 = resp1 and resp1.get("status", 0) in [200, 201, 204]
        valid2 = resp2 and resp2.get("status", 0) in [200, 201, 204]
        
        results["concurrent_use_allowed"] = valid1 and valid2
        
        if results["concurrent_use_allowed"]:
            results["evidence"] = "Token accepted concurrently from different sessions"
        else:
            results["evidence"] = "Token use appears to be serialized"
        
        return results

# ----------------------------------------------------------
# Enhanced Detectors
# ----------------------------------------------------------
class AdvancedTokenDetector:
    """Advanced token security vulnerability detection."""
    
    @staticmethod
    def detect_none_algorithm(header):
        """Detect 'none' algorithm vulnerability."""
        alg = header.get('alg', '').upper()
        if alg == 'NONE' or 'NONE' in str(alg):
            return "JWT_NONE_ALGORITHM_VULNERABILITY"
        return None
    
    @staticmethod
    def detect_weak_signature(header):
        """Detect weak JWT signing algorithms."""
        weak_algorithms = ['HS256', 'HS384', 'HS512']  # HMAC with weak key
        alg = header.get('alg', '')
        
        if alg in weak_algorithms:
            return f"POTENTIALLY_WEAK_{alg}_SIGNATURE"
        return None
    
    @staticmethod
    def detect_embedded_secrets(payload):
        """Detect secrets embedded in JWT payload."""
        suspicious_keys = ['secret', 'password', 'key', 'private']
        for key in payload.keys():
            if any(sus in key.lower() for sus in suspicious_keys):
                return "SECRET_EMBEDDED_IN_TOKEN"
        return None
    
    @staticmethod
    def detect_improper_validation(payload):
        """Detect claims that bypass validation."""
        issues = []
        
        # Check for admin claims
        if payload.get('role') == 'admin' or payload.get('isAdmin') is True:
            issues.append("ADMIN_CLAIM_IN_TOKEN")
        
        # Check for excessive permissions
        scopes = payload.get('scope', '')
        if isinstance(scopes, str) and 'admin' in scopes.lower():
            issues.append("ADMIN_SCOPE_IN_TOKEN")
        
        return issues

class CredentialSprayer:
    """Test multiple authentication methods and credentials."""
    
    COMMON_CREDENTIALS = [
        # API keys
        {"client_id": "test", "client_secret": "test"},
        {"client_id": "admin", "client_secret": "admin"},
        {"client_id": "api", "client_secret": "api123"},
        {"api_key": "test-key"},
        
        # Username/password
        {"username": "admin", "password": "admin"},
        {"username": "admin", "password": "password123"},
        {"username": "test", "password": "test"},
        {"username": "user", "password": "user"},
        
        # OAuth flows
        {"grant_type": "client_credentials"},
        {"grant_type": "password"},
        {"grant_type": "implicit"},
        {"grant_type": "authorization_code"},
        
        # Empty/bad data
        {},
        {"invalid": "data"}
    ]
    
    def __init__(self, session):
        self.session = session
        self.successful_credentials = []
    
    def spray_endpoint(self, url, method="POST", additional_params=None):
        """Try multiple credential sets against an endpoint."""
        results = {
            "successful_auths": [],
            "vulnerabilities_found": []
        }
        
        for creds in self.COMMON_CREDENTIALS:
            # Combine with additional params
            data = creds.copy()
            if additional_params:
                data.update(additional_params)
            
            # Try the request
            resp = safe_request(
                self.session,
                method,
                url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if not resp or "error" in resp:
                continue
            
            status = resp.get("status", 0)
            content = resp.get("content", b"")
            
            # Check for successful authentication
            if status in [200, 201, 302]:
                try:
                    body = json.loads(content.decode('utf-8', errors='ignore'))
                    
                    # Look for tokens in response
                    if any(key in body for key in ['access_token', 'token', 'jwt']):
                        results["successful_auths"].append({
                            "credentials": {k: "***" if "secret" in k.lower() or "password" in k.lower() else v 
                                          for k, v in creds.items()},
                            "status": status,
                            "tokens_found": list(body.keys())
                        })
                        
                        # Check for vulnerabilities in successful auth
                        if "refresh_token" in body and "access_token" in body:
                            results["vulnerabilities_found"].append(
                                "BOTH_ACCESS_AND_REFRESH_IN_RESPONSE"
                            )
                        
                        if len(str(body.get('refresh_token', ''))) < 20:
                            results["vulnerabilities_found"].append(
                                "POTENTIALLY_WEAK_REFRESH_TOKEN"
                            )
                            
                except:
                    if b'access_token' in content or b'token' in content:
                        results["successful_auths"].append({
                            "credentials": creds,
                            "status": status,
                            "response_type": "non-json"
                        })
            
            # Check for information disclosure in errors
            elif status >= 400:
                error_body = content.decode('utf-8', errors='ignore')
                if 'secret' in error_body.lower() or 'key' in error_body.lower():
                    results["vulnerabilities_found"].append(
                        "SECRET_DISCLOSURE_IN_ERROR"
                    )
            
            time.sleep(0.3)  # Be respectful
        
        return results

class HeaderManipulationTester:
    """Test JWT header manipulation attacks."""
    
    @staticmethod
    def test_algorithm_confusion(token, endpoint_url, session):
        """Test for JWT algorithm confusion vulnerabilities."""
        results = {
            "vulnerabilities": [],
            "evidence": []
        }
        
        try:
            # Decode original token
            parts = token.split('.')
            if len(parts) != 3:
                return results
            
            header = json.loads(base64.b64decode(parts[0] + '==').decode())
            payload = json.loads(base64.b64decode(parts[1] + '==').decode())
            
            # Test 1: Change algorithm to 'none'
            header['alg'] = 'none'
            new_header = base64.b64encode(json.dumps(header).encode()).decode().rstrip('=')
            none_token = f"{new_header}.{parts[1]}.{parts[2]}"
            
            # Test with endpoint
            resp = safe_request(
                session,
                "GET",
                endpoint_url,
                headers={"Authorization": f"Bearer {none_token}"}
            )
            
            if resp and resp.get('status', 0) in [200, 201, 204]:
                results["vulnerabilities"].append("JWT_NONE_ALGORITHM_ACCEPTED")
                results["evidence"].append("Token with alg=none accepted")
            
            # Test 2: Change algorithm to HS256 with common secret
            header['alg'] = 'HS256'
            new_header = base64.b64encode(json.dumps(header).encode()).decode().rstrip('=')
            
            # Try with common secrets
            common_secrets = ['secret', 'password', 'admin', 'test', '123456']
            for secret in common_secrets:
                # Create new signature with weak secret
                msg = f"{new_header}.{parts[1]}".encode()
                new_sig = hmac.new(secret.encode(), msg, hashlib.sha256).digest()
                new_sig_b64 = base64.b64encode(new_sig).decode().rstrip('=').replace('+', '-').replace('/', '_')
                
                weak_token = f"{new_header}.{parts[1]}.{new_sig_b64}"
                
                resp = safe_request(
                    session,
                    "GET",
                    endpoint_url,
                    headers={"Authorization": f"Bearer {weak_token}"}
                )
                
                if resp and resp.get('status', 0) in [200, 201, 204]:
                    results["vulnerabilities"].append("WEAK_JWT_SECRET_VULNERABILITY")
                    results["evidence"].append(f"Accepted with secret: {secret}")
                    break
            
            return results
            
        except Exception as e:
            print(Fore.YELLOW + f"[!] Algorithm confusion test failed: {e}")
            return results

# ----------------------------------------------------------
# Enhanced Main Scanner Class
# ----------------------------------------------------------
class EnhancedTokenLifecyclePro:
    """Enhanced version with better detection capabilities."""
    
    def __init__(self, base_url, threads=None, aggressive=False):
        self.base = base_url.rstrip("/")
        self.threads = min(threads or DEFAULT_THREADS, MAX_WORKERS)
        self.aggressive = aggressive
        
        # Initialize analyzers
        self.token_analyzer = TokenAnalyzer()
        self.advanced_detector = AdvancedTokenDetector()
        self.credential_sprayer = None
        self.header_tester = HeaderManipulationTester()
        
        # Create session
        self.session = requests.Session()
        self.session.headers.update(random_headers())
        
        # Results
        self.findings = []
        self.discovered_tokens = {
            "access": [],
            "refresh": [],
            "id": []
        }
        
        # Extended endpoint lists
        self.EXTENDED_TOKEN_ENDPOINTS = TOKEN_ENDPOINTS + [
            "/login", "/api/login", "/auth", "/api/auth",
            "/oauth/authorize", "/connect/authorize",
            "/v1/token", "/v1/auth", "/v2/token"
        ]
        
        self.EXTENDED_PROTECTED_ENDPOINTS = PROTECTED_ENDPOINTS + [
            "/api/me", "/user/me", "/profile", "/api/profile",
            "/admin", "/api/admin", "/dashboard", "/api/dashboard"
        ]
        
        # Thread pool
        self.task_queue = Queue()
        self.results_queue = Queue()
        self.workers = []
        
        # Test credentials
        self.test_credentials = [
            {"grant_type": "client_credentials", "client_id": "test", "client_secret": "test"},
            {"grant_type": "password", "username": "admin", "password": "admin"},
            {"grant_type": "password", "username": "test", "password": "test"},
            {"api_key": "test123"},
            {}
        ]
    
    def build_url(self, path):
        """Build full URL from path."""
        return urljoin(self.base + "/", path.lstrip("/"))
    
    def _acquire_and_analyze_tokens(self, token_url):
        """Acquire tokens and perform initial analysis."""
        finding = new_finding()
        finding["url"] = token_url
        finding["path"] = urlparse(token_url).path
        finding["method"] = "POST"
        
        # Try multiple credential sets
        successful_auth = False
        
        for creds in self.test_credentials:
            resp = safe_request(
                self.session,
                "POST",
                token_url,
                data=creds,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if not resp or "error" in resp:
                continue
            
            # Check for successful response
            status = resp.get("status", 0)
            if status in [200, 201]:
                successful_auth = True
                
                # Extract tokens from response
                tokens = self.token_analyzer.extract_tokens_from_response(resp)
                
                if tokens["access_token"]:
                    self.discovered_tokens["access"].append(tokens["access_token"])
                    print(Fore.GREEN + f"  [✓] Acquired access token from {token_url}")
                    
                    # Analyze the token
                    access_token_analysis = self._analyze_token_lifetime(tokens["access_token"], "access")
                    if access_token_analysis:
                        finding.update(access_token_analysis)
                        finding["token_type"] = "access"
                
                if tokens["refresh_token"]:
                    self.discovered_tokens["refresh"].append(tokens["refresh_token"])
                    finding["refresh_token_present"] = True
                    print(Fore.GREEN + f"  [✓] Acquired refresh token from {token_url}")
                
                break  # Stop after first successful auth
        
        if not successful_auth:
            finding["classification"].append("token_endpoint_unreachable")
            finding["score"] = 5
            print(Fore.YELLOW + f"  [!] Could not acquire tokens from {token_url}")
        
        finding["severity"] = score_to_severity(finding["score"])
        return finding
    
    def _analyze_token_lifetime(self, token, token_type):
        """Analyze token lifetime and clock claims."""
        finding = new_finding()
        finding["token_type"] = token_type
        
        decoded = self.token_analyzer.decode_jwt(token)
        if not decoded:
            finding["classification"].append("invalid_token_format")
            finding["score"] = 20
            return finding
        
        payload = decoded["payload"]
        finding["token_claims"] = payload
        finding["token_algorithm"] = decoded.get("algorithm")
        
        # Analyze lifetime
        lifetime_analysis = self.token_analyzer.analyze_lifetime(payload)
        
        # Check for missing claims
        if lifetime_analysis["missing_claims"]:
            for claim in lifetime_analysis["missing_claims"]:
                finding[f"missing_{claim}"] = True
                finding["vulnerabilities"].append(f"missing_{claim}_claim")
        
        # Check for excessive lifetime
        if lifetime_analysis["excessive_lifetime"]:
            finding["excessive_lifetime"] = True
            finding["vulnerabilities"].append("excessive_token_lifetime")
        
        # Check clock skew issues
        if lifetime_analysis["clock_skew_issues"]:
            finding["clock_skew_issues"] = lifetime_analysis["clock_skew_issues"]
            for issue in lifetime_analysis["clock_skew_issues"]:
                finding["vulnerabilities"].append(issue)
        
        # Set lifetime
        if lifetime_analysis["lifetime_seconds"]:
            finding["token_lifetime_seconds"] = lifetime_analysis["lifetime_seconds"]
            
            # Classify lifetime
            if lifetime_analysis["lifetime_seconds"] > LIFETIME_THRESHOLDS["EXCESSIVE"]:
                finding["classification"].append("excessively_long_lived_token")
            elif lifetime_analysis["lifetime_seconds"] > LIFETIME_THRESHOLDS["LONG"]:
                finding["classification"].append("long_lived_token")
            elif lifetime_analysis["lifetime_seconds"] > LIFETIME_THRESHOLDS["MEDIUM"]:
                finding["classification"].append("medium_lived_token")
            else:
                finding["classification"].append("short_lived_token")
        
        # Score based on findings
        score = self._score_lifetime_issues(finding)
        finding["score"] = score
        finding["severity"] = score_to_severity(score)
        
        return finding
    
    def _score_lifetime_issues(self, finding):
        """Score lifetime analysis findings."""
        score = 0
        
        vulnerabilities = finding.get("vulnerabilities", [])
        
        for vuln in vulnerabilities:
            if "missing_exp_claim" in vuln:
                score = max(score, 90)
            elif "missing_iat_claim" in vuln:
                score = max(score, 70)
            elif "excessive_token_lifetime" in vuln:
                score = max(score, 80)
            elif "future_nbf" in vuln or "future_iat" in vuln:
                score = max(score, 60)
        
        return score
    
    def _run_advanced_tests(self):
        """Run advanced security tests."""
        print(Fore.CYAN + "[i] Running advanced security tests...")
        
        # Test each discovered token
        for token in self.discovered_tokens["access"]:
            if not token:
                continue
            
            # Decode and analyze
            decoded = self.token_analyzer.decode_jwt(token)
            if not decoded:
                continue
            
            header = decoded["header"]
            payload = decoded["payload"]
            
            # Advanced header analysis
            none_alg = self.advanced_detector.detect_none_algorithm(header)
            if none_alg:
                self._add_advanced_finding(
                    "JWT_NONE_ALGORITHM",
                    "Token accepts 'none' algorithm",
                    "CRITICAL",
                    95,
                    {"token_prefix": token[:50]}
                )
            
            weak_sig = self.advanced_detector.detect_weak_signature(header)
            if weak_sig:
                self._add_advanced_finding(
                    "WEAK_SIGNATURE_ALGORITHM",
                    f"Potential weak signing algorithm: {header.get('alg')}",
                    "MEDIUM",
                    50,
                    {"algorithm": header.get('alg')}
                )
            
            # Payload analysis
            embedded_secret = self.advanced_detector.detect_embedded_secrets(payload)
            if embedded_secret:
                self._add_advanced_finding(
                    "EMBEDDED_SECRET",
                    "Secret or key embedded in token payload",
                    "HIGH",
                    75,
                    {"suspicious_keys": [k for k in payload.keys() if 'secret' in k.lower() or 'key' in k.lower()]}
                )
            
            validation_issues = self.advanced_detector.detect_improper_validation(payload)
            for issue in validation_issues:
                self._add_advanced_finding(
                    issue,
                    "Privilege claim in token payload",
                    "MEDIUM",
                    60,
                    {"claims": {k: payload[k] for k in ['role', 'scope', 'isAdmin'] if k in payload}}
                )
            
            # Test header manipulation
            if self.discovered_tokens["access"]:
                protected_url = self.build_url(PROTECTED_ENDPOINTS[0])
                manip_results = self.header_tester.test_algorithm_confusion(
                    token, protected_url, self.session
                )
                
                for vuln in manip_results["vulnerabilities"]:
                    self._add_advanced_finding(
                        vuln,
                        "JWT header manipulation vulnerability",
                        "CRITICAL" if "NONE" in vuln else "HIGH",
                        90 if "NONE" in vuln else 80,
                        {"evidence": manip_results.get("evidence", [])}
                    )
    
    def _run_credential_spraying(self):
        """Test multiple authentication methods."""
        print(Fore.CYAN + "[i] Testing authentication endpoints with common credentials...")
        
        if not self.credential_sprayer:
            self.credential_sprayer = CredentialSprayer(self.session)
        
        token_urls = [self.build_url(ep) for ep in self.EXTENDED_TOKEN_ENDPOINTS[:4]]
        
        for url in token_urls:
            print(Fore.WHITE + f"  Testing: {url}")
            
            spray_results = self.credential_sprayer.spray_endpoint(url)
            
            if spray_results["successful_auths"]:
                for auth in spray_results["successful_auths"]:
                    self._add_credential_finding(url, auth)
            
            if spray_results["vulnerabilities_found"]:
                for vuln in spray_results["vulnerabilities_found"]:
                    self._add_advanced_finding(
                        vuln,
                        f"Authentication vulnerability at {url}",
                        "MEDIUM",
                        65,
                        {"url": url}
                    )
    
    def _add_advanced_finding(self, vulnerability, description, severity, score, evidence=None):
        """Add advanced finding to results."""
        finding = new_finding()
        finding["url"] = self.base
        finding["vulnerabilities"] = [vulnerability]
        finding["classification"] = ["advanced_security_issue"]
        finding["severity"] = severity
        finding["score"] = score
        finding["timestamp"] = utc_now().isoformat()
        finding["description"] = description
        
        if evidence:
            finding["evidence"] = evidence
        
        self.findings.append(finding)
        print(Fore.YELLOW + f"  [!] Found: {vulnerability} ({severity})")
    
    def _add_credential_finding(self, url, auth_info):
        """Add credential spraying finding."""
        finding = new_finding()
        finding["url"] = url
        finding["vulnerabilities"] = ["WEAK_AUTHENTICATION_CREDENTIALS"]
        finding["classification"] = ["credential_spraying_success"]
        finding["severity"] = "HIGH"
        finding["score"] = 70
        finding["timestamp"] = utc_now().isoformat()
        finding["evidence"] = {
            "successful_credentials": auth_info.get("credentials", {}),
            "status_code": auth_info.get("status"),
            "tokens_found": auth_info.get("tokens_found", [])
        }
        
        self.findings.append(finding)
        print(Fore.RED + f"  [!] Authentication bypass with: {auth_info.get('credentials', {})}")
    
    def run(self, token_endpoints=None, refresh_endpoints=None, logout_endpoints=None):
        """Execute comprehensive token lifecycle analysis."""
        print(Fore.CYAN + f"[i] Starting ENHANCED TokenLifecycle Pro on {self.base}")
        print(Fore.CYAN + f"[i] Mode: {'Aggressive' if self.aggressive else 'Standard'}")
        
        # Build endpoint lists
        if token_endpoints is None:
            token_endpoints = self.EXTENDED_TOKEN_ENDPOINTS
        
        token_urls = [self.build_url(ep) for ep in token_endpoints[:4]]
        
        # Phase 1: Token acquisition and basic analysis
        print(Fore.CYAN + "[i] Phase 1: Token acquisition...")
        for url in token_urls:
            finding = self._acquire_and_analyze_tokens(url)
            if finding:
                self.findings.append(finding)
        
        # Phase 2: Advanced tests
        if self.aggressive and self.discovered_tokens["access"]:
            print(Fore.CYAN + "[i] Phase 2: Advanced security tests...")
            self._run_advanced_tests()
        
        # Phase 3: Credential spraying
        if self.aggressive:
            print(Fore.CYAN + "[i] Phase 3: Credential spraying...")
            self._run_credential_spraying()
        
        # Generate reports
        self._generate_enhanced_reports()
        
        return self.findings
    
    def _generate_enhanced_reports(self):
        """Generate enhanced reports with all findings."""
        # Vulnerability summary
        vuln_counts = {}
        for finding in self.findings:
            for vuln in finding.get("vulnerabilities", []):
                vuln_counts[vuln] = vuln_counts.get(vuln, 0) + 1
        
        print(Fore.CYAN + "=" * 70)
        print(Fore.CYAN + " ENHANCED VULNERABILITY SUMMARY")
        print(Fore.CYAN + "=" * 70)
        
        if not vuln_counts:
            print(Fore.WHITE + "  No vulnerabilities found")
        else:
            for vuln, count in sorted(vuln_counts.items(), key=lambda x: x[1], reverse=True):
                severity_color = Fore.WHITE
                if "CRITICAL" in vuln or "NONE" in vuln:
                    severity_color = Fore.RED
                elif "HIGH" in vuln or "WEAK" in vuln:
                    severity_color = Fore.YELLOW
                elif "MEDIUM" in vuln:
                    severity_color = Fore.CYAN
                
                print(f"{severity_color}  {vuln}: {count}")
        
        print(Fore.CYAN + "=" * 70)
        
        # Generate file reports
        self._generate_file_reports()
    
    def _generate_file_reports(self):
        """Generate comprehensive reports in multiple formats."""
        timestamp = now_ts()
        base_name = f"tokenlifecycle_{now_ts('%Y%m%d_%H%M%S')}"
        
        # 1. Text Report
        txt_file = os.path.join(TXT_DIR, f"{base_name}.txt")
        with open(txt_file, 'w', encoding='utf-8') as f:
            f.write("=" * 70 + "\n")
            f.write("ENHANCED TOKEN LIFECYCLE PRO - SECURITY ASSESSMENT REPORT\n")
            f.write(f"Generated: {utc_now().isoformat()}\n")
            f.write(f"Target: {self.base}\n")
            f.write(f"Mode: {'Aggressive' if self.aggressive else 'Standard'}\n")
            f.write("=" * 70 + "\n\n")
            
            if not self.findings:
                f.write("No findings detected.\n")
            else:
                for i, finding in enumerate(self.findings, 1):
                    f.write(f"[FINDING #{i}]\n")
                    f.write(f"URL: {finding.get('url', 'N/A')}\n")
                    f.write(f"Token Type: {finding.get('token_type', 'N/A')}\n")
                    f.write(f"Severity: {finding.get('severity', 'INFO')} (Score: {finding.get('score', 0)})\n")
                    
                    if finding.get('vulnerabilities'):
                        f.write(f"Vulnerabilities: {', '.join(finding['vulnerabilities'])}\n")
                    
                    if finding.get('description'):
                        f.write(f"Description: {finding['description']}\n")
                    
                    if finding.get('token_lifetime_seconds'):
                        hours = finding['token_lifetime_seconds'] / 3600
                        f.write(f"Token Lifetime: {finding['token_lifetime_seconds']}s ({hours:.2f} hours)\n")
                    
                    f.write("-" * 50 + "\n")
        
        # 2. JSON Report
        json_file = os.path.join(JSON_DIR, f"{base_name}.json")
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(sanitize(self.findings), f, indent=2, default=str)
        
        # 3. CSV Report
        csv_file = os.path.join(CSV_DIR, f"{base_name}.csv")
        if self.findings:
            # Get all unique fieldnames
            fieldnames = set()
            for finding in self.findings:
                fieldnames.update(finding.keys())
            fieldnames = list(fieldnames)
            
            with open(csv_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for finding in self.findings:
                    writer.writerow(sanitize(finding))
        
        print(Fore.GREEN + f"[✓] Reports generated:")
        print(Fore.GREEN + f"    • TXT:  {txt_file}")
        print(Fore.GREEN + f"    • JSON: {json_file}")
        print(Fore.GREEN + f"    • CSV:  {csv_file}")

# ==========================================================
# MAIN EXECUTION BLOCK
# ==========================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Enhanced TokenLifecycle Pro - Advanced Token Security Analyzer'
    )
    parser.add_argument('url', help='Base URL to scan (e.g., https://api.example.com)')
    parser.add_argument('-t', '--threads', type=int, default=DEFAULT_THREADS,
                       help=f'Number of threads (default: {DEFAULT_THREADS}, max: {MAX_WORKERS})')
    parser.add_argument('-a', '--aggressive', action='store_true',
                       help='Enable aggressive testing (credential spraying, header manipulation)')
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='Enable verbose output')
    parser.add_argument('-c', '--custom-endpoints', type=str,
                       help='Custom endpoints file (JSON)')
    
    args = parser.parse_args()
    
    try:
        if args.verbose:
            print(Fore.CYAN + "[i] Initializing Enhanced TokenLifecycle Pro...")
            print(Fore.CYAN + f"[i] Target URL: {args.url}")
            print(Fore.CYAN + f"[i] Threads: {args.threads}")
            print(Fore.CYAN + f"[i] Aggressive mode: {'ON' if args.aggressive else 'OFF'}")
        
        # Load custom endpoints if provided
        custom_config = None
        if args.custom_endpoints and os.path.exists(args.custom_endpoints):
            with open(args.custom_endpoints, 'r') as f:
                custom_config = json.load(f)
            if args.verbose:
                print(Fore.CYAN + f"[i] Loaded custom config from: {args.custom_endpoints}")
        
        # Create scanner
        scanner = EnhancedTokenLifecyclePro(
            args.url, 
            threads=args.threads,
            aggressive=args.aggressive
        )
        
        # Run with custom config if available
        if custom_config:
            findings = scanner.run(
                token_endpoints=custom_config.get('token_endpoints'),
                refresh_endpoints=custom_config.get('refresh_endpoints'),
                logout_endpoints=custom_config.get('logout_endpoints')
            )
        else:
            findings = scanner.run()
        
        # Final summary
        critical = sum(1 for f in findings if f.get('severity') == 'CRITICAL')
        high = sum(1 for f in findings if f.get('severity') == 'HIGH')
        medium = sum(1 for f in findings if f.get('severity') == 'MEDIUM')
        low = sum(1 for f in findings if f.get('severity') == 'LOW')
        
        print(Fore.CYAN + "\n" + "=" * 60)
        print(Fore.CYAN + " FINAL RESULTS")
        print(Fore.CYAN + "=" * 60)
        print(Fore.RED + f"  CRITICAL: {critical}")
        print(Fore.YELLOW + f"  HIGH: {high}")
        print(Fore.CYAN + f"  MEDIUM: {medium}")
        print(Fore.WHITE + f"  LOW: {low}")
        print(Fore.GREEN + f"  Total Findings: {len(findings)}")
        print(Fore.CYAN + "=" * 60)
        
        if critical > 0:
            print(Fore.RED + "\n[!] CRITICAL vulnerabilities found!")
            print(Fore.RED + "    Immediate remediation required!")
        elif high > 0:
            print(Fore.YELLOW + "\n[!] High severity vulnerabilities found!")
            print(Fore.YELLOW + "    Prioritize fixing these issues.")
        elif medium > 0:
            print(Fore.CYAN + "\n[!] Medium severity vulnerabilities found.")
            print(Fore.CYAN + "    Address during next maintenance window.")
        else:
            print(Fore.GREEN + "\n[✓] No critical vulnerabilities detected")
            print(Fore.GREEN + "    Token security appears robust.")
        
        # List critical findings
        if critical > 0:
            print(Fore.RED + "\nCritical Findings:")
            for finding in [f for f in findings if f.get('severity') == 'CRITICAL']:
                vulns = ', '.join(finding.get('vulnerabilities', []))
                print(Fore.RED + f"  • {vulns}")
        
    except KeyboardInterrupt:
        print(Fore.YELLOW + "\n[!] Scan interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(Fore.RED + f"\n[✗] Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)