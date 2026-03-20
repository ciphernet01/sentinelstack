# ==========================================================
# Enhanced RateGuard Pro — Enterprise Edition v2.0
# Comprehensive Rate Limit Security Analyzer
# ==========================================================

import os
import re
import sys
import json
import csv
import time
import random
import statistics
import hashlib
import threading
import ipaddress
import concurrent.futures
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
from collections import defaultdict, Counter, deque
from typing import Dict, List, Tuple, Optional, Any
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==========================================================
# Color handling with fallback
# ==========================================================
try:
    from colorama import init as colorama_init, Fore, Style, Back
    colorama_init(autoreset=True)
    COLORS_ENABLED = True
except Exception:
    COLORS_ENABLED = False
    class _NoColor:
        def __getattr__(self, _): return ""
    Fore = Style = Back = _NoColor()

# ==========================================================
# Enhanced Configuration
# ==========================================================
class Config:
    # Output directories
    OUTPUT_BASE = os.path.join("reports", "rateguard_enhanced")
    TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
    JSON_DIR = os.path.join(OUTPUT_BASE, "json")
    CSV_DIR = os.path.join(OUTPUT_BASE, "csv")
    HTML_DIR = os.path.join(OUTPUT_BASE, "html")
    MARKDOWN_DIR = os.path.join(OUTPUT_BASE, "markdown")
    
    for dir_path in [TXT_DIR, JSON_DIR, CSV_DIR, HTML_DIR, MARKDOWN_DIR]:
        os.makedirs(dir_path, exist_ok=True)
    
    # Performance settings
    REQUEST_TIMEOUT = 10
    MAX_RETRIES = 2
    DEFAULT_THREADS = 15
    MAX_THREADS = 50
    CONNECTION_POOL_SIZE = 100
    
    # Rate limit testing profiles
    PROFILES = {
        "stealth": {
            "burst_sizes": [3, 5, 8],
            "burst_delay": 1.0,
            "test_duration": 30,
            "max_requests_per_minute": 60
        },
        "balanced": {
            "burst_sizes": [5, 10, 15, 20],
            "burst_delay": 0.5,
            "test_duration": 45,
            "max_requests_per_minute": 120
        },
        "aggressive": {
            "burst_sizes": [10, 20, 30, 50],
            "burst_delay": 0.2,
            "test_duration": 60,
            "max_requests_per_minute": 300
        },
        "bruteforce": {
            "burst_sizes": [20, 40, 60, 100],
            "burst_delay": 0.1,
            "test_duration": 90,
            "max_requests_per_minute": 600
        }
    }
    
    # Rate limit headers to detect
    RATE_LIMIT_HEADERS = [
        # Standard headers
        "Retry-After",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining", 
        "X-RateLimit-Reset",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "X-Rate-Limit-Limit",
        "X-Rate-Limit-Remaining",
        "X-Rate-Limit-Reset",
        
        # Cloud providers
        "X-RateLimit-Policy",
        "X-Throttling-Policy",
        "X-Request-Rate-Limit",
        
        # API Gateways
        "X-API-RateLimit-Limit",
        "X-API-RateLimit-Remaining",
        "X-API-Quota",
        
        # Custom implementations
        "X-Request-Throttled",
        "X-Throttle-Control",
        "X-Rate-Control"
    ]
    
    # Blocking status codes
    BLOCKING_STATUS_CODES = {
        429,  # Too Many Requests
        403,  # Forbidden (often used for rate limiting)
        503,  # Service Unavailable (rate limit overload)
        418,  # I'm a teapot (sometimes used humorously)
        451   # Unavailable For Legal Reasons
    }
    
    # Slowdown/throttling indicators
    SLOWDOWN_CODES = {408, 504, 509}
    
    # Default endpoints to test
    DEFAULT_ENDPOINTS = [
        "/",
        "/api",
        "/api/v1",
        "/api/v2", 
        "/api/v3",
        "/graphql",
        "/rest",
        "/oauth2",
        "/oauth2/token",
        "/auth",
        "/login",
        "/signin",
        "/register",
        "/users",
        "/users/me",
        "/profile",
        "/admin",
        "/admin/api",
        "/wp-json",
        "/wp-json/wp/v2",
        "/data",
        "/export",
        "/import",
        "/search",
        "/query",
        "/status",
        "/health",
        "/metrics",
        "/debug"
    ]
    
    # HTTP methods to test
    HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"]
    
    # User agents for request rotation
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/122.0",
        "curl/8.0.1",
        "python-requests/2.31.0",
        "RateGuardPro/2.0.0 (Security Scanner)"
    ]
    
    # Request headers for different scenarios
    REQUEST_HEADERS = {
        "default": {
            "Accept": "application/json, text/html, application/xhtml+xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        },
        "api": {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-API-Version": "1.0"
        },
        "mobile": {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
            "Accept": "*/*"
        }
    }
    
    # Scoring thresholds
    SCORE_LEVELS = {
        "CRITICAL": (90, 100),    # No rate limiting at all
        "HIGH": (70, 89),         # Weak or inconsistent rate limiting
        "MEDIUM": (40, 69),       # Basic rate limiting with issues
        "LOW": (20, 39),          # Strong rate limiting but with minor issues
        "INFO": (0, 19)           # Well-implemented rate limiting
    }
    
    # Rate limit bypass techniques to test
    BYPASS_TECHNIQUES = [
        "ip_rotation",      # Test with different IP headers
        "user_agent_rotation",  # Rotate user agents
        "referer_spoofing",     # Spoof referer headers
        "cookie_manipulation",  # Modify cookies
        "header_injection",     # Inject custom headers
        "parameter_tampering",  # Tamper with URL parameters
        "method_variation",     # Try different HTTP methods
        "path_variation",       # Try similar paths
        "protocol_mixing"       # Mix HTTP/HTTPS
    ]

# ==========================================================
# Enhanced Utilities
# ==========================================================
class EnhancedUtilities:
    @staticmethod
    def now_utc():
        """Timezone-aware UTC timestamp"""
        return datetime.now(timezone.utc)
    
    @staticmethod
    def format_timestamp():
        """Formatted timestamp for filenames"""
        return datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    
    @staticmethod
    def sanitize_filename(filename):
        """Sanitize filename for safe filesystem use"""
        return re.sub(r'[^\w\-_\. ]', '_', filename)[:100]
    
    @staticmethod
    def calculate_response_hash(response):
        """Calculate hash of response for comparison"""
        if not response:
            return None
        
        content = response.get("text", "") or ""
        headers = json.dumps(dict(sorted(response.get("headers", {}).items())))
        
        hash_content = f"{content}{headers}".encode('utf-8', errors='ignore')
        return hashlib.md5(hash_content).hexdigest()[:16]
    
    @staticmethod
    def extract_rate_limit_info(headers):
        """Extract rate limit information from headers"""
        rate_info = {}
        
        for header in Config.RATE_LIMIT_HEADERS:
            if header in headers:
                rate_info[header] = headers[header]
        
        # Parse Retry-After if present
        if "Retry-After" in rate_info:
            try:
                retry_after = rate_info["Retry-After"]
                if retry_after.isdigit():
                    rate_info["retry_after_seconds"] = int(retry_after)
                else:
                    # Try to parse date format
                    pass
            except:
                pass
        
        return rate_info
    
    @staticmethod
    def detect_rate_limit_pattern(responses):
        """Detect rate limiting patterns from response sequence"""
        if len(responses) < 3:
            return None
        
        patterns = {
            "window_based": False,
            "token_bucket": False,
            "leaky_bucket": False,
            "fixed_window": False,
            "sliding_window": False
        }
        
        status_codes = [r.get("status_code", 0) for r in responses]
        response_times = [r.get("elapsed", 0) for r in responses]
        
        # Check for 429 pattern
        if 429 in status_codes:
            patterns["window_based"] = True
            
            # Check if 429 occurs at regular intervals
            indices = [i for i, code in enumerate(status_codes) if code == 429]
            if len(indices) > 2:
                intervals = [indices[i+1] - indices[i] for i in range(len(indices)-1)]
                if max(intervals) - min(intervals) <= 2:  # Regular intervals
                    patterns["fixed_window"] = True
        
        # Check for gradual slowdown (token bucket or leaky bucket)
        if len(response_times) >= 5:
            window_size = min(5, len(response_times) // 2)
            early_avg = statistics.mean(response_times[:window_size])
            late_avg = statistics.mean(response_times[-window_size:])
            
            if late_avg > early_avg * 1.5:  # 50% slower
                patterns["token_bucket"] = True
        
        return patterns
    
    @staticmethod
    def generate_request_signature(request_data):
        """Generate unique signature for a request"""
        components = [
            request_data.get("method", ""),
            request_data.get("url", ""),
            request_data.get("headers", {}).get("User-Agent", ""),
            request_data.get("headers", {}).get("X-Forwarded-For", "")
        ]
        signature = "|".join(str(c) for c in components)
        return hashlib.md5(signature.encode()).hexdigest()[:8]
    
    @staticmethod
    def analyze_response_times(times):
        """Analyze response time patterns for throttling detection"""
        if len(times) < 3:
            return {"analysis": "insufficient_data"}
        
        analysis = {
            "mean": statistics.mean(times),
            "median": statistics.median(times),
            "stdev": statistics.stdev(times) if len(times) > 1 else 0,
            "min": min(times),
            "max": max(times),
            "percentile_95": sorted(times)[int(len(times) * 0.95)] if len(times) >= 20 else max(times),
            "trend": "stable"
        }
        
        # Detect trends
        if len(times) >= 5:
            early = statistics.mean(times[:len(times)//3])
            late = statistics.mean(times[-len(times)//3:])
            
            if late > early * 2:
                analysis["trend"] = "increasing"
            elif late < early * 0.5:
                analysis["trend"] = "decreasing"
        
        return analysis

# ==========================================================
# Rate Limiting Detection Engine
# ==========================================================
class RateLimitDetector:
    def __init__(self):
        self.detected_patterns = defaultdict(list)
        self.techniques_tested = set()
    
    def analyze_responses(self, responses):
        """Comprehensive analysis of response patterns"""
        analysis = {
            "rate_limit_detected": False,
            "limit_type": None,
            "threshold_estimate": None,
            "window_estimate": None,
            "bypass_possible": False,
            "vulnerabilities": [],
            "confidence": 0
        }
        
        if not responses:
            return analysis
        
        status_codes = [r.get("status_code", 0) for r in responses]
        response_times = [r.get("elapsed", 0) for r in responses]
        
        # Check for blocking status codes
        blocking_codes = [code for code in status_codes if code in Config.BLOCKING_STATUS_CODES]
        if blocking_codes:
            analysis["rate_limit_detected"] = True
            analysis["confidence"] = 90
            
            # Determine limit type based on pattern
            if 429 in blocking_codes:
                analysis["limit_type"] = "standard_429"
                
                # Try to estimate threshold
                for i, code in enumerate(status_codes):
                    if code == 429:
                        analysis["threshold_estimate"] = i
                        break
                        
                # Check for Retry-After headers
                for response in responses:
                    if response.get("status_code") == 429 and "Retry-After" in response.get("headers", {}):
                        analysis["window_estimate"] = response["headers"]["Retry-After"]
                        analysis["confidence"] = 95
        
        # Check for soft throttling (increasing response times)
        if len(response_times) >= 10:
            time_analysis = EnhancedUtilities.analyze_response_times(response_times)
            if time_analysis["trend"] == "increasing" and time_analysis["max"] > time_analysis["min"] * 3:
                analysis["rate_limit_detected"] = True
                analysis["limit_type"] = "soft_throttling"
                analysis["confidence"] = max(analysis["confidence"], 70)
                analysis["vulnerabilities"].append("Soft throttling detected - possible DoS vulnerability")
        
        # Check for inconsistent rate limiting
        if analysis["rate_limit_detected"]:
            # Analyze if rate limiting is consistent
            success_before_block = sum(1 for code in status_codes[:analysis.get("threshold_estimate", len(status_codes))] 
                                     if code not in Config.BLOCKING_STATUS_CODES)
            if success_before_block < 5:
                analysis["vulnerabilities"].append("Very low threshold - may impact legitimate users")
                analysis["confidence"] = min(analysis["confidence"] + 5, 100)
        
        # Check for missing rate limit headers on sensitive endpoints
        sensitive_keywords = ["login", "auth", "register", "password", "token"]
        endpoint = responses[0].get("url", "") if responses else ""
        if any(keyword in endpoint.lower() for keyword in sensitive_keywords):
            has_rate_headers = any(
                any(h in Config.RATE_LIMIT_HEADERS for h in r.get("headers", {}).keys())
                for r in responses[:5]  # Check first few responses
            )
            if not has_rate_headers and not analysis["rate_limit_detected"]:
                analysis["vulnerabilities"].append("No rate limiting on sensitive endpoint")
                analysis["confidence"] = max(analysis["confidence"], 60)
        
        return analysis
    
    def test_bypass_techniques(self, base_url, endpoint, session):
        """Test various rate limit bypass techniques"""
        bypass_results = []
        
        # Technique 1: IP Rotation via headers
        ip_headers = [
            {"X-Forwarded-For": "192.168.1." + str(i)} for i in range(1, 5)
        ] + [
            {"X-Real-IP": "10.0.0." + str(i)} for i in range(1, 5)
        ]
        
        for headers in ip_headers[:3]:  # Test first 3
            response = self._make_request(session, base_url + endpoint, headers=headers)
            if response and response.get("status_code") not in Config.BLOCKING_STATUS_CODES:
                bypass_results.append({
                    "technique": "ip_rotation",
                    "headers": headers,
                    "success": True
                })
                break
        
        # Technique 2: User Agent Rotation
        user_agents = Config.USER_AGENTS[:5]
        for ua in user_agents:
            headers = {"User-Agent": ua}
            response = self._make_request(session, base_url + endpoint, headers=headers)
            if response and response.get("status_code") not in Config.BLOCKING_STATUS_CODES:
                bypass_results.append({
                    "technique": "user_agent_rotation",
                    "user_agent": ua,
                    "success": True
                })
                break
        
        # Technique 3: Path Variation
        path_variations = [
            endpoint + "?v=1",
            endpoint + "?cache=" + str(random.randint(1000, 9999)),
            endpoint + "?t=" + str(int(time.time()))
        ]
        
        for path in path_variations:
            response = self._make_request(session, base_url + path)
            if response and response.get("status_code") not in Config.BLOCKING_STATUS_CODES:
                bypass_results.append({
                    "technique": "path_variation",
                    "path": path,
                    "success": True
                })
                break
        
        return bypass_results
    
    def _make_request(self, session, url, headers=None):
        """Make a single request"""
        try:
            response = session.get(
                url,
                headers=headers,
                timeout=Config.REQUEST_TIMEOUT,
                verify=False
            )
            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "elapsed": response.elapsed.total_seconds(),
                "url": url
            }
        except:
            return None

# ==========================================================
# Enhanced Request Engine
# ==========================================================
class ResilientSession:
    def __init__(self, timeout=Config.REQUEST_TIMEOUT, max_retries=Config.MAX_RETRIES):
        self.session = requests.Session()
        self.timeout = timeout
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        )
        
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=Config.CONNECTION_POOL_SIZE,
            pool_maxsize=Config.CONNECTION_POOL_SIZE
        )
        
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Default headers
        self.session.headers.update({
            "User-Agent": random.choice(Config.USER_AGENTS),
            "Accept": "application/json, text/html, application/xhtml+xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive"
        })
    
    def request(self, method, url, **kwargs):
        """Make HTTP request with enhanced tracking"""
        start_time = time.time()
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                timeout=self.timeout,
                verify=False,
                allow_redirects=True,
                **kwargs
            )
            
            elapsed = time.time() - start_time
            
            result = {
                "url": response.url,
                "method": method,
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "content": response.content,
                "text": response.text,
                "elapsed": elapsed,
                "size": len(response.content),
                "timestamp": EnhancedUtilities.now_utc().isoformat(),
                "history": [{
                    "status_code": r.status_code,
                    "url": r.url
                } for r in response.history]
            }
            
            # Calculate response hash for comparison
            result["hash"] = EnhancedUtilities.calculate_response_hash(result)
            
            # Extract rate limit info
            result["rate_limit_info"] = EnhancedUtilities.extract_rate_limit_info(result["headers"])
            
            return result
            
        except requests.exceptions.Timeout:
            return {
                "url": url,
                "method": method,
                "status_code": 0,
                "error": "Timeout",
                "elapsed": time.time() - start_time,
                "timestamp": EnhancedUtilities.now_utc().isoformat()
            }
        except requests.exceptions.ConnectionError:
            return {
                "url": url,
                "method": method,
                "status_code": 0,
                "error": "ConnectionError",
                "elapsed": time.time() - start_time,
                "timestamp": EnhancedUtilities.now_utc().isoformat()
            }
        except Exception as e:
            return {
                "url": url,
                "method": method,
                "status_code": 0,
                "error": str(e),
                "elapsed": time.time() - start_time,
                "timestamp": EnhancedUtilities.now_utc().isoformat()
            }
    
    def close(self):
        self.session.close()

# ==========================================================
# Enhanced RateGuard Scanner
# ==========================================================
class EnhancedRateGuard:
    def __init__(self, base_url, threads=Config.DEFAULT_THREADS, profile="balanced"):
        self.base_url = base_url.rstrip("/")
        self.threads = min(max(1, threads), Config.MAX_THREADS)
        self.profile = profile if profile in Config.PROFILES else "balanced"
        
        # Initialize components
        self.session = ResilientSession()
        self.detector = RateLimitDetector()
        self.findings = []
        self.stats = defaultdict(int)
        self.lock = threading.Lock()
        
        # Rate limiting for our own requests
        self.request_timestamps = deque(maxlen=Config.PROFILES[self.profile]["max_requests_per_minute"])
        
        # Parse target info
        parsed = urlparse(base_url)
        self.target_host = parsed.hostname
        self.target_port = parsed.port
        self.target_scheme = parsed.scheme
    
    def _respect_rate_limit(self):
        """Respect rate limits to avoid overwhelming target"""
        current_time = time.time()
        
        # Remove timestamps older than 60 seconds
        while self.request_timestamps and current_time - self.request_timestamps[0] > 60:
            self.request_timestamps.popleft()
        
        # Check if we're at the limit
        if len(self.request_timestamps) >= Config.PROFILES[self.profile]["max_requests_per_minute"]:
            oldest = self.request_timestamps[0]
            wait_time = 60 - (current_time - oldest)
            if wait_time > 0:
                time.sleep(wait_time + 0.1)
                self.request_timestamps.clear()
        
        self.request_timestamps.append(current_time)
    
    def test_endpoint(self, endpoint, method="GET"):
        """Comprehensive rate limit testing for a single endpoint"""
        url = urljoin(self.base_url + "/", endpoint.lstrip("/"))
        
        print(Fore.CYAN + f"[*] Testing: {method} {url}")
        
        profile_config = Config.PROFILES[self.profile]
        burst_sizes = profile_config["burst_sizes"]
        burst_delay = profile_config["burst_delay"]
        
        endpoint_results = {
            "endpoint": endpoint,
            "url": url,
            "method": method,
            "profile": self.profile,
            "burst_tests": [],
            "analysis": {},
            "vulnerabilities": [],
            "bypass_results": [],
            "timestamp": EnhancedUtilities.now_utc().isoformat()
        }
        
        # Test each burst size
        for burst_size in burst_sizes:
            burst_result = self._perform_burst_test(url, method, burst_size)
            endpoint_results["burst_tests"].append(burst_result)
            
            # Analyze responses
            if burst_result["responses"]:
                analysis = self.detector.analyze_responses(burst_result["responses"])
                endpoint_results["analysis"][burst_size] = analysis
                
                # Collect vulnerabilities
                endpoint_results["vulnerabilities"].extend(analysis.get("vulnerabilities", []))
            
            # Respect delay between bursts
            time.sleep(burst_delay)
        
        # Test bypass techniques if rate limiting is detected
        if any(analysis.get("rate_limit_detected", False) 
               for analysis in endpoint_results["analysis"].values()):
            
            print(Fore.YELLOW + f"[*] Testing bypass techniques for {endpoint}")
            bypass_results = self.detector.test_bypass_techniques(self.base_url, endpoint, self.session.session)
            endpoint_results["bypass_results"] = bypass_results
        
        # Calculate overall score
        endpoint_results["score"] = self._calculate_endpoint_score(endpoint_results)
        endpoint_results["severity"] = self._score_to_severity(endpoint_results["score"])
        
        return endpoint_results
    
    def _perform_burst_test(self, url, method, burst_size):
        """Perform a burst of requests and collect responses"""
        burst_result = {
            "burst_size": burst_size,
            "start_time": time.time(),
            "responses": [],
            "summary": {}
        }
        
        responses = []
        
        for i in range(burst_size):
            self._respect_rate_limit()
            
            # Add some request variation
            headers = random.choice(list(Config.REQUEST_HEADERS.values()))
            headers["User-Agent"] = random.choice(Config.USER_AGENTS)
            
            # Add unique identifier to track requests
            headers["X-Test-Request-ID"] = f"{int(time.time())}-{i}"
            
            response = self.session.request(method, url, headers=headers)
            responses.append(response)
            
            # Small delay between requests in burst
            time.sleep(0.05)
        
        burst_result["responses"] = responses
        
        # Generate summary
        status_codes = [r.get("status_code", 0) for r in responses]
        response_times = [r.get("elapsed", 0) for r in responses if r.get("elapsed")]
        
        burst_result["summary"] = {
            "total_requests": burst_size,
            "successful_responses": len([r for r in responses if r.get("status_code", 0) in [200, 201, 204]]),
            "blocked_responses": len([r for r in responses if r.get("status_code", 0) in Config.BLOCKING_STATUS_CODES]),
            "error_responses": len([r for r in responses if r.get("status_code", 0) >= 400]),
            "status_codes": Counter(status_codes),
            "response_time_stats": EnhancedUtilities.analyze_response_times(response_times) if response_times else {},
            "rate_limit_headers_found": any(
                any(h in Config.RATE_LIMIT_HEADERS for h in r.get("headers", {}).keys())
                for r in responses
            )
        }
        
        burst_result["end_time"] = time.time()
        burst_result["duration"] = burst_result["end_time"] - burst_result["start_time"]
        
        return burst_result
    
    def _calculate_endpoint_score(self, endpoint_result):
        """Calculate risk score for an endpoint"""
        score = 0
        
        # Check if rate limiting is detected
        rate_limit_detected = any(
            analysis.get("rate_limit_detected", False)
            for analysis in endpoint_result["analysis"].values()
        )
        
        if not rate_limit_detected:
            # No rate limiting - high risk
            score = 90
        else:
            # Rate limiting exists, but check effectiveness
            for analysis in endpoint_result["analysis"].values():
                confidence = analysis.get("confidence", 0)
                
                if confidence >= 80:
                    # Strong rate limiting
                    score = max(score, 20)
                elif confidence >= 60:
                    # Moderate rate limiting
                    score = max(score, 40)
                else:
                    # Weak rate limiting
                    score = max(score, 70)
        
        # Check for bypass techniques
        if endpoint_result["bypass_results"]:
            successful_bypasses = [r for r in endpoint_result["bypass_results"] if r.get("success", False)]
            if successful_bypasses:
                score = max(score, 80)
                score += len(successful_bypasses) * 5
        
        # Adjust for sensitive endpoints
        if self._is_sensitive_endpoint(endpoint_result["endpoint"]):
            if score < 70:  # Sensitive endpoint with weak/no rate limiting
                score = min(score + 20, 100)
        
        return min(score, 100)  # Cap at 100
    
    def _is_sensitive_endpoint(self, endpoint):
        """Check if endpoint is sensitive"""
        endpoint_lower = endpoint.lower()
        sensitive_keywords = [
            "login", "auth", "register", "signup", "password",
            "token", "oauth", "admin", "reset", "verify", "payment"
        ]
        return any(keyword in endpoint_lower for keyword in sensitive_keywords)
    
    def _score_to_severity(self, score):
        """Convert score to severity level"""
        for severity, (low, high) in Config.SCORE_LEVELS.items():
            if low <= score <= high:
                return severity
        return "INFO"
    
    def run_scan(self, endpoints=None, methods=None):
        """Run comprehensive rate limit scan"""
        print(Fore.GREEN + "=" * 70)
        print(Fore.GREEN + "ENHANCED RATEGUARD PRO - RATE LIMIT SCAN")
        print(Fore.GREEN + "=" * 70)
        
        if endpoints is None:
            endpoints = Config.DEFAULT_ENDPOINTS
        
        if methods is None:
            methods = Config.HTTP_METHODS[:2]  # GET and POST by default
        
        print(Fore.CYAN + f"\n[*] Target: {self.base_url}")
        print(Fore.CYAN + f"[*] Profile: {self.profile}")
        print(Fore.CYAN + f"[*] Endpoints to test: {len(endpoints)}")
        print(Fore.CYAN + f"[*] Methods: {', '.join(methods)}")
        print(Fore.CYAN + f"[*] Threads: {self.threads}")
        
        # Run tests
        test_cases = []
        for endpoint in endpoints:
            for method in methods:
                test_cases.append((endpoint, method))
        
        results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.threads) as executor:
            # Submit all tests
            future_to_test = {
                executor.submit(self.test_endpoint, endpoint, method): (endpoint, method)
                for endpoint, method in test_cases
            }
            
            # Process results as they complete
            for i, future in enumerate(concurrent.futures.as_completed(future_to_test), 1):
                endpoint, method = future_to_test[future]
                
                try:
                    result = future.result(timeout=Config.REQUEST_TIMEOUT * 10)
                    results.append(result)
                    
                    # Print progress
                    severity_color = {
                        "CRITICAL": Fore.RED,
                        "HIGH": Fore.YELLOW,
                        "MEDIUM": Fore.CYAN,
                        "LOW": Fore.GREEN,
                        "INFO": Fore.WHITE
                    }.get(result["severity"], Fore.WHITE)
                    
                    print(f"{severity_color}[{result['severity']}] {result['method']} {result['endpoint']} - Score: {result['score']}")
                    
                except Exception as e:
                    print(Fore.RED + f"[!] Failed to test {endpoint} ({method}): {e}")
                
                # Progress update
                if i % 5 == 0:
                    print(Fore.BLUE + f"[Progress] {i}/{len(test_cases)} tests completed")
        
        self.findings = results
        
        # Print summary
        self._print_summary()
        
        return results
    
    def _print_summary(self):
        """Print scan summary"""
        if not self.findings:
            print(Fore.YELLOW + "\n[!] No findings to report")
            return
        
        print(Fore.GREEN + "\n" + "=" * 70)
        print(Fore.GREEN + "SCAN SUMMARY")
        print(Fore.GREEN + "=" * 70)
        
        # Group by severity
        severity_counts = Counter(f["severity"] for f in self.findings)
        
        print(f"\nTarget: {self.base_url}")
        print(f"Total Endpoints Tested: {len(self.findings)}")
        
        print("\nFindings by Severity:")
        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
            count = severity_counts.get(severity, 0)
            if count > 0:
                severity_color = {
                    "CRITICAL": Fore.RED + Style.BRIGHT,
                    "HIGH": Fore.YELLOW,
                    "MEDIUM": Fore.CYAN,
                    "LOW": Fore.GREEN,
                    "INFO": Fore.WHITE
                }.get(severity, Fore.WHITE)
                
                print(f"  {severity_color}{severity:<10}: {count}")
        
        # Top vulnerabilities
        all_vulnerabilities = []
        for finding in self.findings:
            all_vulnerabilities.extend(finding.get("vulnerabilities", []))
        
        if all_vulnerabilities:
            print("\nTop Vulnerabilities Found:")
            vuln_counts = Counter(all_vulnerabilities)
            for vuln, count in vuln_counts.most_common(5):
                print(f"  • {vuln} ({count} endpoints)")
        
        # Bypass techniques that worked
        successful_bypasses = []
        for finding in self.findings:
            for bypass in finding.get("bypass_results", []):
                if bypass.get("success"):
                    successful_bypasses.append(bypass.get("technique"))
        
        if successful_bypasses:
            print("\nSuccessful Bypass Techniques:")
            for technique in set(successful_bypasses):
                count = successful_bypasses.count(technique)
                print(f"  • {technique}: {count} endpoints")
        
        print(Fore.GREEN + "\n" + "=" * 70)
    
    def close(self):
        """Cleanup resources"""
        self.session.close()

# ==========================================================
# Enhanced Reporting Engine
# ==========================================================
class EnhancedReporter:
    @staticmethod
    def generate_reports(client, base_url, findings, scanner_stats=None):
        """Generate comprehensive reports in multiple formats"""
        timestamp = EnhancedUtilities.format_timestamp()
        safe_client = EnhancedUtilities.sanitize_filename(client)
        host = urlparse(base_url).hostname or "target"
        base_filename = f"{safe_client}_rateguard_{host}_{timestamp}"
        
        report_paths = {}
        
        # Sort findings by score
        findings.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        # Generate all report formats
        report_paths["txt"] = EnhancedReporter._generate_txt_report(
            client, base_url, findings, base_filename, scanner_stats
        )
        report_paths["json"] = EnhancedReporter._generate_json_report(
            client, base_url, findings, base_filename, scanner_stats
        )
        report_paths["csv"] = EnhancedReporter._generate_csv_report(
            client, base_url, findings, base_filename
        )
        report_paths["html"] = EnhancedReporter._generate_html_report(
            client, base_url, findings, base_filename, scanner_stats
        )
        report_paths["md"] = EnhancedReporter._generate_markdown_report(
            client, base_url, findings, base_filename, scanner_stats
        )
        
        return report_paths
    
    @staticmethod
    def _generate_txt_report(client, base_url, findings, base_filename, scanner_stats):
        """Generate detailed text report"""
        path = os.path.join(Config.TXT_DIR, base_filename + ".txt")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("ENHANCED RATEGUARD PRO - RATE LIMIT SECURITY REPORT\n")
            f.write("=" * 80 + "\n\n")
            
            f.write(f"Client: {client}\n")
            f.write(f"Target: {base_url}\n")
            f.write(f"Generated: {EnhancedUtilities.now_utc().isoformat()}\n")
            
            if scanner_stats:
                f.write(f"Scan Duration: {scanner_stats.get('duration', 'N/A')}\n")
                f.write(f"Total Requests: {scanner_stats.get('total_requests', 'N/A')}\n")
            
            f.write(f"Total Findings: {len(findings)}\n\n")
            
            # Summary by severity
            severity_counts = Counter(f["severity"] for f in findings)
            f.write("SEVERITY SUMMARY:\n")
            for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
                count = severity_counts.get(severity, 0)
                f.write(f"  {severity:<10} {count:>4}\n")
            f.write("\n")
            
            # Detailed findings
            for i, finding in enumerate(findings, 1):
                f.write("-" * 80 + "\n")
                f.write(f"FINDING #{i}: {finding['severity']} (Score: {finding['score']}/100)\n")
                f.write("-" * 80 + "\n\n")
                
                f.write(f"Endpoint: {finding['endpoint']}\n")
                f.write(f"URL:      {finding['url']}\n")
                f.write(f"Method:   {finding['method']}\n")
                f.write(f"Profile:  {finding['profile']}\n\n")
                
                # Burst test results
                f.write("BURST TEST RESULTS:\n")
                for burst_test in finding.get("burst_tests", []):
                    summary = burst_test.get("summary", {})
                    f.write(f"  Burst Size: {burst_test['burst_size']}\n")
                    f.write(f"    Success: {summary.get('successful_responses', 0)}/{summary.get('total_requests', 0)}\n")
                    f.write(f"    Blocked: {summary.get('blocked_responses', 0)}\n")
                    
                    status_codes = summary.get("status_codes", {})
                    if status_codes:
                        f.write(f"    Status Codes: {', '.join(f'{k}:{v}' for k, v in status_codes.items())}\n")
                    f.write("\n")
                
                # Analysis summary
                analysis = finding.get("analysis", {})
                if analysis:
                    f.write("ANALYSIS:\n")
                    for burst_size, anal in analysis.items():
                        if anal.get("rate_limit_detected"):
                            f.write(f"  Burst {burst_size}: Rate limiting detected ")
                            f.write(f"(Confidence: {anal.get('confidence', 0)}%, Type: {anal.get('limit_type', 'unknown')})\n")
                        else:
                            f.write(f"  Burst {burst_size}: No rate limiting detected\n")
                    f.write("\n")
                
                # Vulnerabilities
                vulnerabilities = finding.get("vulnerabilities", [])
                if vulnerabilities:
                    f.write("VULNERABILITIES:\n")
                    for vuln in set(vulnerabilities):  # Deduplicate
                        f.write(f"  • {vuln}\n")
                    f.write("\n")
                
                # Bypass results
                bypass_results = finding.get("bypass_results", [])
                if bypass_results:
                    successful = [r for r in bypass_results if r.get("success")]
                    if successful:
                        f.write("SUCCESSFUL BYPASS TECHNIQUES:\n")
                        for bypass in successful:
                            f.write(f"  • {bypass.get('technique')}\n")
                        f.write("\n")
                
                # Recommendations
                f.write("RECOMMENDATIONS:\n")
                recommendations = EnhancedReporter._generate_recommendations(finding)
                for rec in recommendations[:5]:
                    f.write(f"  • {rec}\n")
                
                f.write("\n")
        
        return path
    
    @staticmethod
    def _generate_json_report(client, base_url, findings, base_filename, scanner_stats):
        """Generate JSON report"""
        path = os.path.join(Config.JSON_DIR, base_filename + ".json")
        
        report_data = {
            "metadata": {
                "tool": "Enhanced RateGuard Pro v2.0",
                "client": client,
                "target": base_url,
                "generated": EnhancedUtilities.now_utc().isoformat(),
                "scanner_stats": scanner_stats or {}
            },
            "summary": {
                "total_findings": len(findings),
                "severity_counts": Counter(f["severity"] for f in findings),
                "risk_score_distribution": {
                    "0-20": len([f for f in findings if f["score"] <= 20]),
                    "21-40": len([f for f in findings if 21 <= f["score"] <= 40]),
                    "41-60": len([f for f in findings if 41 <= f["score"] <= 60]),
                    "61-80": len([f for f in findings if 61 <= f["score"] <= 80]),
                    "81-100": len([f for f in findings if f["score"] >= 81])
                }
            },
            "findings": findings
        }
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        return path
    
    @staticmethod
    def _generate_csv_report(client, base_url, findings, base_filename):
        """Generate CSV report"""
        path = os.path.join(Config.CSV_DIR, base_filename + ".csv")
        
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "severity", "score", "endpoint", "method", "url",
                "rate_limit_detected", "vulnerabilities", "bypass_successful"
            ])
            
            for finding in findings:
                rate_limit_detected = any(
                    analysis.get("rate_limit_detected", False)
                    for analysis in finding.get("analysis", {}).values()
                )
                
                vulnerabilities = "; ".join(set(finding.get("vulnerabilities", [])))[:200]
                
                bypass_successful = any(
                    r.get("success", False) for r in finding.get("bypass_results", [])
                )
                
                writer.writerow([
                    finding["severity"],
                    finding["score"],
                    finding["endpoint"],
                    finding["method"],
                    finding["url"],
                    rate_limit_detected,
                    vulnerabilities,
                    bypass_successful
                ])
        
        return path
    
    @staticmethod
    def _generate_html_report(client, base_url, findings, base_filename, scanner_stats):
        """Generate HTML report"""
        path = os.path.join(Config.HTML_DIR, base_filename + ".html")
        
        severity_colors = {
            "CRITICAL": "#dc3545",
            "HIGH": "#fd7e14",
            "MEDIUM": "#ffc107",
            "LOW": "#28a745",
            "INFO": "#6c757d"
        }
        
        # Calculate statistics
        severity_counts = Counter(f["severity"] for f in findings)
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rate Limit Security Report - {client}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f8f9fa;
            color: #333;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .severity-badge {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            margin-right: 10px;
        }}
        .finding-card {{
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            background: #fff;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .summary-item {{
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            background: #f8f9fa;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }}
        th {{
            background: #f8f9fa;
            font-weight: 600;
        }}
        .vulnerability {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 5px 0;
            border-radius: 0 4px 4px 0;
        }}
        .recommendation {{
            background: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 10px;
            margin: 5px 0;
            border-radius: 0 4px 4px 0;
        }}
        @media (max-width: 768px) {{
            .container {{ padding: 15px; }}
            .summary-grid {{ grid-template-columns: 1fr; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #007bff;">Rate Limit Security Analysis Report</h1>
            <p><strong>Client:</strong> {client} | <strong>Target:</strong> {base_url}</p>
            <p><strong>Generated:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </div>
        
        <div class="summary">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
"""
        
        # Severity counts
        for severity, color in severity_colors.items():
            count = severity_counts.get(severity, 0)
            html += f"""
                <div class="summary-item">
                    <div style="font-size: 32px; font-weight: bold; color: {color};">{count}</div>
                    <div style="font-size: 14px; color: #666;">{severity}</div>
                </div>
"""
        
        html += f"""
            </div>
            <p><strong>Total Findings:</strong> {len(findings)}</p>
            <p><strong>Scan Profile:</strong> {(scanner_stats or {{}}).get('profile', 'balanced')}</p>
        </div>
        
        <h2>Detailed Findings</h2>
"""
        
        # Detailed findings
        for i, finding in enumerate(findings, 1):
            severity = finding["severity"]
            color = severity_colors.get(severity, "#6c757d")
            
            html += f"""
        <div class="finding-card">
            <h3>
                <span class="severity-badge" style="background: {color};">{severity}</span>
                Finding #{i}: {finding['endpoint']}
                <span style="float: right; color: #666;">Score: {finding['score']}/100</span>
            </h3>
            
            <p><strong>URL:</strong> {finding['url']}</p>
            <p><strong>Method:</strong> {finding['method']} | <strong>Profile:</strong> {finding['profile']}</p>
            
            <h4>Test Results:</h4>
            <table>
                <tr><th>Burst Size</th><th>Success</th><th>Blocked</th><th>Rate Limit Detected</th></tr>
"""
            
            for burst_test in finding.get("burst_tests", []):
                summary = burst_test.get("summary", {})
                analysis = finding.get("analysis", {}).get(burst_test["burst_size"], {})
                
                success = summary.get("successful_responses", 0)
                total = summary.get("total_requests", 0)
                blocked = summary.get("blocked_responses", 0)
                detected = "Yes" if analysis.get("rate_limit_detected") else "No"
                
                html += f"""
                <tr>
                    <td>{burst_test['burst_size']}</td>
                    <td>{success}/{total}</td>
                    <td>{blocked}</td>
                    <td>{detected}</td>
                </tr>
"""
            
            html += """
            </table>
"""
            
            # Vulnerabilities
            vulnerabilities = finding.get("vulnerabilities", [])
            if vulnerabilities:
                html += "<h4>Vulnerabilities:</h4>\n"
                for vuln in set(vulnerabilities):
                    html += f'<div class="vulnerability">{vuln}</div>\n'
            
            # Bypass results
            bypass_results = [r for r in finding.get("bypass_results", []) if r.get("success")]
            if bypass_results:
                html += "<h4>Successful Bypasses:</h4><ul>\n"
                for bypass in bypass_results:
                    html += f"<li>{bypass.get('technique')}</li>\n"
                html += "</ul>\n"
            
            # Recommendations
            recommendations = EnhancedReporter._generate_recommendations(finding)
            if recommendations:
                html += "<h4>Recommendations:</h4>\n"
                for rec in recommendations[:3]:
                    html += f'<div class="recommendation">{rec}</div>\n'
            
            html += "</div>\n"
        
        html += """
        <footer style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666;">
            <p>Generated by Enhanced RateGuard Pro v2.0</p>
            <p>For authorized security testing only. Unauthorized testing is illegal.</p>
        </footer>
    </div>
</body>
</html>
"""
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        
        return path
    
    @staticmethod
    def _generate_markdown_report(client, base_url, findings, base_filename, scanner_stats):
        """Generate Markdown report"""
        path = os.path.join(Config.MARKDOWN_DIR, base_filename + ".md")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"# Rate Limit Security Analysis Report\n\n")
            f.write(f"**Client:** {client}  \n")
            f.write(f"**Target:** {base_url}  \n")
            f.write(f"**Generated:** {EnhancedUtilities.now_utc().isoformat()}  \n")
            f.write(f"**Total Findings:** {len(findings)}\n\n")
            
            # Summary
            severity_counts = Counter(f["severity"] for f in findings)
            f.write("## Executive Summary\n\n")
            f.write("| Severity | Count |\n")
            f.write("|----------|-------|\n")
            for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
                count = severity_counts.get(severity, 0)
                f.write(f"| {severity} | {count} |\n")
            f.write("\n")
            
            # Detailed findings
            f.write("## Detailed Findings\n\n")
            for i, finding in enumerate(findings, 1):
                f.write(f"### Finding #{i}: {finding['severity']} (Score: {finding['score']}/100)\n\n")
                f.write(f"**Endpoint:** {finding['endpoint']}  \n")
                f.write(f"**URL:** {finding['url']}  \n")
                f.write(f"**Method:** {finding['method']}  \n")
                f.write(f"**Profile:** {finding['profile']}\n\n")
                
                f.write("**Test Results:**  \n")
                f.write("| Burst Size | Success | Blocked | Rate Limit Detected |\n")
                f.write("|------------|---------|---------|---------------------|\n")
                
                for burst_test in finding.get("burst_tests", []):
                    summary = burst_test.get("summary", {})
                    analysis = finding.get("analysis", {}).get(burst_test["burst_size"], {})
                    
                    success = summary.get("successful_responses", 0)
                    total = summary.get("total_requests", 0)
                    blocked = summary.get("blocked_responses", 0)
                    detected = "Yes" if analysis.get("rate_limit_detected") else "No"
                    
                    f.write(f"| {burst_test['burst_size']} | {success}/{total} | {blocked} | {detected} |\n")
                
                f.write("\n")
                
                # Vulnerabilities
                vulnerabilities = finding.get("vulnerabilities", [])
                if vulnerabilities:
                    f.write("**Vulnerabilities:**  \n")
                    for vuln in set(vulnerabilities):
                        f.write(f"- {vuln}  \n")
                    f.write("\n")
                
                # Recommendations
                recommendations = EnhancedReporter._generate_recommendations(finding)
                if recommendations:
                    f.write("**Recommendations:**  \n")
                    for rec in recommendations[:3]:
                        f.write(f"- {rec}  \n")
                    f.write("\n")
                
                f.write("---\n\n")
        
        return path
    
    @staticmethod
    def _generate_recommendations(finding):
        """Generate recommendations based on finding"""
        recommendations = []
        severity = finding["severity"]
        
        if severity in ["CRITICAL", "HIGH"]:
            recommendations.extend([
                "Implement immediate rate limiting with appropriate thresholds",
                "Use 429 status codes with Retry-After headers for blocked requests",
                "Implement IP-based rate limiting for unauthenticated endpoints",
                "Add user-based rate limiting for authenticated endpoints",
                "Consider implementing a WAF with rate limiting capabilities",
                "Monitor and log all rate limit violations",
                "Implement exponential backoff for repeated violations"
            ])
        
        elif severity == "MEDIUM":
            recommendations.extend([
                "Review and adjust rate limit thresholds",
                "Ensure rate limiting is consistent across all API endpoints",
                "Add rate limit headers (X-RateLimit-*) for client visibility",
                "Implement different rate limits for different user roles",
                "Consider implementing sliding window rate limiting"
            ])
        
        # Check for specific vulnerabilities
        vulnerabilities = finding.get("vulnerabilities", [])
        for vuln in vulnerabilities:
            if "no rate limiting" in vuln.lower():
                recommendations.append("Implement rate limiting immediately - this is a critical vulnerability")
            elif "bypass" in vuln.lower():
                recommendations.append("Strengthen rate limit enforcement - bypass techniques were successful")
            elif "sensitive endpoint" in vuln.lower():
                recommendations.append("Add stricter rate limits to sensitive endpoints")
            elif "low threshold" in vuln.lower():
                recommendations.append("Adjust rate limit thresholds to balance security and usability")
        
        # General recommendations
        recommendations.extend([
            "Regularly test rate limit configurations",
            "Implement rate limit monitoring and alerting",
            "Document rate limit policies for API consumers",
            "Consider using API gateway rate limiting features",
            "Test rate limits under load to ensure they work as expected"
        ])
        
        return list(set(recommendations))  # Remove duplicates

# ==========================================================
# Enhanced CLI Interface
# ==========================================================
def main():
    """Enhanced CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Enhanced RateGuard Pro - Comprehensive Rate Limit Security Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --url https://api.example.com
  %(prog)s --url https://example.com --profile aggressive --threads 20
  %(prog)s --url https://api.example.com --client "ACME Corp" --endpoints-file endpoints.txt
        """
    )
    
    parser.add_argument("--url", required=True, help="Base URL to scan")
    parser.add_argument("--client", default="client", help="Client name")
    parser.add_argument("--threads", type=int, default=Config.DEFAULT_THREADS,
                       help=f"Number of threads (default: {Config.DEFAULT_THREADS})")
    parser.add_argument("--profile", choices=list(Config.PROFILES.keys()), default="balanced",
                       help="Scan profile: stealth, balanced, aggressive, bruteforce")
    parser.add_argument("--endpoints-file", help="File containing custom endpoints (one per line)")
    parser.add_argument("--methods", default="GET,POST",
                       help="HTTP methods to test (comma-separated, default: GET,POST)")
    parser.add_argument("--output-format", default="txt,json,csv,html,md",
                       help="Output formats (comma-separated)")
    parser.add_argument("--no-ssl-verify", action="store_true", help="Disable SSL verification")
    
    args = parser.parse_args()
    
    print(Fore.GREEN + "=" * 70)
    print(Fore.GREEN + "ENHANCED RATEGUARD PRO v2.0")
    print(Fore.GREEN + "=" * 70)
    
    # Validate URL
    base_url = args.url
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url
    
    # Load custom endpoints if provided
    endpoints = None
    if args.endpoints_file and os.path.isfile(args.endpoints_file):
        try:
            with open(args.endpoints_file, "r", encoding="utf-8") as f:
                endpoints = [line.strip() for line in f if line.strip()]
            print(Fore.GREEN + f"[*] Loaded {len(endpoints)} custom endpoints")
        except Exception as e:
            print(Fore.YELLOW + f"[!] Failed to load endpoints file: {e}")
    
    # Parse methods
    methods = [m.strip().upper() for m in args.methods.split(",")]
    
    # Permission confirmation
    print(Fore.YELLOW + "\n[!] WARNING: This tool performs aggressive rate limit testing.")
    print(Fore.YELLOW + "[!] Ensure you have explicit permission to scan the target system.")
    print(Fore.YELLOW + "[!] Testing without permission may be illegal and cause service disruption.")
    
    confirm = input("\nType 'YES' to confirm authorization: ").strip()
    if confirm != "YES":
        print(Fore.RED + "Permission not granted. Exiting.")
        return
    
    # Create scanner
    scanner = EnhancedRateGuard(
        base_url=base_url,
        threads=args.threads,
        profile=args.profile
    )
    
    # Run scan
    start_time = time.time()
    
    try:
        print(Fore.CYAN + f"\n[*] Starting rate limit scan...")
        findings = scanner.run_scan(endpoints=endpoints, methods=methods)
        
        # Calculate scan statistics
        duration = time.time() - start_time
        total_requests = sum(
            sum(bt.get("summary", {}).get("total_requests", 0) for bt in f.get("burst_tests", []))
            for f in findings
        )
        
        scanner_stats = {
            "duration": f"{duration:.1f}s",
            "total_requests": total_requests,
            "profile": args.profile,
            "threads": args.threads
        }
        
        # Generate reports
        output_formats = [fmt.strip() for fmt in args.output_format.split(",")]
        
        print(Fore.CYAN + "\n[*] Generating reports...")
        report_paths = EnhancedReporter.generate_reports(
            client=args.client,
            base_url=base_url,
            findings=findings,
            scanner_stats=scanner_stats
        )
        
        # Print report locations
        print(Fore.GREEN + "\n[*] Reports generated:")
        for fmt, path in report_paths.items():
            print(Fore.CYAN + f"    {fmt.upper()}: {os.path.abspath(path)}")
        
        # Critical findings warning
        critical_count = len([f for f in findings if f["severity"] in ["CRITICAL", "HIGH"]])
        if critical_count > 0:
            print(Fore.RED + f"\n[!] CRITICAL: Found {critical_count} high-risk vulnerabilities!")
            print(Fore.RED + "[!] Immediate remediation is required.")
        
        print(Fore.GREEN + "\n[*] Scan completed successfully.")
        
    except KeyboardInterrupt:
        print(Fore.YELLOW + "\n[!] Scan interrupted by user.")
    except Exception as e:
        print(Fore.RED + f"\n[!] Error during scan: {e}")
    finally:
        scanner.close()

if __name__ == "__main__":
    main()