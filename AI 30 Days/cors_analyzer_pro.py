# enhanced_cors_security_analyzer.py
import os
import re
import json
import random
import threading
import queue
import csv
import time
import socket
import ipaddress
import urllib3
import argparse
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Disable warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Optional imports with fallbacks
try:
    from colorama import init, Fore, Style, Back
    init(autoreset=True)
    COLORS_ENABLED = True
except:
    COLORS_ENABLED = False
    class DummyColors:
        def __getattr__(self, name):
            return ""
    Fore = Style = Back = DummyColors()

# =========================
# ENHANCED CONFIGURATION
# =========================
class Config:
    # Output directories
    OUTPUT_BASE = os.path.join("reports", "cors_enhanced")
    TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
    JSON_DIR = os.path.join(OUTPUT_BASE, "json")
    CSV_DIR = os.path.join(OUTPUT_BASE, "csv")
    HTML_DIR = os.path.join(OUTPUT_BASE, "html")
    MARKDOWN_DIR = os.path.join(OUTPUT_BASE, "markdown")
    
    for dir_path in [TXT_DIR, JSON_DIR, CSV_DIR, HTML_DIR, MARKDOWN_DIR]:
        os.makedirs(dir_path, exist_ok=True)
    
    # Performance settings
    THREADS_DEFAULT = 15
    MAX_THREADS = 50
    REQUEST_TIMEOUT = 10
    MAX_RETRIES = 2
    REQUEST_DELAY = 0.05  # seconds between requests
    MAX_REQUESTS_PER_MINUTE = 300
    
    # Enhanced endpoints for testing
    DEFAULT_ENDPOINTS = [
        "/", "/api", "/api/v1", "/api/v2", "/api/v3",
        "/graphql", "/graphql/v1", "/rest", "/rest/v1",
        "/auth", "/oauth2", "/oauth2/token", "/oauth2/auth",
        "/login", "/signin", "/register", "/signup",
        "/users", "/users/profile", "/users/me",
        "/admin", "/admin/api", "/admin/rest",
        "/wp-json/", "/wp-json/wp/v2/",
        "/json", "/jsonrpc", "/xmlrpc",
        "/data", "/data/api", "/data/rest",
        "/private", "/secure", "/internal",
        "/profile", "/account", "/settings",
        "/config", "/configuration",
        "/export", "/download", "/upload",
        "/search", "/query", "/filter",
        "/metrics", "/health", "/status",
        "/debug", "/test", "/demo"
    ]
    
    # Enhanced malicious origins for testing
    MALICIOUS_ORIGINS = {
        # Basic malicious domains
        "basic": [
            "https://evil.com",
            "https://attacker.com",
            "https://malicious.site",
            "https://hacker.io",
            "https://phishing.com",
            "https://xss.me",
            "https://steal.data"
        ],
        
        # Subdomains and variations
        "subdomains": [
            "https://sub.evil.com",
            "https://api.evil.com",
            "https://www.evil.com",
            "https://admin.evil.com",
            "https://test.evil.com",
            "https://staging.evil.com",
            "https://prod.evil.com"
        ],
        
        # Localhost and internal addresses
        "localhost": [
            "http://localhost",
            "http://localhost:3000",
            "http://localhost:8080",
            "http://127.0.0.1",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8080",
            "http://0.0.0.0",
            "http://0.0.0.0:8080"
        ],
        
        # Internal network addresses
        "internal": [
            "http://10.0.0.1",
            "http://192.168.1.1",
            "http://172.16.0.1",
            "https://intranet.local",
            "https://internal.company.com"
        ],
        
        # Protocol variations
        "protocols": [
            "http://evil.com",
            "https://evil.com:8443",
            "http://evil.com:80",
            "https://evil.com:443",
            "file://evil.com",
            "ftp://evil.com",
            "chrome-extension://aabbcc",
            "moz-extension://aabbcc",
            "about:blank",
            "data:text/html,test"
        ],
        
        # Special values
        "special": [
            "null",
            "",
            "*",
            "*.evil.com",
            ".evil.com",
            "EVIL.COM",
            "Evil.Com",
            "%20",
            "%00",
            "https://evil.com%00.example.com",
            "https://evil.com\n.example.com",
            "https://evil.com\r.example.com",
            "https://evil.com\t.example.com",
            "https://evil.com .example.com"
        ],
        
        # Encoded and obfuscated
        "encoded": [
            "https://%65vil.com",
            "https://evil%2ecom",
            "https://evil.com%2f..",
            "https://evil%252ecom",
            "https://evil.com%3f",
            "https://evil.com%23"
        ],
        
        # Trusted domains (for testing trust misconfigurations)
        "trusted": [
            "https://example.com",
            "https://trusted.com",
            "https://partner.com",
            "https://api.partner.com"
        ]
    }
    
    # HTTP Methods for testing
    HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
    
    # CORS Headers to check
    CORS_HEADERS = [
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Credentials",
        "Access-Control-Allow-Methods",
        "Access-Control-Allow-Headers",
        "Access-Control-Expose-Headers",
        "Access-Control-Max-Age",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Vary"
    ]
    
    # Security headers to analyze
    SECURITY_HEADERS = [
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "X-XSS-Protection",
        "Strict-Transport-Security",
        "Referrer-Policy",
        "Feature-Policy",
        "Permissions-Policy"
    ]
    
    # Sensitive endpoints that should have strict CORS
    SENSITIVE_ENDPOINTS = [
        "/api/login", "/api/token", "/api/auth",
        "/admin", "/admin/*", "/config",
        "/users/*/profile", "/users/*/password",
        "/data/export", "/data/import",
        "/settings", "/account/*"
    ]

# =========================
# ENHANCED UTILITIES
# =========================
class EnhancedUtilities:
    @staticmethod
    def now_utc():
        return datetime.now(timezone.utc).isoformat()
    
    @staticmethod
    def format_timestamp():
        return datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    
    @staticmethod
    def sanitize_filename(filename):
        """Sanitize filename for safe filesystem use"""
        return re.sub(r'[^\w\-_\. ]', '_', filename)[:100]
    
    @staticmethod
    def calculate_risk_score(headers, origin, method, status_code, endpoint):
        """Enhanced risk scoring algorithm"""
        score = 0
        findings = []
        
        acao = headers.get("Access-Control-Allow-Origin", "").strip()
        acac = headers.get("Access-Control-Allow-Credentials", "").strip().lower()
        
        # Check for wildcard with credentials (CRITICAL)
        if acao == "*" and acac == "true":
            score = 100
            findings.append("CRITICAL: Wildcard origin with credentials allowed")
        
        # Check for reflected origin with credentials (HIGH)
        elif acao == origin and acac == "true":
            score = 95
            findings.append("HIGH: Origin reflection with credentials allowed")
        
        # Check for wildcard without credentials (MEDIUM-HIGH)
        elif acao == "*":
            score = 75
            findings.append("MEDIUM-HIGH: Wildcard origin allowed")
            # Additional risk if sensitive endpoint
            if any(ep in endpoint for ep in ["/api/", "/admin", "/auth", "/login"]):
                score += 10
                findings.append("Enhanced risk: Wildcard on sensitive endpoint")
        
        # Check for reflected origin (MEDIUM)
        elif acao == origin:
            score = 65
            findings.append("MEDIUM: Origin reflection allowed")
        
        # Check for null origin (MEDIUM)
        elif origin == "null" and acao == "null":
            score = 70
            findings.append("MEDIUM: Null origin allowed")
        
        # Check for loose matching (e.g., example.com allows *.example.com)
        elif acao.startswith("*.") and origin.endswith(acao[2:]):
            score = 60
            findings.append("MEDIUM: Subdomain wildcard match")
        
        # Check for multiple origins in Vary header
        vary = headers.get("Vary", "").lower()
        if "origin" in vary:
            score = max(score, 30)
            findings.append("INFO: Origin in Vary header")
        
        # Check for insecure protocols
        if origin.startswith("http://") and "https://" not in origin:
            score = max(score + 5, score)
            findings.append("LOW: HTTP origin tested")
        
        # Check for exposed headers
        acah = headers.get("Access-Control-Expose-Headers", "")
        if acah:
            exposed = [h.strip() for h in acah.split(",")]
            sensitive_headers = ["authorization", "cookie", "set-cookie", "x-api-key"]
            if any(sh in [eh.lower() for eh in exposed] for sh in sensitive_headers):
                score += 15
                findings.append("MEDIUM: Sensitive headers exposed")
        
        # Check for overly permissive methods
        acam = headers.get("Access-Control-Allow-Methods", "")
        if acam:
            methods = [m.strip().upper() for m in acam.split(",")]
            dangerous_methods = ["DELETE", "PUT", "POST", "PATCH"]
            if all(dm in methods for dm in dangerous_methods):
                score += 10
                findings.append("MEDIUM: Overly permissive methods allowed")
        
        # Check for long cache duration
        acma = headers.get("Access-Control-Max-Age", "")
        if acma and acma.isdigit() and int(acma) > 86400:  # More than 1 day
            score += 5
            findings.append("LOW: Long CORS cache duration")
        
        # Cap score at 100
        score = min(100, score)
        
        return score, findings
    
    @staticmethod
    def generate_origins(category="all"):
        """Generate origins based on category"""
        if category == "all":
            origins = []
            for cat_origins in Config.MALICIOUS_ORIGINS.values():
                origins.extend(cat_origins)
        elif category in Config.MALICIOUS_ORIGINS:
            origins = Config.MALICIOUS_ORIGINS[category]
        else:
            origins = Config.MALICIOUS_ORIGINS["basic"]
        
        # Add some randomized variations
        randomized = []
        for origin in origins[:20]:  # Limit to first 20
            if "evil.com" in origin:
                randomized.append(origin.replace("evil.com", f"evil{random.randint(100,999)}.com"))
        
        origins.extend(randomized[:5])
        return list(set(origins))  # Deduplicate
    
    @staticmethod
    def is_sensitive_endpoint(endpoint):
        """Check if endpoint is sensitive"""
        endpoint_lower = endpoint.lower()
        sensitive_keywords = ["login", "auth", "admin", "token", "password", 
                            "secret", "config", "setting", "profile", "account"]
        return any(keyword in endpoint_lower for keyword in sensitive_keywords)
    
    @staticmethod
    def extract_subdomains(domain):
        """Extract subdomains from a domain"""
        if not domain:
            return []
        
        parts = domain.split('.')
        if len(parts) < 2:
            return []
        
        subdomains = []
        for i in range(len(parts) - 1):
            subdomains.append('.'.join(parts[i:]))
        
        return subdomains

# =========================
# ENHANCED HTTP SESSION
# =========================
class ResilientSession:
    def __init__(self, timeout=Config.REQUEST_TIMEOUT, max_retries=Config.MAX_RETRIES):
        self.session = requests.Session()
        self.timeout = timeout
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Default headers
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/html, application/xhtml+xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive"
        })
    
    def request(self, method, url, **kwargs):
        """Make HTTP request with error handling"""
        try:
            response = self.session.request(
                method=method,
                url=url,
                timeout=self.timeout,
                verify=False,  # Disable SSL verification for testing
                allow_redirects=True,
                **kwargs
            )
            
            # Collect response data
            result = {
                "url": response.url,
                "method": method,
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "content": response.content,
                "text": response.text,
                "elapsed": response.elapsed.total_seconds(),
                "history": [{
                    "status_code": r.status_code,
                    "url": r.url,
                    "headers": dict(r.headers)
                } for r in response.history],
                "cookies": {c.name: c.value for c in response.cookies},
                "timestamp": EnhancedUtilities.now_utc()
            }
            
            return result
            
        except requests.exceptions.Timeout:
            return {
                "url": url,
                "method": method,
                "status_code": 0,
                "error": "Timeout",
                "timestamp": EnhancedUtilities.now_utc()
            }
        except requests.exceptions.ConnectionError:
            return {
                "url": url,
                "method": method,
                "status_code": 0,
                "error": "ConnectionError",
                "timestamp": EnhancedUtilities.now_utc()
            }
        except Exception as e:
            return {
                "url": url,
                "method": method,
                "status_code": 0,
                "error": str(e),
                "timestamp": EnhancedUtilities.now_utc()
            }
    
    def close(self):
        self.session.close()

# =========================
# ENHANCED CORS ANALYZER
# =========================
class EnhancedCORSAnalyzer:
    def __init__(self, base_url, threads=Config.THREADS_DEFAULT):
        self.base_url = base_url.rstrip("/")
        self.threads = min(max(1, threads), Config.MAX_THREADS)
        self.session = ResilientSession()
        self.findings = []
        self.stats = defaultdict(int)
        self.lock = threading.Lock()
        self.rate_limiter = threading.Semaphore(Config.MAX_REQUESTS_PER_MINUTE // 60)
        
        # Parse base URL for information
        parsed = urlparse(base_url)
        self.target_domain = parsed.hostname
        self.target_port = parsed.port
        self.target_scheme = parsed.scheme
        
    def analyze_cors_policy(self, headers, origin, endpoint, method):
        """Comprehensive CORS policy analysis"""
        analysis = {
            "vulnerabilities": [],
            "warnings": [],
            "informational": [],
            "risk_score": 0,
            "severity": "INFO"
        }
        
        acao = headers.get("Access-Control-Allow-Origin", "").strip()
        acac = headers.get("Access-Control-Allow-Credentials", "").strip().lower()
        
        # 1. Check for wildcard with credentials (CRITICAL)
        if acao == "*" and acac == "true":
            analysis["vulnerabilities"].append(
                "CRITICAL: Wildcard origin with credentials enabled. "
                "This allows any origin to make authenticated requests."
            )
            analysis["risk_score"] = 100
        
        # 2. Check for reflected origin with credentials (HIGH)
        elif acao == origin and acac == "true":
            analysis["vulnerabilities"].append(
                "HIGH: Origin reflection with credentials enabled. "
                "Attackers can craft requests that reflect their origin."
            )
            analysis["risk_score"] = 95
        
        # 3. Check for null origin (MEDIUM-HIGH)
        elif origin == "null" and acao == "null":
            analysis["vulnerabilities"].append(
                "MEDIUM: Null origin allowed. "
                "This can be exploited via sandboxed iframes or local files."
            )
            analysis["risk_score"] = 70
        
        # 4. Check for wildcard without credentials (MEDIUM)
        elif acao == "*":
            analysis["vulnerabilities"].append(
                "MEDIUM: Wildcard origin allowed. "
                "While credentials aren't shared, sensitive data may still leak."
            )
            analysis["risk_score"] = 75
            
            # Additional risk for sensitive endpoints
            if EnhancedUtilities.is_sensitive_endpoint(endpoint):
                analysis["risk_score"] = 80
                analysis["vulnerabilities"].append(
                    "ENHANCED RISK: Wildcard on sensitive endpoint"
                )
        
        # 5. Check for reflected origin (MEDIUM)
        elif acao == origin:
            analysis["warnings"].append(
                "MEDIUM: Origin reflection detected. "
                "Could be exploited if origin validation is bypassed."
            )
            analysis["risk_score"] = 65
        
        # 6. Check for subdomain wildcard
        elif acao.startswith("*.") and origin.endswith(acao[2:]):
            analysis["warnings"].append(
                "MEDIUM: Subdomain wildcard match. "
                "Allows all subdomains of the specified domain."
            )
            analysis["risk_score"] = 60
        
        # 7. Check for multiple values
        if "," in acao:
            analysis["vulnerabilities"].append(
                "HIGH: Multiple origins in ACAO header. "
                "This is invalid per CORS specification."
            )
            analysis["risk_score"] = max(analysis["risk_score"], 85)
        
        # 8. Check for regex patterns (basic detection)
        if any(char in acao for char in ["*", "+", "?", "[", "]", "(", ")"]):
            analysis["informational"].append(
                "Pattern matching detected in ACAO header"
            )
        
        # 9. Check Access-Control-Allow-Methods
        acam = headers.get("Access-Control-Allow-Methods", "")
        if acam:
            methods = [m.strip().upper() for m in acam.split(",")]
            dangerous_methods = ["DELETE", "PUT", "POST", "PATCH"]
            if all(dm in methods for dm in dangerous_methods):
                analysis["warnings"].append(
                    "MEDIUM: Overly permissive HTTP methods allowed"
                )
                analysis["risk_score"] = max(analysis["risk_score"], 50)
        
        # 10. Check Access-Control-Expose-Headers
        aceh = headers.get("Access-Control-Expose-Headers", "")
        if aceh:
            exposed = [h.strip().lower() for h in aceh.split(",")]
            sensitive_headers = ["authorization", "cookie", "set-cookie", 
                               "x-api-key", "x-csrf-token", "x-auth-token"]
            
            exposed_sensitive = [h for h in exposed if h in sensitive_headers]
            if exposed_sensitive:
                analysis["vulnerabilities"].append(
                    f"HIGH: Sensitive headers exposed: {', '.join(exposed_sensitive)}"
                )
                analysis["risk_score"] = max(analysis["risk_score"], 85)
        
        # 11. Check Access-Control-Max-Age
        acma = headers.get("Access-Control-Max-Age", "")
        if acma and acma.isdigit():
            age = int(acma)
            if age > 86400:  # More than 1 day
                analysis["warnings"].append(
                    f"LOW: Long CORS cache duration ({age} seconds)"
                )
        
        # 12. Check Vary header
        vary = headers.get("Vary", "").lower()
        if "origin" not in vary and acao != "*":
            analysis["warnings"].append(
                "MEDIUM: Origin not in Vary header. "
                "May cause cache poisoning attacks."
            )
            analysis["risk_score"] = max(analysis["risk_score"], 40)
        
        # 13. Check for security headers
        security_headers_present = []
        for header in Config.SECURITY_HEADERS:
            if header in headers:
                security_headers_present.append(header)
        
        if security_headers_present:
            analysis["informational"].append(
                f"Security headers present: {', '.join(security_headers_present)}"
            )
        
        # Determine severity based on risk score
        if analysis["risk_score"] >= 90:
            analysis["severity"] = "CRITICAL"
        elif analysis["risk_score"] >= 70:
            analysis["severity"] = "HIGH"
        elif analysis["risk_score"] >= 40:
            analysis["severity"] = "MEDIUM"
        elif analysis["risk_score"] >= 10:
            analysis["severity"] = "LOW"
        else:
            analysis["severity"] = "INFO"
        
        return analysis
    
    def test_endpoint(self, endpoint, origin, method="GET", preflight=True):
        """Test a single endpoint with specific origin and method"""
        url = urljoin(self.base_url + "/", endpoint.lstrip("/"))
        
        with self.rate_limiter:
            time.sleep(Config.REQUEST_DELAY)
            
            # Prepare headers
            headers = {"Origin": origin}
            
            # First, test preflight if requested
            preflight_response = None
            if preflight and method != "GET":
                headers["Access-Control-Request-Method"] = method
                preflight_response = self.session.request("OPTIONS", url, headers=headers)
            
            # Test actual request
            actual_response = self.session.request(method, url, headers=headers)
            
            # If preflight failed but actual succeeded, that's interesting
            if preflight_response and preflight_response.get("status_code") not in [200, 204]:
                if actual_response.get("status_code") in [200, 201, 204]:
                    # CORS might be misconfigured - preflight not required but should be
                    pass
            
            # Analyze responses
            all_headers = {}
            if actual_response and "headers" in actual_response:
                all_headers.update(actual_response["headers"])
            
            if preflight_response and "headers" in preflight_response:
                # Preflight headers take precedence for CORS analysis
                all_headers.update(preflight_response["headers"])
            
            # Check if CORS headers are present
            cors_headers_present = any(h in all_headers for h in Config.CORS_HEADERS)
            
            if not cors_headers_present:
                return None
            
            # Analyze CORS policy
            analysis = self.analyze_cors_policy(all_headers, origin, endpoint, method)
            
            if analysis["risk_score"] > 0:
                finding = {
                    "endpoint": endpoint,
                    "url": url,
                    "method": method,
                    "origin_tested": origin,
                    "status_code": actual_response.get("status_code", 0) if actual_response else 0,
                    "cors_headers": {k: v for k, v in all_headers.items() if k in Config.CORS_HEADERS},
                    "analysis": analysis,
                    "risk_score": analysis["risk_score"],
                    "severity": analysis["severity"],
                    "timestamp": EnhancedUtilities.now_utc(),
                    "preflight_tested": preflight,
                    "preflight_status": preflight_response.get("status_code") if preflight_response else None
                }
                
                return finding
        
        return None
    
    def discover_endpoints(self, max_endpoints=50):
        """Discover additional endpoints to test"""
        discovered = set(Config.DEFAULT_ENDPOINTS)
        
        # Try common API patterns
        common_patterns = [
            "/api/v{}/users".format(i) for i in range(1, 4)
        ] + [
            "/api/v{}/products".format(i) for i in range(1, 4)
        ] + [
            "/api/v{}/orders".format(i) for i in range(1, 4)
        ]
        
        discovered.update(common_patterns)
        
        # Try to find endpoints from robots.txt
        try:
            robots_url = urljoin(self.base_url + "/", "robots.txt")
            response = self.session.request("GET", robots_url)
            if response.get("status_code") == 200:
                # Extract paths from robots.txt
                lines = response.get("text", "").split("\n")
                for line in lines:
                    if line.lower().startswith(("allow:", "disallow:")):
                        path = line.split(":", 1)[1].strip()
                        if path and path != "/" and not path.startswith("*"):
                            discovered.add(path)
        except:
            pass
        
        # Try common files
        common_files = [
            "/sitemap.xml", "/sitemap.txt", "/sitemap.json",
            "/api-docs", "/swagger.json", "/openapi.json",
            "/redoc", "/docs", "/documentation"
        ]
        
        discovered.update(common_files)
        
        return list(discovered)[:max_endpoints]
    
    def run_scan(self, endpoints=None, origins=None, methods=None, 
                 preflight=True, max_tests_per_endpoint=5):
        """Run comprehensive CORS scan"""
        print(Fore.CYAN + f"[*] Starting CORS scan for: {self.base_url}")
        print(Fore.CYAN + f"[*] Threads: {self.threads}")
        
        # Prepare test parameters
        if endpoints is None:
            endpoints = self.discover_endpoints()
        
        if origins is None:
            origins = EnhancedUtilities.generate_origins("all")[:20]  # Limit origins
        
        if methods is None:
            methods = ["GET", "POST"]
        
        # Generate test cases
        test_cases = []
        for endpoint in endpoints:
            for origin in origins[:max_tests_per_endpoint]:  # Limit per endpoint
                for method in methods:
                    test_cases.append((endpoint, origin, method))
        
        print(Fore.CYAN + f"[*] Total test cases: {len(test_cases)}")
        
        # Run tests with thread pool
        with ThreadPoolExecutor(max_workers=self.threads) as executor:
            futures = []
            for endpoint, origin, method in test_cases:
                future = executor.submit(
                    self.test_endpoint,
                    endpoint, origin, method, preflight
                )
                futures.append(future)
            
            # Collect results
            for i, future in enumerate(as_completed(futures), 1):
                try:
                    result = future.result(timeout=Config.REQUEST_TIMEOUT + 5)
                    if result:
                        with self.lock:
                            self.findings.append(result)
                            self.stats[result["severity"]] += 1
                            
                            # Print finding
                            severity_color = {
                                "CRITICAL": Fore.RED + Style.BRIGHT,
                                "HIGH": Fore.RED,
                                "MEDIUM": Fore.YELLOW,
                                "LOW": Fore.GREEN,
                                "INFO": Fore.CYAN
                            }.get(result["severity"], Fore.WHITE)
                            
                            print(f"{severity_color}[{result['severity']}] {result['url']}")
                            print(f"  Origin: {result['origin_tested']}")
                            print(f"  Risk Score: {result['risk_score']}")
                
                except Exception as e:
                    print(Fore.YELLOW + f"[WARN] Test failed: {e}")
                
                # Progress update
                if i % 10 == 0:
                    print(Fore.BLUE + f"[PROGRESS] {i}/{len(test_cases)} tests completed")
        
        print(Fore.GREEN + f"\n[*] Scan completed. Findings: {len(self.findings)}")
        
        # Print summary
        self.print_summary()
        
        return self.findings
    
    def print_summary(self):
        """Print scan summary"""
        print(Fore.CYAN + "\n" + "="*60)
        print(Fore.CYAN + "CORS SCAN SUMMARY")
        print(Fore.CYAN + "="*60)
        
        print(f"\nTarget: {self.base_url}")
        print(f"Total Findings: {len(self.findings)}")
        
        if self.findings:
            # Group by severity
            by_severity = defaultdict(list)
            for finding in self.findings:
                by_severity[finding["severity"]].append(finding)
            
            # Print severity counts
            print("\nFindings by Severity:")
            for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
                count = self.stats.get(severity, 0)
                if count > 0:
                    severity_color = {
                        "CRITICAL": Fore.RED + Style.BRIGHT,
                        "HIGH": Fore.RED,
                        "MEDIUM": Fore.YELLOW,
                        "LOW": Fore.GREEN,
                        "INFO": Fore.CYAN
                    }.get(severity, Fore.WHITE)
                    
                    print(f"  {severity_color}{severity:<10}: {count}")
            
            # Print top vulnerabilities
            print("\nTop Vulnerabilities:")
            critical_findings = [f for f in self.findings if f["severity"] in ["CRITICAL", "HIGH"]]
            critical_findings.sort(key=lambda x: x["risk_score"], reverse=True)
            
            for i, finding in enumerate(critical_findings[:5], 1):
                print(f"\n  {i}. {finding['url']}")
                print(f"     Origin: {finding['origin_tested']}")
                print(f"     Risk: {finding['risk_score']}")
                if finding["analysis"]["vulnerabilities"]:
                    print(f"     Issue: {finding['analysis']['vulnerabilities'][0][:100]}...")
        else:
            print(Fore.GREEN + "\nNo CORS vulnerabilities detected.")
        
        print(Fore.CYAN + "\n" + "="*60)
    
    def close(self):
        """Cleanup resources"""
        self.session.close()

# =========================
# ENHANCED REPORTING
# =========================
class EnhancedReporter:
    @staticmethod
    def generate_reports(client, base_url, findings, output_formats=None):
        """Generate comprehensive reports in multiple formats"""
        if output_formats is None:
            output_formats = ["txt", "json", "csv", "html", "md"]
        
        timestamp = EnhancedUtilities.format_timestamp()
        safe_client = EnhancedUtilities.sanitize_filename(client)
        host = urlparse(base_url).hostname or "target"
        base_filename = f"{safe_client}_cors_{host}_{timestamp}"
        
        report_paths = {}
        
        # Sort findings by risk score
        findings.sort(key=lambda x: x["risk_score"], reverse=True)
        
        # Generate reports
        if "txt" in output_formats:
            report_paths["txt"] = EnhancedReporter._generate_txt_report(
                client, base_url, findings, base_filename
            )
        
        if "json" in output_formats:
            report_paths["json"] = EnhancedReporter._generate_json_report(
                client, base_url, findings, base_filename
            )
        
        if "csv" in output_formats:
            report_paths["csv"] = EnhancedReporter._generate_csv_report(
                client, base_url, findings, base_filename
            )
        
        if "html" in output_formats:
            report_paths["html"] = EnhancedReporter._generate_html_report(
                client, base_url, findings, base_filename
            )
        
        if "md" in output_formats:
            report_paths["md"] = EnhancedReporter._generate_markdown_report(
                client, base_url, findings, base_filename
            )
        
        return report_paths
    
    @staticmethod
    def _generate_txt_report(client, base_url, findings, base_filename):
        """Generate detailed text report"""
        path = os.path.join(Config.TXT_DIR, base_filename + ".txt")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("ENHANCED CORS SECURITY ANALYSIS REPORT\n")
            f.write("=" * 80 + "\n\n")
            
            f.write(f"Client: {client}\n")
            f.write(f"Target: {base_url}\n")
            f.write(f"Generated: {EnhancedUtilities.now_utc()}\n")
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
                f.write(f"FINDING #{i}: {finding['severity']} (Risk Score: {finding['risk_score']}/100)\n")
                f.write("-" * 80 + "\n\n")
                
                f.write(f"Endpoint:    {finding['endpoint']}\n")
                f.write(f"URL:         {finding['url']}\n")
                f.write(f"Method:      {finding['method']}\n")
                f.write(f"Status Code: {finding.get('status_code', 'N/A')}\n")
                f.write(f"Origin Tested: {finding['origin_tested']}\n\n")
                
                # CORS Headers
                f.write("CORS Headers:\n")
                for header, value in finding.get('cors_headers', {}).items():
                    f.write(f"  {header}: {value}\n")
                f.write("\n")
                
                # Analysis
                analysis = finding.get('analysis', {})
                if analysis.get('vulnerabilities'):
                    f.write("VULNERABILITIES:\n")
                    for vuln in analysis['vulnerabilities']:
                        f.write(f"  • {vuln}\n")
                    f.write("\n")
                
                if analysis.get('warnings'):
                    f.write("WARNINGS:\n")
                    for warning in analysis['warnings']:
                        f.write(f"  • {warning}\n")
                    f.write("\n")
                
                # Recommendations
                f.write("RECOMMENDATIONS:\n")
                recommendations = EnhancedReporter._generate_recommendations(finding)
                for rec in recommendations[:5]:
                    f.write(f"  • {rec}\n")
                
                f.write("\n")
        
        return path
    
    @staticmethod
    def _generate_json_report(client, base_url, findings, base_filename):
        """Generate JSON report"""
        path = os.path.join(Config.JSON_DIR, base_filename + ".json")
        
        report_data = {
            "metadata": {
                "client": client,
                "target": base_url,
                "generated": EnhancedUtilities.now_utc(),
                "scanner_version": "2.0.0",
                "total_findings": len(findings)
            },
            "summary": {
                "severity_counts": Counter(f["severity"] for f in findings),
                "risk_score_distribution": {
                    "0-20": len([f for f in findings if f["risk_score"] <= 20]),
                    "21-40": len([f for f in findings if 21 <= f["risk_score"] <= 40]),
                    "41-60": len([f for f in findings if 41 <= f["risk_score"] <= 60]),
                    "61-80": len([f for f in findings if 61 <= f["risk_score"] <= 80]),
                    "81-100": len([f for f in findings if f["risk_score"] >= 81])
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
                "severity", "risk_score", "url", "method", "origin_tested",
                "status_code", "acao", "acac", "vulnerabilities"
            ])
            
            for finding in findings:
                cors_headers = finding.get("cors_headers", {})
                vulnerabilities = finding.get("analysis", {}).get("vulnerabilities", [])
                
                writer.writerow([
                    finding["severity"],
                    finding["risk_score"],
                    finding["url"],
                    finding["method"],
                    finding["origin_tested"],
                    finding.get("status_code", ""),
                    cors_headers.get("Access-Control-Allow-Origin", ""),
                    cors_headers.get("Access-Control-Allow-Credentials", ""),
                    "; ".join(vulnerabilities)[:200]
                ])
        
        return path
    
    @staticmethod
    def _generate_html_report(client, base_url, findings, base_filename):
        """Generate HTML report"""
        path = os.path.join(Config.HTML_DIR, base_filename + ".html")
        
        severity_colors = {
            "CRITICAL": "#dc3545",
            "HIGH": "#fd7e14",
            "MEDIUM": "#ffc107",
            "LOW": "#28a745",
            "INFO": "#6c757d"
        }
        
        # Generate HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CORS Security Report - {client}</title>
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
            transition: transform 0.2s;
        }}
        .finding-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
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
        .code {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            overflow-x: auto;
            margin: 10px 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
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
        tr:hover {{
            background: #f8f9fa;
        }}
        .recommendation {{
            background: #e7f3ff;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 10px 0;
            border-radius: 0 5px 5px 0;
        }}
        @media (max-width: 768px) {{
            .container {{
                padding: 15px;
            }}
            .summary-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #007bff;">CORS Security Analysis Report</h1>
            <p><strong>Client:</strong> {client} | <strong>Target:</strong> {base_url}</p>
            <p><strong>Generated:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </div>
        
        <div class="summary">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
"""
        
        # Severity counts
        severity_counts = Counter(f["severity"] for f in findings)
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
                <span style="float: right; color: #666;">Risk Score: {finding['risk_score']}/100</span>
            </h3>
            
            <p><strong>URL:</strong> {finding['url']}</p>
            <p><strong>Method:</strong> {finding['method']} | <strong>Status:</strong> {finding.get('status_code', 'N/A')}</p>
            <p><strong>Origin Tested:</strong> <code>{finding['origin_tested']}</code></p>
            
            <h4>CORS Headers:</h4>
            <table>
                <tr><th>Header</th><th>Value</th></tr>
"""
            
            for header, value in finding.get('cors_headers', {}).items():
                html += f"<tr><td>{header}</td><td><code>{value}</code></td></tr>\n"
            
            html += """
            </table>
"""
            
            # Vulnerabilities
            vulnerabilities = finding.get('analysis', {}).get('vulnerabilities', [])
            if vulnerabilities:
                html += "<h4>Vulnerabilities:</h4><ul>\n"
                for vuln in vulnerabilities[:3]:
                    html += f"<li>{vuln}</li>\n"
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
            <p>Generated by Enhanced CORS Security Analyzer v2.0.0</p>
            <p>For security purposes only. Unauthorized testing is illegal.</p>
        </footer>
    </div>
</body>
</html>
"""
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        
        return path
    
    @staticmethod
    def _generate_markdown_report(client, base_url, findings, base_filename):
        """Generate Markdown report"""
        path = os.path.join(Config.MARKDOWN_DIR, base_filename + ".md")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"# CORS Security Analysis Report\n\n")
            f.write(f"**Client:** {client}  \n")
            f.write(f"**Target:** {base_url}  \n")
            f.write(f"**Generated:** {EnhancedUtilities.now_utc()}  \n")
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
                f.write(f"### Finding #{i}: {finding['severity']} (Risk: {finding['risk_score']}/100)\n\n")
                f.write(f"**Endpoint:** {finding['endpoint']}  \n")
                f.write(f"**URL:** {finding['url']}  \n")
                f.write(f"**Method:** {finding['method']}  \n")
                f.write(f"**Origin Tested:** `{finding['origin_tested']}`  \n")
                f.write(f"**Status Code:** {finding.get('status_code', 'N/A')}\n\n")
                
                f.write("**CORS Headers:**  \n")
                cors_headers = finding.get('cors_headers', {})
                if cors_headers:
                    for header, value in cors_headers.items():
                        f.write(f"- `{header}: {value}`  \n")
                f.write("\n")
                
                # Vulnerabilities
                vulnerabilities = finding.get('analysis', {}).get('vulnerabilities', [])
                if vulnerabilities:
                    f.write("**Vulnerabilities:**  \n")
                    for vuln in vulnerabilities[:3]:
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
        cors_headers = finding.get("cors_headers", {})
        acao = cors_headers.get("Access-Control-Allow-Origin", "")
        acac = cors_headers.get("Access-Control-Allow-Credentials", "")
        
        if severity in ["CRITICAL", "HIGH"]:
            if acao == "*" and acac == "true":
                recommendations.extend([
                    "Immediately remove `Access-Control-Allow-Credentials: true` when using wildcard origins",
                    "Replace wildcard origin with specific trusted origins",
                    "Implement origin validation using a whitelist",
                    "Consider removing CORS headers if cross-origin access is not required"
                ])
            elif acao == finding["origin_tested"] and acac == "true":
                recommendations.extend([
                    "Implement proper origin validation to prevent reflection attacks",
                    "Remove `Access-Control-Allow-Credentials: true` for untrusted origins",
                    "Use a strict origin whitelist"
                ])
        
        if acao == "*":
            recommendations.extend([
                "Avoid using wildcard origins in production",
                "Use specific origin whitelists",
                "Consider if cross-origin access is actually required"
            ])
        
        if acac == "true":
            recommendations.append(
                "Ensure `Access-Control-Allow-Credentials: true` is only used with specific, validated origins"
            )
        
        # General recommendations
        recommendations.extend([
            "Implement proper CORS configuration based on actual requirements",
            "Regularly audit CORS configurations",
            "Test CORS configurations with security scanners",
            "Keep CORS configurations in version control for tracking changes"
        ])
        
        return list(set(recommendations))  # Remove duplicates

# =========================
# ENHANCED CLI INTERFACE
# =========================
def main():
    """Enhanced CLI interface"""
    parser = argparse.ArgumentParser(
        description="Enhanced CORS Security Analyzer v2.0.0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --url https://example.com
  %(prog)s --url https://api.example.com --threads 20 --aggressive
  %(prog)s --url https://example.com --client "ACME Corp" --output-format json,html
        """
    )
    
    parser.add_argument("--url", required=True, help="Base URL to scan")
    parser.add_argument("--client", default="client", help="Client name")
    parser.add_argument("--threads", type=int, default=Config.THREADS_DEFAULT,
                       help=f"Number of threads (default: {Config.THREADS_DEFAULT})")
    parser.add_argument("--endpoints-file", help="File containing custom endpoints (one per line)")
    parser.add_argument("--origins-file", help="File containing custom origins to test")
    parser.add_argument("--no-preflight", action="store_true", help="Disable preflight testing")
    parser.add_argument("--aggressive", action="store_true", help="Enable aggressive testing mode")
    parser.add_argument("--output-format", default="txt,json,csv,html",
                       help="Output formats (comma-separated: txt,json,csv,html,md)")
    parser.add_argument("--no-ssl-verify", action="store_true", help="Disable SSL verification")
    
    args = parser.parse_args()
    
    print(Fore.CYAN + "=" * 70)
    print(Fore.CYAN + "ENHANCED CORS SECURITY ANALYZER v2.0.0")
    print(Fore.CYAN + "=" * 70)
    
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
    
    # Load custom origins if provided
    origins = None
    if args.origins_file and os.path.isfile(args.origins_file):
        try:
            with open(args.origins_file, "r", encoding="utf-8") as f:
                origins = [line.strip() for line in f if line.strip()]
            print(Fore.GREEN + f"[*] Loaded {len(origins)} custom origins")
        except Exception as e:
            print(Fore.YELLOW + f"[!] Failed to load origins file: {e}")
    
    # Permission confirmation
    print(Fore.YELLOW + "\n[!] WARNING: This tool is for authorized security testing only.")
    print(Fore.YELLOW + "[!] Ensure you have explicit permission to scan the target system.")
    
    confirm = input("\nType 'YES' to confirm authorization: ").strip()
    if confirm != "YES":
        print(Fore.RED + "Permission not granted. Exiting.")
        return
    
    # Create analyzer
    analyzer = EnhancedCORSAnalyzer(
        base_url=base_url,
        threads=args.threads
    )
    
    # Configure scan
    methods = ["GET", "POST", "PUT", "DELETE"] if args.aggressive else ["GET", "POST"]
    max_tests = 10 if args.aggressive else 5
    
    print(Fore.CYAN + f"\n[*] Starting scan with configuration:")
    print(Fore.CYAN + f"    Target: {base_url}")
    print(Fore.CYAN + f"    Threads: {args.threads}")
    print(Fore.CYAN + f"    Preflight: {not args.no_preflight}")
    print(Fore.CYAN + f"    Mode: {'Aggressive' if args.aggressive else 'Standard'}")
    
    # Run scan
    try:
        findings = analyzer.run_scan(
            endpoints=endpoints,
            origins=origins,
            methods=methods,
            preflight=not args.no_preflight,
            max_tests_per_endpoint=max_tests
        )
        
        # Generate reports
        output_formats = [fmt.strip() for fmt in args.output_format.split(",")]
        
        print(Fore.CYAN + "\n[*] Generating reports...")
        report_paths = EnhancedReporter.generate_reports(
            client=args.client,
            base_url=base_url,
            findings=findings,
            output_formats=output_formats
        )
        
        # Print report locations
        print(Fore.GREEN + "\n[*] Reports generated:")
        for fmt, path in report_paths.items():
            print(Fore.CYAN + f"    {fmt.upper()}: {os.path.abspath(path)}")
        
        # Print summary
        if findings:
            critical_count = len([f for f in findings if f["severity"] in ["CRITICAL", "HIGH"]])
            if critical_count > 0:
                print(Fore.RED + f"\n[!] CRITICAL: Found {critical_count} high-risk vulnerabilities!")
                print(Fore.RED + "[!] Immediate remediation is recommended.")
        
        print(Fore.GREEN + "\n[*] Scan completed successfully.")
        
    except KeyboardInterrupt:
        print(Fore.YELLOW + "\n[!] Scan interrupted by user.")
    except Exception as e:
        print(Fore.RED + f"\n[!] Error during scan: {e}")
    finally:
        analyzer.close()

if __name__ == "__main__":
    main()