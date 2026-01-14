# enhanced_broken_access_control_scanner.py
import os
import re
import sys
import time
import json
import random
import argparse
import threading
import ipaddress
import itertools
import requests
import concurrent.futures
from queue import Queue, Empty
from datetime import datetime
from urllib.parse import urljoin, urlparse, quote, parse_qs, urlencode
from difflib import SequenceMatcher
from collections import defaultdict, Counter
import hashlib
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Optional imports with fallbacks
try:
    from colorama import init as colorama_init, Fore, Style, Back
    colorama_init(autoreset=True)
    COLORS_ENABLED = True
except Exception:
    class _C:
        def __getattr__(self, k): return ""
    Fore = Style = Back = _C()
    COLORS_ENABLED = False

try:
    import yaml
    YAML_AVAILABLE = True
except:
    YAML_AVAILABLE = False

# -------------------------
# Enhanced Configuration
# -------------------------
class Config:
    OUTPUT_BASE = os.path.join("reports", "access_control_enhanced")
    TXT_DIR = os.path.join(OUTPUT_BASE, "txt")
    JSON_DIR = os.path.join(OUTPUT_BASE, "json")
    CSV_DIR = os.path.join(OUTPUT_BASE, "csv")
    YAML_DIR = os.path.join(OUTPUT_BASE, "yaml")
    HTML_DIR = os.path.join(OUTPUT_BASE, "html")
    
    for dir_path in [TXT_DIR, JSON_DIR, CSV_DIR, YAML_DIR, HTML_DIR]:
        os.makedirs(dir_path, exist_ok=True)
    
    REQUEST_TIMEOUT = 12
    MAX_RETRIES = 2
    THREADS_DEFAULT = 20
    PAUSE_MIN = 0.01
    PAUSE_MAX = 0.08
    MAX_REQUESTS_PER_MINUTE = 300
    
    # Enhanced user agents
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/122.0",
        "python-requests/2.31.0"
    ]
    
    # Enhanced header tampering
    HEADER_TAMPERS = [
        {"X-Forwarded-For": "127.0.0.1"},
        {"X-Forwarded-For": "10.0.0.1"},
        {"X-Forwarded-For": "192.168.1.1"},
        {"X-Real-IP": "127.0.0.1"},
        {"X-Original-URL": "/admin"},
        {"X-Rewrite-URL": "/admin"},
        {"X-HTTP-Method-Override": "GET"},
        {"X-HTTP-Method-Override": "POST"},
        {"X-HTTP-Method-Override": "DELETE"},
        {"Referer": "https://admin.example.com"},
        {"Origin": "https://admin.example.com"},
        {"Host": "localhost"},
        {"X-Forwarded-Host": "localhost"},
        {"X-Original-Host": "localhost"},
        {"X-Custom-IP-Authorization": "127.0.0.1"},
        {"CF-Connecting-IP": "127.0.0.1"},
        {"True-Client-IP": "127.0.0.1"},
        {"X-Client-IP": "127.0.0.1"},
        {"X-Remote-IP": "127.0.0.1"},
        {"X-Remote-Addr": "127.0.0.1"},
        {"X-Cluster-Client-IP": "127.0.0.1"}
    ]
    
    # HTTP Method tampering
    METHOD_TAMPERS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
    
    # Enhanced forced browsing patterns
    FORCED_BROWSE_PATTERNS = {
        "admin": ["admin", "administrator", "adm", "admins"],
        "management": ["manage", "management", "manager", "mgmt"],
        "dashboard": ["dashboard", "console", "controlpanel", "cpanel", "webadmin"],
        "auth": ["login", "signin", "signup", "register", "auth", "authentication", "logout"],
        "users": ["users", "user", "accounts", "account", "members", "member"],
        "api": ["api", "rest", "graphql", "v1", "v2", "v3"],
        "config": ["config", "configuration", "setup", "install", "install.php"],
        "backup": ["backup", "backups", "back", "old", "archive"],
        "dev": ["dev", "development", "test", "testing", "stage", "staging"],
        "internal": ["internal", "private", "secret", "hidden", "secure"],
        "files": ["files", "uploads", "downloads", "static", "assets"],
        "database": ["db", "database", "mysql", "postgres", "mongodb"],
        "logs": ["logs", "log", "debug", "error_log", "access_log"],
        "sensitive": ["env", ".env", "config.json", "config.php", "settings.php"]
    }
    
    # Generate comprehensive wordlist
    FORCED_BROWSE_BASE = []
    for category, words in FORCED_BROWSE_PATTERNS.items():
        FORCED_BROWSE_BASE.extend(words)
        FORCED_BROWSE_BASE.extend([f"{w}/" for w in words])
    
    # Add file extensions
    EXTENSIONS = [".php", ".html", ".htm", ".jsp", ".asp", ".aspx", ".json", ".xml", ".txt", ".yml", ".yaml"]
    for word in FORCED_BROWSE_BASE[:100]:  # Limit to prevent explosion
        for ext in EXTENSIONS:
            if not word.endswith("/"):
                FORCED_BROWSE_BASE.append(f"{word}{ext}")
    
    # Common ID patterns
    ID_PATTERNS = [
        "id", "user_id", "userId", "uid", "ID", "Id", "num", "no", "number",
        "token", "key", "uuid", "guid", "session", "order_id", "product_id"
    ]
    
    # Enhanced sensitive markers with regex patterns
    SENSITIVE_PATTERNS = {
        "email": [r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'],
        "ssn": [r'\b\d{3}-\d{2}-\d{4}\b'],
        "credit_card": [r'\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b'],
        "phone": [r'\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b'],
        "jwt": [r'eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b'],
        "api_key": [r'(?i)(api[_-]?key|secret[_-]?key)[=:]["\']?[a-zA-Z0-9_-]{16,}["\']?'],
        "password": [r'(?i)(password|passwd|pwd)[=:]["\']?[^"\'\s]+["\']?'],
        "session": [r'(?i)(session|sessid)[=:]["\']?[a-zA-Z0-9%]{16,}["\']?'],
        "token": [r'(?i)(token|access_token|refresh_token)[=:]["\']?[a-zA-Z0-9._-]{16,}["\']?']
    }
    
    # Headers that might leak info
    INFO_LEAK_HEADERS = [
        "server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version",
        "x-backend-server", "x-server", "via", "x-trace-id", "x-correlation-id"
    ]
    
    # Rate limiting configuration
    RATE_LIMIT_BUCKET_SIZE = 60  # seconds
    MAX_REQUESTS_PER_BUCKET = 300

# -------------------------
# Enhanced Utilities
# -------------------------
class EnhancedUtilities:
    @staticmethod
    def now_ts(fmt="%Y-%m-%d_%H-%M-%S"):
        return datetime.utcnow().strftime(fmt)
    
    @staticmethod
    def rand_headers(extra=None):
        h = {
            "User-Agent": random.choice(Config.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
        }
        if extra and isinstance(extra, dict):
            h.update(extra)
        return h
    
    @staticmethod
    def sanitize(obj):
        """Enhanced sanitization for output"""
        if isinstance(obj, dict):
            return {str(k): EnhancedUtilities.sanitize(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple, set)):
            return [EnhancedUtilities.sanitize(i) for i in obj]
        if isinstance(obj, (bytes, bytearray)):
            try:
                return obj.decode("utf-8", errors="ignore")
            except:
                return str(obj)
        if hasattr(obj, "isoformat"):
            try:
                return obj.isoformat()
            except:
                return str(obj)
        if isinstance(obj, str):
            # Remove null bytes and control characters
            return ''.join(c for c in obj if ord(c) >= 32 or ord(c) == 9)
        return obj
    
    @staticmethod
    def similarity(a, b, max_len=5000):
        """Improved similarity calculation"""
        if not a or not b:
            return 0.0
        try:
            a_trunc = str(a)[:max_len]
            b_trunc = str(b)[:max_len]
            return SequenceMatcher(None, a_trunc, b_trunc).ratio()
        except:
            return 0.0
    
    @staticmethod
    def calculate_content_hash(content):
        """Calculate hash of content for comparison"""
        if isinstance(content, str):
            content = content.encode('utf-8', errors='ignore')
        return hashlib.md5(content).hexdigest()[:16]
    
    @staticmethod
    def detect_technology(headers, body):
        """Detect web technology from headers and body"""
        tech = set()
        
        # From headers
        server = headers.get('server', '').lower()
        powered_by = headers.get('x-powered-by', '').lower()
        
        tech_map = {
            'apache': 'Apache',
            'nginx': 'Nginx',
            'iis': 'IIS',
            'cloudflare': 'Cloudflare',
            'express': 'Node.js/Express',
            'php': 'PHP',
            'asp.net': 'ASP.NET',
            'django': 'Django',
            'rails': 'Ruby on Rails',
            'wordpress': 'WordPress',
            'joomla': 'Joomla',
            'drupal': 'Drupal'
        }
        
        for key, value in tech_map.items():
            if key in server or key in powered_by:
                tech.add(value)
        
        # From body
        body_lower = body.lower()
        if 'wordpress' in body_lower:
            tech.add('WordPress')
        if 'joomla' in body_lower:
            tech.add('Joomla')
        if 'drupal' in body_lower:
            tech.add('Drupal')
        
        return list(tech)
    
    @staticmethod
    def extract_links(content, base_url):
        """Extract links from HTML content"""
        links = set()
        # Simple regex for href and src attributes
        patterns = [
            r'href=["\']([^"\']+)["\']',
            r'src=["\']([^"\']+)["\']',
            r'action=["\']([^"\']+)["\']'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                if match.startswith(('http://', 'https://', '//')):
                    links.add(match)
                elif match.startswith('/'):
                    links.add(urljoin(base_url, match))
                elif match:
                    links.add(urljoin(base_url + '/', match))
        
        return list(links)
    
    @staticmethod
    def check_sensitive_patterns(text):
        """Check for sensitive data patterns"""
        findings = []
        for pattern_type, patterns in Config.SENSITIVE_PATTERNS.items():
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    findings.append({
                        'type': pattern_type,
                        'count': len(matches),
                        'sample': matches[0] if matches else ''
                    })
        return findings

# -------------------------
# Rate Limiter
# -------------------------
class RateLimiter:
    def __init__(self, max_requests=Config.MAX_REQUESTS_PER_BUCKET, 
                 bucket_size=Config.RATE_LIMIT_BUCKET_SIZE):
        self.max_requests = max_requests
        self.bucket_size = bucket_size
        self.requests = []
        self.lock = threading.Lock()
    
    def wait_if_needed(self):
        with self.lock:
            now = time.time()
            # Remove old requests
            self.requests = [req_time for req_time in self.requests 
                           if now - req_time < self.bucket_size]
            
            if len(self.requests) >= self.max_requests:
                oldest = self.requests[0]
                wait_time = self.bucket_size - (now - oldest)
                if wait_time > 0:
                    time.sleep(wait_time + 0.1)
                    # Reset after waiting
                    self.requests = []
            
            self.requests.append(now)

# -------------------------
# Enhanced Request Handler
# -------------------------
class EnhancedRequestHandler:
    def __init__(self, proxies=None, verify_ssl=True):
        self.session = requests.Session()
        self.rate_limiter = RateLimiter()
        self.proxies = proxies
        self.verify_ssl = verify_ssl
        
        # Configure session
        self.session.headers.update({
            "User-Agent": random.choice(Config.USER_AGENTS)
        })
        
        if proxies:
            self.session.proxies.update(proxies)
    
    def request(self, method, url, **kwargs):
        self.rate_limiter.wait_if_needed()
        
        # Set default timeout if not provided
        if 'timeout' not in kwargs:
            kwargs['timeout'] = Config.REQUEST_TIMEOUT
        
        # Handle SSL verification
        kwargs['verify'] = self.verify_ssl
        
        max_retries = kwargs.pop('max_retries', Config.MAX_RETRIES)
        
        for attempt in range(max_retries + 1):
            try:
                response = self.session.request(method, url, **kwargs)
                
                # Enhanced response info
                result = {
                    "url": url,
                    "method": method,
                    "status": response.status_code,
                    "headers": dict(response.headers),
                    "content": response.content,
                    "text": response.text,
                    "elapsed": response.elapsed.total_seconds(),
                    "history": [{
                        "status": r.status_code,
                        "url": r.url,
                        "headers": dict(r.headers)
                    } for r in response.history],
                    "cookies": {c.name: c.value for c in response.cookies},
                    "request_headers": dict(response.request.headers),
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Calculate content hash
                result["content_hash"] = EnhancedUtilities.calculate_content_hash(response.content)
                
                # Detect technology
                result["technology"] = EnhancedUtilities.detect_technology(
                    result["headers"], result["text"]
                )
                
                # Extract links if HTML
                if 'text/html' in result["headers"].get('content-type', '').lower():
                    result["links"] = EnhancedUtilities.extract_links(result["text"], url)
                
                return result
                
            except requests.exceptions.RequestException as e:
                if attempt == max_retries:
                    return {
                        "error": str(e),
                        "url": url,
                        "method": method,
                        "status": 0,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                time.sleep(0.5 * (attempt + 1))
            except Exception as e:
                return {
                    "error": str(e),
                    "url": url,
                    "method": method,
                    "status": 0,
                    "timestamp": datetime.utcnow().isoformat()
                }
    
    def close(self):
        self.session.close()

# -------------------------
# Enhanced Access Control Scanner
# -------------------------
class EnhancedAccessControlScanner:
    def __init__(self, base_url, threads=Config.THREADS_DEFAULT, 
                 aggressive=False, pace=(Config.PAUSE_MIN, Config.PAUSE_MAX),
                 proxies=None, verify_ssl=True):
        self.base_url = base_url.rstrip("/")
        self.threads = max(2, min(threads, 50))  # Cap at 50 threads
        self.aggressive = aggressive
        self.pace = pace
        self.proxies = proxies
        self.verify_ssl = verify_ssl
        
        # Core components
        self.request_handler = EnhancedRequestHandler(proxies, verify_ssl)
        self.queue = Queue()
        self.lock = threading.Lock()
        self.visited = set()
        self.findings = []
        self.stats = defaultdict(int)
        
        # Baseline data
        self.baseline = {}
        self.content_hashes = set()
        
        # Progress tracking
        self.total_tasks = 0
        self.completed_tasks = 0
        
    def _make_task_signature(self, task_type, payload):
        """Create unique signature for task"""
        if task_type == "baseline":
            return f"baseline:{payload}"
        elif task_type == "forced":
            return f"forced:{payload}"
        elif task_type == "idor":
            return f"idor:{payload}"
        elif task_type == "tamper":
            return f"tamper:{hash(str(payload))}"
        elif task_type == "method_tamper":
            return f"method:{payload}"
        elif task_type == "param_tamper":
            return f"param:{payload}"
        return f"{task_type}:{hash(str(payload))}"
    
    def calibrate(self):
        """Enhanced baseline calibration"""
        print(Fore.CYAN + f"[CALIBRATE] Capturing baseline for {self.base_url}")
        
        baseline_urls = [
            self.base_url + "/",
            self.base_url + f"/nonexistent-{random.randint(100000,999999)}.html",
            self.base_url + "/robots.txt",
            self.base_url + "/sitemap.xml"
        ]
        
        for url in baseline_urls:
            result = self.request_handler.request("GET", url)
            
            if url.endswith("/"):
                self.baseline["homepage"] = result
            elif "nonexistent" in url:
                self.baseline["404"] = result
            
            if result.get("content_hash"):
                self.content_hashes.add(result["content_hash"])
            
            time.sleep(0.1)
        
        print(Fore.CYAN + f"[CALIBRATE] Baseline captured with {len(self.content_hashes)} unique content hashes")
    
    def generate_forced_browse_candidates(self, extra_wordlist=None):
        """Generate comprehensive forced browsing candidates"""
        candidates = set()
        
        # Base patterns
        for word in Config.FORCED_BROWSE_BASE[:200]:  # Limit base words
            candidates.add(word)
        
        # Add patterns with common prefixes/suffixes
        prefixes = ["", "my", "admin_", "user_", "sys_", "web_", "backup_", "old_"]
        suffixes = ["", "_admin", "_panel", "_console", "_dashboard"]
        
        for base in Config.FORCED_BROWSE_BASE[:50]:
            for prefix in prefixes[:3]:
                for suffix in suffixes[:3]:
                    candidate = f"{prefix}{base}{suffix}"
                    candidates.add(candidate)
                    candidates.add(f"{candidate}/")
        
        # Add common admin paths
        admin_paths = [
            "administrator/index.php",
            "wp-admin/",
            "admin/login.php",
            "admin/index.php",
            "manager/html",
            "web-console/",
            "phpmyadmin/",
            "phppgadmin/",
            "adminer.php",
            "database/",
            "dbadmin/",
            "mysql/",
            ".git/",
            ".env",
            "config.php",
            "config.json",
            "settings.php",
            "install.php",
            "setup.php",
            "upgrade.php"
        ]
        
        candidates.update(admin_paths)
        
        # Load extra wordlist if provided
        if extra_wordlist and os.path.isfile(extra_wordlist):
            try:
                with open(extra_wordlist, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            candidates.add(line.lstrip("/"))
            except Exception as e:
                print(Fore.YELLOW + f"[WARN] Failed to load wordlist: {e}")
        
        return list(candidates)[:1000]  # Limit total candidates
    
    def generate_idor_patterns(self, templates=None):
        """Generate IDOR testing patterns"""
        patterns = []
        
        # User templates
        if templates:
            for template in templates:
                patterns.append(template)
        
        # Common API patterns
        common_patterns = [
            "api/users/{id}",
            "api/user/{id}",
            "api/accounts/{id}",
            "api/orders/{id}",
            "api/products/{id}",
            "api/documents/{id}",
            "user/{id}/profile",
            "users/{id}/edit",
            "account/{id}/settings",
            "download/{id}",
            "file/{id}",
            "invoice/{id}"
        ]
        
        patterns.extend(common_patterns)
        
        # Generate with different parameter names
        for base in ["api/user/", "api/account/", "api/profile/", "api/data/"]:
            for param in Config.ID_PATTERNS[:5]:
                patterns.append(f"{base}{{{param}}}")
                patterns.append(f"{base}?{param}={{{param}}}")
        
        return patterns
    
    def analyze_response(self, response, baseline_response):
        """Enhanced response analysis"""
        if not response or "status" not in response:
            return None
        
        analysis = {
            "interesting": False,
            "reasons": [],
            "confidence": 0,
            "indicators": []
        }
        
        status = response.get("status", 0)
        content_hash = response.get("content_hash")
        text = response.get("text", "")
        
        # Skip if content is already seen
        if content_hash and content_hash in self.content_hashes:
            return None
        
        # Status code analysis
        if status == 200:
            analysis["reasons"].append("200_OK")
            analysis["confidence"] += 30
            analysis["interesting"] = True
        
        elif status in [301, 302, 303, 307, 308]:
            analysis["reasons"].append(f"Redirect_{status}")
            analysis["confidence"] += 15
            analysis["interesting"] = True
        
        elif status in [401, 403]:
            analysis["reasons"].append(f"Auth_{status}")
            analysis["confidence"] += 25
            analysis["interesting"] = True
        
        elif status in [500, 502, 503]:
            analysis["reasons"].append(f"Error_{status}")
            analysis["confidence"] += 10
        
        # Content analysis
        if text:
            # Check for sensitive data
            sensitive_findings = EnhancedUtilities.check_sensitive_patterns(text)
            if sensitive_findings:
                analysis["indicators"].extend(sensitive_findings)
                analysis["reasons"].append("sensitive_data")
                analysis["confidence"] += 40
                analysis["interesting"] = True
            
            # Check for directory listing
            if "index of" in text.lower() or "directory listing" in text.lower():
                analysis["reasons"].append("directory_listing")
                analysis["confidence"] += 30
                analysis["interesting"] = True
            
            # Check for admin interfaces
            admin_indicators = ["admin panel", "dashboard", "control panel", "login form", "username", "password"]
            if any(indicator in text.lower() for indicator in admin_indicators):
                analysis["reasons"].append("admin_interface")
                analysis["confidence"] += 25
                analysis["interesting"] = True
        
        # Compare with baseline
        if baseline_response and baseline_response.get("status"):
            if status != baseline_response.get("status"):
                analysis["reasons"].append(f"status_diff_{baseline_response.get('status')}_to_{status}")
                analysis["confidence"] += 20
            
            # Content similarity
            if text and baseline_response.get("text"):
                sim = EnhancedUtilities.similarity(text, baseline_response.get("text"))
                if sim < 0.5:  # Low similarity
                    analysis["reasons"].append(f"low_similarity_{sim:.2f}")
                    analysis["confidence"] += 15
        
        # Header analysis
        headers = response.get("headers", {})
        for header in Config.INFO_LEAK_HEADERS:
            if header in headers:
                analysis["indicators"].append({
                    "type": "info_leak",
                    "header": header,
                    "value": headers[header]
                })
                analysis["reasons"].append(f"info_leak_{header}")
                analysis["confidence"] += 5
        
        # Technology detection
        tech = response.get("technology", [])
        if tech:
            analysis["indicators"].append({
                "type": "technology",
                "value": tech
            })
        
        return analysis if analysis["interesting"] else None
    
    def scan_forced_browsing(self, path):
        """Scan a single path for forced browsing vulnerabilities"""
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        
        # Try HEAD first
        result = self.request_handler.request("HEAD", url)
        if result and result.get("status") in [200, 301, 302, 401, 403]:
            # If interesting, try GET for more details
            result = self.request_handler.request("GET", url)
        
        if result:
            analysis = self.analyze_response(result, self.baseline.get("404"))
            if analysis:
                finding = {
                    "type": "forced_browsing",
                    "url": url,
                    "path": path,
                    "method": "GET",
                    "status": result.get("status"),
                    "length": len(result.get("content", b"")),
                    "analysis": analysis,
                    "response": {
                        "headers": result.get("headers"),
                        "sample": result.get("text", "")[:1000],
                        "elapsed": result.get("elapsed")
                    },
                    "timestamp": result.get("timestamp")
                }
                return finding
        
        return None
    
    def scan_idor(self, template):
        """Scan for IDOR vulnerabilities"""
        findings = []
        
        # Test a few IDs
        test_ids = [1, 2, 100, 999, 1000, random.randint(10000, 99999)]
        
        responses = []
        for test_id in test_ids[:5]:  # Limit to 5 IDs initially
            url = template.replace("{id}", str(test_id))
            full_url = urljoin(self.base_url + "/", url.lstrip("/"))
            
            result = self.request_handler.request("GET", full_url)
            if result:
                responses.append((test_id, result))
            
            time.sleep(0.05)
        
        # Analyze responses for differences
        if len(responses) >= 2:
            # Check if different IDs return different but valid responses
            successful_responses = [(id, r) for id, r in responses if r.get("status") in [200, 201]]
            
            if len(successful_responses) >= 2:
                # Compare content hashes
                content_hashes = [r.get("content_hash") for _, r in successful_responses]
                if len(set(content_hashes)) > 1:
                    # Different content for different IDs
                    for test_id, result in successful_responses:
                        analysis = self.analyze_response(result, self.baseline.get("404"))
                        if analysis:
                            finding = {
                                "type": "idor",
                                "url": result.get("url"),
                                "template": template,
                                "tested_id": test_id,
                                "method": "GET",
                                "status": result.get("status"),
                                "analysis": analysis,
                                "response": {
                                    "headers": result.get("headers"),
                                    "sample": result.get("text", "")[:1000],
                                    "content_hash": result.get("content_hash")
                                },
                                "timestamp": result.get("timestamp")
                            }
                            findings.append(finding)
        
        return findings
    
    def scan_header_tampering(self, path, original_headers=None):
        """Scan for header tampering vulnerabilities"""
        findings = []
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        
        # Original request
        original_result = self.request_handler.request("GET", url, headers=original_headers)
        
        # Test each tampering header
        for tamper_headers in Config.HEADER_TAMPERS:
            headers = dict(original_headers or {})
            headers.update(tamper_headers)
            
            result = self.request_handler.request("GET", url, headers=headers)
            
            if result and original_result:
                # Compare with original
                if result.get("status") != original_result.get("status"):
                    analysis = self.analyze_response(result, original_result)
                    if analysis:
                        finding = {
                            "type": "header_tampering",
                            "url": url,
                            "path": path,
                            "method": "GET",
                            "original_status": original_result.get("status"),
                            "tampered_status": result.get("status"),
                            "tampered_headers": tamper_headers,
                            "analysis": analysis,
                            "response": {
                                "headers": result.get("headers"),
                                "sample": result.get("text", "")[:500]
                            },
                            "timestamp": result.get("timestamp")
                        }
                        findings.append(finding)
            
            time.sleep(0.02)
        
        return findings
    
    def scan_method_tampering(self, path):
        """Scan for HTTP method tampering vulnerabilities"""
        findings = []
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        
        # Original GET request
        get_result = self.request_handler.request("GET", url)
        
        # Test other methods
        for method in Config.METHOD_TAMPERS:
            if method == "GET":
                continue
            
            result = self.request_handler.request(method, url)
            
            if result and get_result:
                # Check if different method returns different response
                if result.get("status") not in [405, 501]:  # Not method not allowed
                    if result.get("status") != get_result.get("status") or \
                       result.get("content_hash") != get_result.get("content_hash"):
                        
                        analysis = self.analyze_response(result, get_result)
                        if analysis:
                            finding = {
                                "type": "method_tampering",
                                "url": url,
                                "path": path,
                                "original_method": "GET",
                                "tampered_method": method,
                                "original_status": get_result.get("status"),
                                "tampered_status": result.get("status"),
                                "analysis": analysis,
                                "response": {
                                    "headers": result.get("headers"),
                                    "sample": result.get("text", "")[:500]
                                },
                                "timestamp": result.get("timestamp")
                            }
                            findings.append(finding)
            
            time.sleep(0.02)
        
        return findings
    
    def worker(self):
        """Worker thread for processing tasks"""
        while True:
            try:
                task = self.queue.get(timeout=2)
            except Empty:
                break
            
            try:
                task_type, payload = task
                
                if task_type == "forced":
                    finding = self.scan_forced_browsing(payload)
                    if finding:
                        with self.lock:
                            self.findings.append(finding)
                            print(Fore.YELLOW + f"[FORCED] {finding['status']} {finding['url']}")
                
                elif task_type == "idor":
                    findings = self.scan_idor(payload)
                    if findings:
                        with self.lock:
                            self.findings.extend(findings)
                            for f in findings:
                                print(Fore.RED + f"[IDOR] {f['status']} {f['url']} (id={f.get('tested_id')})")
                
                elif task_type == "header_tamper":
                    path, headers = payload
                    findings = self.scan_header_tampering(path, headers)
                    if findings:
                        with self.lock:
                            self.findings.extend(findings)
                            for f in findings:
                                print(Fore.MAGENTA + f"[HEADER_TAMPER] {f['original_status']}→{f['tampered_status']} {f['url']}")
                
                elif task_type == "method_tamper":
                    findings = self.scan_method_tampering(payload)
                    if findings:
                        with self.lock:
                            self.findings.extend(findings)
                            for f in findings:
                                print(Fore.CYAN + f"[METHOD_TAMPER] {f['original_method']}→{f['tampered_method']} {f['url']}")
                
                with self.lock:
                    self.completed_tasks += 1
                    self.stats[task_type] += 1
                    
                    # Progress update
                    if self.completed_tasks % 10 == 0:
                        progress = (self.completed_tasks / self.total_tasks * 100) if self.total_tasks > 0 else 0
                        print(Fore.BLUE + f"[PROGRESS] {self.completed_tasks}/{self.total_tasks} ({progress:.1f}%)")
                
            except Exception as e:
                print(Fore.YELLOW + f"[ERROR] Worker task failed: {e}")
            finally:
                self.queue.task_done()
            
            time.sleep(random.uniform(self.pace[0], self.pace[1]))
    
    def run(self, forced_list=None, idor_templates=None, 
            cookies=None, extra_wordlist=None, max_paths=500):
        """Run the comprehensive scan"""
        print(Fore.GREEN + f"[START] Scanning {self.base_url}")
        start_time = time.time()
        
        # Calibration
        self.calibrate()
        
        # Generate candidates
        if not forced_list:
            forced_list = self.generate_forced_browse_candidates(extra_wordlist)
        
        if idor_templates:
            idor_list = self.generate_idor_patterns(idor_templates)
        else:
            idor_list = self.generate_idor_patterns()
        
        # Limit candidates
        forced_list = forced_list[:max_paths]
        idor_list = idor_list[:50]
        
        # Prepare session with cookies
        if cookies:
            self.request_handler.session.cookies.update(cookies)
        
        # Enqueue tasks
        tasks = []
        
        # Forced browsing tasks
        for path in forced_list:
            tasks.append(("forced", path))
        
        # IDOR tasks
        for template in idor_list:
            tasks.append(("idor", template))
        
        # Header tampering on top candidates
        top_candidates = forced_list[:20]
        for path in top_candidates:
            tasks.append(("header_tamper", (path, None)))
            tasks.append(("method_tamper", path))
        
        # Set total tasks
        self.total_tasks = len(tasks)
        
        # Add tasks to queue
        for task in tasks:
            self.queue.put(task)
        
        # Start workers
        workers = []
        for i in range(min(self.threads, len(tasks))):
            t = threading.Thread(target=self.worker, daemon=True, name=f"Worker-{i}")
            t.start()
            workers.append(t)
        
        # Wait for completion
        try:
            self.queue.join()
        except KeyboardInterrupt:
            print(Fore.YELLOW + "\n[!] Interrupted by user")
        
        # Wait for workers to finish
        for worker in workers:
            worker.join(timeout=1)
        
        elapsed = time.time() - start_time
        
        print(Fore.GREEN + f"\n[COMPLETE] Scan finished in {elapsed:.1f}s")
        print(Fore.CYAN + f"[STATS] Findings: {len(self.findings)}")
        print(Fore.CYAN + f"[STATS] Tasks: {self.total_tasks}")
        
        return self.findings

# -------------------------
# Enhanced Scoring & Reporting
# -------------------------
class EnhancedScorer:
    SCORE_LEVELS = {
        "CRITICAL": (90, 100),
        "HIGH": (75, 89),
        "MEDIUM": (50, 74),
        "LOW": (25, 49),
        "INFO": (0, 24)
    }
    
    @staticmethod
    def score_finding(finding):
        """Enhanced scoring algorithm"""
        score = 0
        
        # Type-based scoring
        type_scores = {
            "idor": 40,
            "forced_browsing": 25,
            "header_tampering": 30,
            "method_tampering": 35
        }
        
        score += type_scores.get(finding.get("type", ""), 20)
        
        # Status code scoring
        status = finding.get("status", 0)
        if status == 200:
            score += 20
        elif status in [301, 302]:
            score += 15
        elif status in [401, 403]:
            score += 25
        elif status == 500:
            score += 5
        
        # Analysis confidence
        analysis = finding.get("analysis", {})
        confidence = analysis.get("confidence", 0)
        score += min(confidence, 40)
        
        # Sensitive data detection
        indicators = analysis.get("indicators", [])
        for indicator in indicators:
            if indicator.get("type") == "sensitive_data":
                score += 30
            elif indicator.get("type") == "admin_interface":
                score += 20
            elif indicator.get("type") == "directory_listing":
                score += 25
        
        # Cap score
        score = min(100, score)
        
        # Determine severity
        severity = "INFO"
        for sev, (low, high) in EnhancedScorer.SCORE_LEVELS.items():
            if low <= score <= high:
                severity = sev
                break
        
        finding["score"] = score
        finding["severity"] = severity
        
        return finding
    
    @staticmethod
    def generate_remediation(finding):
        """Generate remediation advice based on finding type"""
        remediation = []
        finding_type = finding.get("type")
        
        if finding_type == "idor":
            remediation.extend([
                "Implement proper access controls for all object references",
                "Use indirect reference maps instead of direct database IDs",
                "Validate user authorization for each requested resource",
                "Implement role-based access control (RBAC)",
                "Use UUIDs instead of sequential IDs where possible"
            ])
        elif finding_type == "forced_browsing":
            remediation.extend([
                "Implement proper authentication for sensitive endpoints",
                "Remove or protect hidden administrative interfaces",
                "Implement IP whitelisting for administrative functions",
                "Use strong authentication for all administrative access",
                "Regularly audit exposed endpoints and files"
            ])
        elif finding_type in ["header_tampering", "method_tampering"]:
            remediation.extend([
                "Validate and sanitize all incoming headers",
                "Implement proper CORS policies",
                "Use CSRF tokens for state-changing operations",
                "Validate HTTP methods at the application level",
                "Implement strict security headers (X-Frame-Options, CSP, etc.)"
            ])
        
        # General recommendations
        remediation.extend([
            "Implement comprehensive logging and monitoring",
            "Regular security assessments and penetration testing",
            "Follow principle of least privilege",
            "Implement proper session management",
            "Use Web Application Firewall (WAF)"
        ])
        
        return remediation

class EnhancedReporter:
    @staticmethod
    def write_reports(client, base_url, findings, scanner_stats):
        """Generate comprehensive reports in multiple formats"""
        ts = EnhancedUtilities.now_ts()
        safe_client = re.sub(r"[^A-Za-z0-9_-]", "_", client)[:30]
        host = urlparse(base_url).hostname or "target"
        base_filename = f"{safe_client}_{host}_{ts}"
        
        # Score all findings
        scored_findings = [EnhancedScorer.score_finding(f) for f in findings]
        
        # Sort by score
        scored_findings.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        # Generate reports
        reports = {
            "txt": EnhancedReporter._write_txt_report,
            "json": EnhancedReporter._write_json_report,
            "csv": EnhancedReporter._write_csv_report,
            "html": EnhancedReporter._write_html_report,
            "yaml": EnhancedReporter._write_yaml_report
        }
        
        report_paths = {}
        
        for fmt, writer in reports.items():
            try:
                path = writer(client, base_url, scored_findings, scanner_stats, base_filename)
                report_paths[fmt] = path
                print(Fore.GREEN + f"[✓] {fmt.upper()} → {path}")
            except Exception as e:
                print(Fore.YELLOW + f"[!] Failed to write {fmt} report: {e}")
        
        return report_paths
    
    @staticmethod
    def _write_txt_report(client, base_url, findings, stats, base_filename):
        """Generate detailed text report"""
        path = os.path.join(Config.TXT_DIR, base_filename + ".txt")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("ENHANCED ACCESS CONTROL VULNERABILITY REPORT\n")
            f.write("=" * 80 + "\n\n")
            
            f.write(f"Client: {client}\n")
            f.write(f"Target: {base_url}\n")
            f.write(f"Generated: {datetime.utcnow().isoformat()}\n")
            f.write(f"Scan Duration: {stats.get('duration', 'N/A')}\n")
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
                
                f.write(f"Type:        {finding.get('type', 'N/A')}\n")
                f.write(f"URL:         {finding.get('url', 'N/A')}\n")
                f.write(f"Method:      {finding.get('method', 'N/A')}\n")
                f.write(f"Status:      {finding.get('status', 'N/A')}\n")
                
                if finding.get("analysis"):
                    analysis = finding["analysis"]
                    f.write(f"Confidence:  {analysis.get('confidence', 0)}/100\n")
                    f.write(f"Reasons:     {', '.join(analysis.get('reasons', []))}\n")
                
                # Indicators
                indicators = finding.get("analysis", {}).get("indicators", [])
                if indicators:
                    f.write("\nINDICATORS:\n")
                    for indicator in indicators:
                        f.write(f"  - {indicator.get('type', 'Unknown')}: {indicator.get('value', 'N/A')}\n")
                
                # Response sample
                if finding.get("response", {}).get("sample"):
                    f.write("\nRESPONSE SAMPLE:\n")
                    sample = finding["response"]["sample"]
                    f.write(f"{sample[:500]}\n")
                    if len(sample) > 500:
                        f.write(f"... (truncated, total {len(sample)} chars)\n")
                
                # Remediation
                remediation = EnhancedScorer.generate_remediation(finding)
                if remediation:
                    f.write("\nRECOMMENDATIONS:\n")
                    for rec in remediation[:5]:  # Limit to top 5
                        f.write(f"  • {rec}\n")
                
                f.write("\n")
        
        return path
    
    @staticmethod
    def _write_json_report(client, base_url, findings, stats, base_filename):
        """Generate JSON report"""
        path = os.path.join(Config.JSON_DIR, base_filename + ".json")
        
        report_data = {
            "metadata": {
                "client": client,
                "target": base_url,
                "generated": datetime.utcnow().isoformat(),
                "scanner_version": "2.0.0",
                "statistics": dict(stats)
            },
            "summary": {
                "total_findings": len(findings),
                "severity_counts": Counter(f["severity"] for f in findings),
                "type_counts": Counter(f.get("type", "unknown") for f in findings)
            },
            "findings": EnhancedUtilities.sanitize(findings)
        }
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        return path
    
    @staticmethod
    def _write_csv_report(client, base_url, findings, stats, base_filename):
        """Generate CSV report"""
        path = os.path.join(Config.CSV_DIR, base_filename + ".csv")
        
        import csv
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "severity", "score", "type", "url", "method", "status",
                "reasons", "confidence", "sample"
            ])
            
            for finding in findings:
                analysis = finding.get("analysis", {})
                writer.writerow([
                    finding.get("severity"),
                    finding.get("score"),
                    finding.get("type"),
                    finding.get("url"),
                    finding.get("method"),
                    finding.get("status"),
                    ";".join(analysis.get("reasons", [])),
                    analysis.get("confidence", 0),
                    (finding.get("response", {}).get("sample", "")[:200])
                ])
        
        return path
    
    @staticmethod
    def _write_html_report(client, base_url, findings, stats, base_filename):
        """Generate HTML report"""
        path = os.path.join(Config.HTML_DIR, base_filename + ".html")
        
        severity_colors = {
            "CRITICAL": "#dc3545",
            "HIGH": "#fd7e14",
            "MEDIUM": "#ffc107",
            "LOW": "#28a745",
            "INFO": "#6c757d"
        }
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Control Scan Report - {client}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }}
        .severity-badge {{ padding: 4px 12px; border-radius: 20px; color: white; font-weight: bold; }}
        .finding {{ border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 20px; background: #fff; }}
        .finding-header {{ border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }}
        .summary {{ background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }}
        .summary-item {{ text-align: center; padding: 10px; }}
        .code {{ background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; overflow-x: auto; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f8f9fa; }}
        tr:hover {{ background: #f5f5f5; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Access Control Vulnerability Scan Report</h1>
            <p><strong>Client:</strong> {client} | <strong>Target:</strong> {base_url}</p>
            <p><strong>Generated:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
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
                    <div style="font-size: 24px; font-weight: bold; color: {color};">{count}</div>
                    <div>{severity}</div>
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
            severity = finding.get("severity", "INFO")
            color = severity_colors.get(severity, "#6c757d")
            
            html += f"""
        <div class="finding">
            <div class="finding-header">
                <h3>
                    <span class="severity-badge" style="background: {color};">{severity}</span>
                    Finding #{i}: {finding.get('type', 'Unknown')}
                    <span style="float: right; color: #666;">Score: {finding.get('score', 0)}/100</span>
                </h3>
                <p><strong>URL:</strong> {finding.get('url', 'N/A')}</p>
                <p><strong>Status:</strong> {finding.get('status', 'N/A')} | <strong>Method:</strong> {finding.get('method', 'N/A')}</p>
            </div>
"""
            
            if finding.get("analysis"):
                analysis = finding["analysis"]
                html += f"""
            <p><strong>Confidence:</strong> {analysis.get('confidence', 0)}/100</p>
            <p><strong>Reasons:</strong> {', '.join(analysis.get('reasons', []))}</p>
"""
            
            # Response sample
            if finding.get("response", {}).get("sample"):
                html += f"""
            <h4>Response Sample:</h4>
            <div class="code">{finding['response']['sample'][:500]}</div>
"""
            
            # Remediation
            remediation = EnhancedScorer.generate_remediation(finding)
            if remediation:
                html += """
            <h4>Recommendations:</h4>
            <ul>
"""
                for rec in remediation[:5]:
                    html += f"                <li>{rec}</li>\n"
                html += "            </ul>\n"
            
            html += "        </div>\n"
        
        html += """
    </div>
    <footer style="text-align: center; margin-top: 30px; color: #666; font-size: 0.9em;">
        <p>Generated by Enhanced Access Control Scanner v2.0.0</p>
    </footer>
</body>
</html>
"""
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        
        return path
    
    @staticmethod
    def _write_yaml_report(client, base_url, findings, stats, base_filename):
        """Generate YAML report if yaml module is available"""
        if not YAML_AVAILABLE:
            raise ImportError("PyYAML not installed")
        
        path = os.path.join(Config.YAML_DIR, base_filename + ".yaml")
        
        report_data = {
            "metadata": {
                "client": client,
                "target": base_url,
                "generated": datetime.utcnow().isoformat(),
                "statistics": dict(stats)
            },
            "findings": EnhancedUtilities.sanitize(findings)
        }
        
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(report_data, f, default_flow_style=False, allow_unicode=True)
        
        return path

# -------------------------
# Enhanced CLI Interface
# -------------------------
def main():
    print(Fore.CYAN + "=" * 70)
    print(Fore.CYAN + "ENHANCED ACCESS CONTROL VULNERABILITY SCANNER v2.0.0")
    print(Fore.CYAN + "=" * 70)
    print()
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Enhanced Access Control Vulnerability Scanner")
    parser.add_argument("--client", help="Client name", default="")
    parser.add_argument("--url", help="Base URL to scan", required=True)
    parser.add_argument("--threads", type=int, help=f"Number of threads (default: {Config.THREADS_DEFAULT})", 
                       default=Config.THREADS_DEFAULT)
    parser.add_argument("--wordlist", help="Additional wordlist file")
    parser.add_argument("--templates", help="IDOR templates file (one per line)")
    parser.add_argument("--cookies", help="Cookies in format 'key=value; key2=value2'")
    parser.add_argument("--output", help="Custom output directory")
    parser.add_argument("--no-ssl-verify", action="store_true", help="Disable SSL verification")
    parser.add_argument("--aggressive", action="store_true", help="Enable aggressive scanning")
    parser.add_argument("--max-paths", type=int, default=500, help="Maximum paths to test")
    
    args = parser.parse_args()
    
    # Get inputs
    client = args.client or input("Client name: ").strip() or "client"
    base_url = args.url
    
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url
    
    # Load templates if provided
    idor_templates = []
    if args.templates and os.path.isfile(args.templates):
        try:
            with open(args.templates, "r", encoding="utf-8") as f:
                idor_templates = [line.strip() for line in f if line.strip()]
        except Exception as e:
            print(Fore.YELLOW + f"[WARN] Failed to load templates: {e}")
    
    # Parse cookies
    cookies = {}
    if args.cookies:
        for part in args.cookies.split(";"):
            if "=" in part:
                key, value = part.split("=", 1)
                cookies[key.strip()] = value.strip()
    
    # Permission confirmation
    print(Fore.YELLOW + "\n[!] WARNING: This tool is for authorized security testing only.")
    print(Fore.YELLOW + "[!] Ensure you have explicit permission to scan the target system.")
    
    confirm = input("\nType 'YES' to confirm authorization: ").strip()
    if confirm != "YES":
        print(Fore.RED + "Permission not granted. Exiting.")
        sys.exit(1)
    
    # Create scanner
    scanner = EnhancedAccessControlScanner(
        base_url=base_url,
        threads=args.threads,
        aggressive=args.aggressive,
        verify_ssl=not args.no_ssl_verify
    )
    
    # Run scan
    start_time = time.time()
    
    findings = scanner.run(
        forced_list=None,
        idor_templates=idor_templates,
        cookies=cookies,
        extra_wordlist=args.wordlist,
        max_paths=args.max_paths
    )
    
    elapsed = time.time() - start_time
    
    # Update stats
    scanner_stats = {
        "duration": f"{elapsed:.1f}s",
        "total_tasks": scanner.total_tasks,
        "completed_tasks": scanner.completed_tasks,
        "findings_count": len(findings)
    }
    
    # Generate reports
    print(Fore.CYAN + "\n[i] Generating reports...")
    report_paths = EnhancedReporter.write_reports(client, base_url, findings, scanner_stats)
    
    # Summary
    print(Fore.GREEN + "\n" + "=" * 70)
    print(Fore.GREEN + "SCAN COMPLETE")
    print(Fore.GREEN + "=" * 70)
    print(Fore.CYAN + f"Duration: {elapsed:.1f} seconds")
    print(Fore.CYAN + f"Findings: {len(findings)}")
    print(Fore.CYAN + f"Tasks processed: {scanner.completed_tasks}/{scanner.total_tasks}")
    
    if findings:
        severity_counts = Counter(f["severity"] for f in findings)
        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
            count = severity_counts.get(severity, 0)
            if count > 0:
                color = Fore.RED if severity in ["CRITICAL", "HIGH"] else Fore.YELLOW if severity == "MEDIUM" else Fore.GREEN
                print(color + f"{severity}: {count}")
    
    print(Fore.GREEN + "\nReports generated:")
    for fmt, path in report_paths.items():
        print(Fore.CYAN + f"  {fmt.upper()}: {path}")
    
    scanner.request_handler.close()

if __name__ == "__main__":
    main()