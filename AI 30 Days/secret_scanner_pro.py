#!/usr/bin/env python3
"""
Secret Scanner Pro — Enterprise Edition
Detect exposed secrets, API keys, and credentials in responses

Features:
- API key detection (AWS, GCP, Azure, Stripe, etc.)
- Private key detection (RSA, SSH, PGP)
- Token detection (JWT, OAuth, Bearer)
- Credential patterns (passwords, connection strings)
- Environment variable leaks
- Git/SVN metadata exposure
"""

import os
import re
import json
import time
import random
import threading
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from queue import Queue, Empty

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

OUTPUT_BASE = os.path.join("reports", "secret_scanner")
os.makedirs(OUTPUT_BASE, exist_ok=True)

# Secret patterns with severity and description
SECRET_PATTERNS = {
    # AWS
    "AWS Access Key ID": {
        "pattern": r'(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}',
        "severity": "CRITICAL",
        "description": "AWS Access Key ID exposed",
    },
    "AWS Secret Access Key": {
        "pattern": r'(?i)aws.{0,20}secret.{0,20}[\'"][0-9a-zA-Z/+]{40}[\'"]',
        "severity": "CRITICAL",
        "description": "AWS Secret Access Key exposed",
    },
    "AWS MWS Key": {
        "pattern": r'amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        "severity": "CRITICAL",
        "description": "Amazon MWS Auth Token exposed",
    },
    
    # Google/GCP
    "Google API Key": {
        "pattern": r'AIza[0-9A-Za-z\-_]{35}',
        "severity": "HIGH",
        "description": "Google API Key exposed",
    },
    "Google OAuth": {
        "pattern": r'[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com',
        "severity": "HIGH",
        "description": "Google OAuth client ID exposed",
    },
    "GCP Service Account": {
        "pattern": r'"type":\s*"service_account"',
        "severity": "CRITICAL",
        "description": "GCP Service Account JSON exposed",
    },
    
    # Azure
    "Azure Storage Key": {
        "pattern": r'(?i)DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}',
        "severity": "CRITICAL",
        "description": "Azure Storage connection string exposed",
    },
    "Azure SAS Token": {
        "pattern": r'\?sv=\d{4}-\d{2}-\d{2}&[^"\'>\s]+sig=[A-Za-z0-9%]+',
        "severity": "HIGH",
        "description": "Azure SAS Token exposed",
    },
    
    # GitHub
    "GitHub Token": {
        "pattern": r'gh[pousr]_[A-Za-z0-9_]{36}',
        "severity": "CRITICAL",
        "description": "GitHub Personal Access Token exposed",
    },
    "GitHub OAuth": {
        "pattern": r'github.{0,20}[\'"][0-9a-zA-Z]{35,40}[\'"]',
        "severity": "CRITICAL",
        "description": "GitHub OAuth Token exposed",
    },
    
    # Stripe
    "Stripe API Key": {
        "pattern": r'sk_live_[0-9a-zA-Z]{24}',
        "severity": "CRITICAL",
        "description": "Stripe Live Secret Key exposed",
    },
    "Stripe Test Key": {
        "pattern": r'sk_test_[0-9a-zA-Z]{24}',
        "severity": "MEDIUM",
        "description": "Stripe Test Secret Key exposed",
    },
    "Stripe Publishable": {
        "pattern": r'pk_(live|test)_[0-9a-zA-Z]{24}',
        "severity": "LOW",
        "description": "Stripe Publishable Key (usually safe)",
    },
    
    # Database
    "Database URL": {
        "pattern": r'(?i)(postgres|mysql|mongodb|redis|mssql)://[^:]+:[^@]+@[^\s<>"\']+',
        "severity": "CRITICAL",
        "description": "Database connection URL with credentials exposed",
    },
    "Generic Database Password": {
        "pattern": r'(?i)(db_pass|database_password|db_password|dbpassword)\s*[=:]\s*[\'"][^\'"]+[\'"]',
        "severity": "CRITICAL",
        "description": "Database password in configuration",
    },
    
    # Private Keys
    "RSA Private Key": {
        "pattern": r'-----BEGIN RSA PRIVATE KEY-----',
        "severity": "CRITICAL",
        "description": "RSA Private Key exposed",
    },
    "DSA Private Key": {
        "pattern": r'-----BEGIN DSA PRIVATE KEY-----',
        "severity": "CRITICAL",
        "description": "DSA Private Key exposed",
    },
    "EC Private Key": {
        "pattern": r'-----BEGIN EC PRIVATE KEY-----',
        "severity": "CRITICAL",
        "description": "EC Private Key exposed",
    },
    "OpenSSH Private Key": {
        "pattern": r'-----BEGIN OPENSSH PRIVATE KEY-----',
        "severity": "CRITICAL",
        "description": "OpenSSH Private Key exposed",
    },
    "PGP Private Key": {
        "pattern": r'-----BEGIN PGP PRIVATE KEY BLOCK-----',
        "severity": "CRITICAL",
        "description": "PGP Private Key exposed",
    },
    
    # JWT/Tokens
    "JWT Token": {
        "pattern": r'eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+',
        "severity": "HIGH",
        "description": "JWT Token exposed (may contain sensitive claims)",
    },
    "Bearer Token": {
        "pattern": r'(?i)bearer\s+[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+',
        "severity": "HIGH",
        "description": "Bearer token exposed",
    },
    
    # API Keys (Generic)
    "Generic API Key": {
        "pattern": r'(?i)(api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*[\'"][a-zA-Z0-9\-_]{20,}[\'"]',
        "severity": "HIGH",
        "description": "Generic API key pattern detected",
    },
    "Authorization Header": {
        "pattern": r'(?i)authorization[\'"]?\s*[=:]\s*[\'"]?(basic|bearer)\s+[a-zA-Z0-9+/=]+',
        "severity": "HIGH",
        "description": "Authorization header with credentials",
    },
    
    # Third-party Services
    "Slack Token": {
        "pattern": r'xox[baprs]-[0-9A-Za-z\-]{10,}',
        "severity": "CRITICAL",
        "description": "Slack API Token exposed",
    },
    "Slack Webhook": {
        "pattern": r'https://hooks\.slack\.com/services/[A-Za-z0-9/]+',
        "severity": "HIGH",
        "description": "Slack Webhook URL exposed",
    },
    "Twilio API Key": {
        "pattern": r'SK[0-9a-fA-F]{32}',
        "severity": "CRITICAL",
        "description": "Twilio API Key exposed",
    },
    "Twilio Account SID": {
        "pattern": r'AC[a-zA-Z0-9_\-]{32}',
        "severity": "MEDIUM",
        "description": "Twilio Account SID exposed",
    },
    "SendGrid API Key": {
        "pattern": r'SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}',
        "severity": "CRITICAL",
        "description": "SendGrid API Key exposed",
    },
    "Mailchimp API Key": {
        "pattern": r'[0-9a-f]{32}-us[0-9]{1,2}',
        "severity": "HIGH",
        "description": "Mailchimp API Key exposed",
    },
    "Facebook Token": {
        "pattern": r'EAACEdEose0cBA[0-9A-Za-z]+',
        "severity": "CRITICAL",
        "description": "Facebook Access Token exposed",
    },
    "Twitter API Key": {
        "pattern": r'(?i)twitter.{0,20}[\'"][0-9a-zA-Z]{35,44}[\'"]',
        "severity": "HIGH",
        "description": "Twitter API Key exposed",
    },
    
    # Environment/Config
    "Environment Variable": {
        "pattern": r'(?i)(password|passwd|pwd|secret|token|api_key|apikey|auth)\s*=\s*[^\s<>"\']{8,}',
        "severity": "HIGH",
        "description": "Potential secret in environment variable format",
    },
    ".env File Content": {
        "pattern": r'(?i)^[A-Z_]+=(["\']).+\1\s*$',
        "severity": "MEDIUM",
        "description": "Environment file format detected",
    },
    
    # Firebase
    "Firebase URL": {
        "pattern": r'https://[a-z0-9-]+\.firebaseio\.com',
        "severity": "MEDIUM",
        "description": "Firebase database URL exposed",
    },
    "Firebase API Key": {
        "pattern": r'(?i)firebase.{0,20}[\'"][a-zA-Z0-9_-]{35,45}[\'"]',
        "severity": "HIGH",
        "description": "Firebase API key exposed",
    },
    
    # Heroku
    "Heroku API Key": {
        "pattern": r'(?i)heroku.{0,20}[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
        "severity": "CRITICAL",
        "description": "Heroku API Key exposed",
    },
    
    # NPM
    "NPM Token": {
        "pattern": r'//registry\.npmjs\.org/:_authToken=[0-9a-f-]{36}',
        "severity": "CRITICAL",
        "description": "NPM auth token exposed",
    },
    
    # Docker
    "Docker Registry Auth": {
        "pattern": r'(?i)"auth"\s*:\s*"[A-Za-z0-9+/=]+"',
        "severity": "HIGH",
        "description": "Docker registry authentication exposed",
    },
    
    # Internal URLs
    "Internal URL": {
        "pattern": r'(?i)(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+):\d+',
        "severity": "LOW",
        "description": "Internal URL/IP exposed",
    },
}

# Paths to check for secrets
SECRET_PATHS = [
    "/.env",
    "/.env.local",
    "/.env.production",
    "/.env.development",
    "/config.json",
    "/config.yaml",
    "/config.yml",
    "/settings.json",
    "/application.properties",
    "/application.yml",
    "/appsettings.json",
    "/web.config",
    "/.git/config",
    "/.svn/entries",
    "/backup.sql",
    "/dump.sql",
    "/phpinfo.php",
    "/info.php",
    "/server-status",
    "/debug",
    "/.aws/credentials",
    "/.docker/config.json",
    "/id_rsa",
    "/id_dsa",
    "/.ssh/id_rsa",
]


def utc_now():
    return datetime.now(timezone.utc)


def random_headers():
    return {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
        ]),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }


class SecretScanner:
    def __init__(self, base_url, threads=DEFAULT_THREADS):
        self.base = base_url.rstrip("/")
        self.threads = threads
        self.session = requests.Session()
        self.findings = []
        self.lock = threading.Lock()

    def scan_content(self, content, url):
        """Scan content for secrets"""
        findings = []
        
        for secret_name, config in SECRET_PATTERNS.items():
            pattern = config["pattern"]
            matches = re.findall(pattern, content, re.MULTILINE | re.IGNORECASE)
            
            if matches:
                # Deduplicate matches
                unique_matches = list(set(matches[:5]))  # Limit to first 5 unique matches
                
                # Mask sensitive parts
                masked_matches = []
                for match in unique_matches:
                    if isinstance(match, tuple):
                        match = match[0] if match else ""
                    if len(match) > 10:
                        masked = match[:4] + "*" * (len(match) - 8) + match[-4:]
                    else:
                        masked = match[:2] + "*" * (len(match) - 2)
                    masked_matches.append(masked)
                
                findings.append({
                    "type": "secret_exposure",
                    "secret_type": secret_name,
                    "url": url,
                    "severity": config["severity"],
                    "description": config["description"],
                    "evidence": f"Found {len(unique_matches)} match(es): {', '.join(masked_matches)}",
                    "matches_count": len(matches),
                })
                
        return findings

    def check_sensitive_path(self, path):
        """Check a sensitive path for content"""
        url = urljoin(self.base + "/", path.lstrip("/"))
        
        try:
            resp = self.session.get(url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=False)
            
            # Only process successful responses with content
            if resp.status_code == 200 and len(resp.content) > 10:
                findings = self.scan_content(resp.text, url)
                
                # Check if the path itself is sensitive
                if path.endswith(('.env', '.sql', '.bak', 'config', 'credentials', 'id_rsa')):
                    findings.append({
                        "type": "sensitive_file_exposed",
                        "url": url,
                        "path": path,
                        "severity": "HIGH",
                        "description": f"Sensitive file accessible: {path}",
                        "evidence": f"HTTP {resp.status_code}, Content-Length: {len(resp.content)}",
                    })
                    
                return findings
                
        except Exception as e:
            pass
            
        return []

    def scan_response(self, url):
        """Scan a URL response for secrets"""
        try:
            resp = self.session.get(url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
            return self.scan_content(resp.text, url)
        except:
            return []

    def run(self, check_paths=True, custom_urls=None):
        """Run the scanner"""
        all_findings = []
        
        # Scan main page and custom URLs
        urls_to_scan = [self.base]
        if custom_urls:
            urls_to_scan.extend(custom_urls)
            
        for url in urls_to_scan:
            findings = self.scan_response(url)
            all_findings.extend(findings)
            
        # Check sensitive paths
        if check_paths:
            for path in SECRET_PATHS:
                findings = self.check_sensitive_path(path)
                all_findings.extend(findings)
                time.sleep(0.1)  # Rate limiting
                
        # Deduplicate findings
        seen = set()
        unique_findings = []
        for f in all_findings:
            key = (f.get("secret_type", f.get("path", "")), f["url"])
            if key not in seen:
                seen.add(key)
                unique_findings.append(f)
                
        return unique_findings


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Secret Scanner Pro")
    parser.add_argument("--target", "-t", required=True, help="Target URL")
    parser.add_argument("--threads", type=int, default=DEFAULT_THREADS, help="Number of threads")
    parser.add_argument("--no-paths", action="store_true", help="Skip sensitive path checks")
    args = parser.parse_args()
    
    print(f"{Fore.CYAN}[*] Secret Scanner Pro - Starting scan{Style.RESET_ALL}")
    print(f"{Fore.CYAN}[*] Target: {args.target}{Style.RESET_ALL}")
    
    scanner = SecretScanner(args.target, threads=args.threads)
    findings = scanner.run(check_paths=not args.no_paths)
    
    if findings:
        print(f"\n{Fore.RED}[!] Found {len(findings)} potential secrets/exposures:{Style.RESET_ALL}")
        for f in findings:
            color = Fore.RED if f["severity"] == "CRITICAL" else Fore.YELLOW if f["severity"] == "HIGH" else Fore.WHITE
            print(f"  {color}- {f.get('secret_type', f.get('path', 'Unknown'))}: {f['severity']}{Style.RESET_ALL}")
    else:
        print(f"\n{Fore.GREEN}[+] No secrets detected{Style.RESET_ALL}")
        
    # Save report
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(OUTPUT_BASE, f"secrets_report_{ts}.json")
    with open(report_file, "w") as f:
        json.dump({"target": args.target, "findings": findings, "timestamp": utc_now().isoformat()}, f, indent=2)
    print(f"\n{Fore.CYAN}[*] Report saved: {report_file}{Style.RESET_ALL}")


if __name__ == "__main__":
    main()
