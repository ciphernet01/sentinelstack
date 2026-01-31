#!/usr/bin/env python3
"""
Technology Fingerprinter Pro — Enterprise Edition
Detect web technologies, frameworks, and versions for CVE matching

Features:
- Server technology detection
- Framework detection (React, Angular, Vue, Django, Rails, etc.)
- CMS detection (WordPress, Drupal, Joomla, etc.)
- JavaScript library detection with versions
- Server software version extraction
- Known vulnerability matching
"""

import os
import re
import json
import time
import random
import hashlib
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from collections import defaultdict

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
OUTPUT_BASE = os.path.join("reports", "tech_fingerprint")
os.makedirs(OUTPUT_BASE, exist_ok=True)

# Technology fingerprints
HEADER_FINGERPRINTS = {
    "Server": {
        r"nginx/?(\d+\.[\d\.]+)?": {"tech": "nginx", "category": "web_server"},
        r"Apache/?(\d+\.[\d\.]+)?": {"tech": "Apache", "category": "web_server"},
        r"Microsoft-IIS/?(\d+\.[\d\.]+)?": {"tech": "IIS", "category": "web_server"},
        r"cloudflare": {"tech": "Cloudflare", "category": "cdn"},
        r"AmazonS3": {"tech": "Amazon S3", "category": "storage"},
        r"gunicorn/?(\d+\.[\d\.]+)?": {"tech": "Gunicorn", "category": "web_server"},
        r"Werkzeug/?(\d+\.[\d\.]+)?": {"tech": "Werkzeug", "category": "web_server"},
        r"openresty/?(\d+\.[\d\.]+)?": {"tech": "OpenResty", "category": "web_server"},
        r"LiteSpeed": {"tech": "LiteSpeed", "category": "web_server"},
        r"Caddy": {"tech": "Caddy", "category": "web_server"},
    },
    "X-Powered-By": {
        r"PHP/?(\d+\.[\d\.]+)?": {"tech": "PHP", "category": "language"},
        r"ASP\.NET": {"tech": "ASP.NET", "category": "framework"},
        r"Express": {"tech": "Express.js", "category": "framework"},
        r"Next\.js": {"tech": "Next.js", "category": "framework"},
        r"Nuxt": {"tech": "Nuxt.js", "category": "framework"},
        r"Django": {"tech": "Django", "category": "framework"},
        r"Rails": {"tech": "Ruby on Rails", "category": "framework"},
        r"Servlet": {"tech": "Java Servlet", "category": "framework"},
        r"Phusion Passenger": {"tech": "Passenger", "category": "web_server"},
    },
    "X-AspNet-Version": {
        r"(\d+\.[\d\.]+)": {"tech": "ASP.NET", "category": "framework"},
    },
    "X-AspNetMvc-Version": {
        r"(\d+\.[\d\.]+)": {"tech": "ASP.NET MVC", "category": "framework"},
    },
    "X-Generator": {
        r"Drupal\s*(\d+)?": {"tech": "Drupal", "category": "cms"},
        r"WordPress\s*([\d\.]+)?": {"tech": "WordPress", "category": "cms"},
        r"Joomla": {"tech": "Joomla", "category": "cms"},
    },
}

# HTML/Body fingerprints
HTML_FINGERPRINTS = {
    # CMS
    r'<meta name="generator" content="WordPress\s*([\d\.]+)?"': {"tech": "WordPress", "category": "cms"},
    r'/wp-content/': {"tech": "WordPress", "category": "cms"},
    r'/wp-includes/': {"tech": "WordPress", "category": "cms"},
    r'<meta name="generator" content="Drupal\s*(\d+)?"': {"tech": "Drupal", "category": "cms"},
    r'/sites/default/files/': {"tech": "Drupal", "category": "cms"},
    r'<meta name="generator" content="Joomla': {"tech": "Joomla", "category": "cms"},
    r'/media/system/': {"tech": "Joomla", "category": "cms"},
    r'Powered by <a[^>]*>Shopify</a>': {"tech": "Shopify", "category": "ecommerce"},
    r'/cdn\.shopify\.com/': {"tech": "Shopify", "category": "ecommerce"},
    r'<meta name="generator" content="Ghost': {"tech": "Ghost", "category": "cms"},
    r'<meta name="generator" content="Hugo': {"tech": "Hugo", "category": "ssg"},
    r'<meta name="generator" content="Jekyll': {"tech": "Jekyll", "category": "ssg"},
    r'<meta name="generator" content="Gatsby': {"tech": "Gatsby", "category": "ssg"},
    
    # Frontend Frameworks
    r'<div id="__next"': {"tech": "Next.js", "category": "framework"},
    r'/_next/': {"tech": "Next.js", "category": "framework"},
    r'<div id="__nuxt"': {"tech": "Nuxt.js", "category": "framework"},
    r'/_nuxt/': {"tech": "Nuxt.js", "category": "framework"},
    r'ng-app=': {"tech": "AngularJS", "category": "framework"},
    r'ng-version="(\d+)': {"tech": "Angular", "category": "framework"},
    r'<script[^>]*id="__GATSBY"': {"tech": "Gatsby", "category": "framework"},
    r'data-reactroot': {"tech": "React", "category": "framework"},
    r'<div id="app"[^>]*data-v-': {"tech": "Vue.js", "category": "framework"},
    r'<script[^>]*src="[^"]*vue[^"]*\.js': {"tech": "Vue.js", "category": "framework"},
    r'<script[^>]*src="[^"]*svelte': {"tech": "Svelte", "category": "framework"},
    
    # JavaScript Libraries
    r'jquery[.-](\d+\.[\d\.]+)': {"tech": "jQuery", "category": "js_library"},
    r'bootstrap[.-](\d+\.[\d\.]+)': {"tech": "Bootstrap", "category": "css_framework"},
    r'lodash[.-](\d+\.[\d\.]+)': {"tech": "Lodash", "category": "js_library"},
    r'moment[.-](\d+\.[\d\.]+)': {"tech": "Moment.js", "category": "js_library"},
    r'axios[.-](\d+\.[\d\.]+)': {"tech": "Axios", "category": "js_library"},
    
    # Analytics/Tracking
    r'google-analytics\.com/': {"tech": "Google Analytics", "category": "analytics"},
    r'googletagmanager\.com/': {"tech": "Google Tag Manager", "category": "analytics"},
    r'hotjar\.com/': {"tech": "Hotjar", "category": "analytics"},
    r'segment\.com/': {"tech": "Segment", "category": "analytics"},
    r'mixpanel\.com/': {"tech": "Mixpanel", "category": "analytics"},
    r'amplitude\.com/': {"tech": "Amplitude", "category": "analytics"},
    
    # Authentication
    r'auth0\.com/': {"tech": "Auth0", "category": "auth"},
    r'firebase\.google\.com/': {"tech": "Firebase", "category": "backend"},
    r'cognito-': {"tech": "AWS Cognito", "category": "auth"},
    r'okta\.com/': {"tech": "Okta", "category": "auth"},
    
    # CDN
    r'cdn\.jsdelivr\.net/': {"tech": "jsDelivr", "category": "cdn"},
    r'cdnjs\.cloudflare\.com/': {"tech": "cdnjs", "category": "cdn"},
    r'unpkg\.com/': {"tech": "unpkg", "category": "cdn"},
    r'maxcdn\.bootstrapcdn\.com/': {"tech": "BootstrapCDN", "category": "cdn"},
    
    # Hosting indicators
    r'vercel\.com': {"tech": "Vercel", "category": "hosting"},
    r'netlify\.app': {"tech": "Netlify", "category": "hosting"},
    r'herokuapp\.com': {"tech": "Heroku", "category": "hosting"},
    r'\.azurewebsites\.net': {"tech": "Azure App Service", "category": "hosting"},
    r'\.appspot\.com': {"tech": "Google App Engine", "category": "hosting"},
    r'\.amplifyapp\.com': {"tech": "AWS Amplify", "category": "hosting"},
}

# Cookie fingerprints
COOKIE_FINGERPRINTS = {
    r'PHPSESSID': {"tech": "PHP", "category": "language"},
    r'JSESSIONID': {"tech": "Java", "category": "language"},
    r'ASP\.NET_SessionId': {"tech": "ASP.NET", "category": "framework"},
    r'_rails_': {"tech": "Ruby on Rails", "category": "framework"},
    r'laravel_session': {"tech": "Laravel", "category": "framework"},
    r'ci_session': {"tech": "CodeIgniter", "category": "framework"},
    r'express\.sid': {"tech": "Express.js", "category": "framework"},
    r'connect\.sid': {"tech": "Express.js", "category": "framework"},
    r'csrftoken': {"tech": "Django", "category": "framework"},
    r'_csrf': {"tech": "Node.js (csurf)", "category": "security"},
    r'wordpress_': {"tech": "WordPress", "category": "cms"},
    r'wp-': {"tech": "WordPress", "category": "cms"},
}

# Known vulnerable versions (simplified CVE database)
KNOWN_VULNS = {
    "jQuery": {
        "< 3.5.0": {"cve": "CVE-2020-11022", "severity": "MEDIUM", "description": "XSS via html() method"},
        "< 3.4.0": {"cve": "CVE-2019-11358", "severity": "MEDIUM", "description": "Prototype pollution"},
        "< 1.9.0": {"cve": "CVE-2015-9251", "severity": "MEDIUM", "description": "XSS vulnerabilities"},
    },
    "Angular": {
        "< 9.0.0": {"cve": "Multiple", "severity": "MEDIUM", "description": "Various XSS issues in older versions"},
    },
    "WordPress": {
        "< 6.0.0": {"cve": "Multiple", "severity": "HIGH", "description": "Various security issues"},
        "< 5.8.0": {"cve": "CVE-2022-21661", "severity": "HIGH", "description": "SQL injection"},
    },
    "Drupal": {
        "< 9.3.0": {"cve": "Multiple", "severity": "HIGH", "description": "Various security updates"},
        "7": {"cve": "End of Life", "severity": "HIGH", "description": "Drupal 7 is EOL"},
    },
    "PHP": {
        "< 8.0.0": {"cve": "Multiple", "severity": "MEDIUM", "description": "PHP 7.x has known vulnerabilities"},
        "< 7.4.0": {"cve": "Multiple", "severity": "HIGH", "description": "PHP < 7.4 has critical vulnerabilities"},
    },
    "nginx": {
        "< 1.20.0": {"cve": "Multiple", "severity": "MEDIUM", "description": "Various security fixes"},
    },
    "Apache": {
        "< 2.4.50": {"cve": "CVE-2021-41773", "severity": "CRITICAL", "description": "Path traversal"},
    },
}


def utc_now():
    return datetime.now(timezone.utc)


def random_headers():
    return {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
        ]),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }


def parse_version(version_str):
    """Parse version string to tuple for comparison"""
    if not version_str:
        return (0,)
    try:
        parts = re.findall(r'\d+', str(version_str))
        return tuple(int(p) for p in parts[:3]) if parts else (0,)
    except:
        return (0,)


def version_compare(detected, vuln_spec):
    """Compare detected version against vulnerability specification"""
    if vuln_spec.startswith("< "):
        vuln_version = parse_version(vuln_spec[2:])
        detected_version = parse_version(detected)
        return detected_version < vuln_version
    elif vuln_spec == detected:
        return True
    return False


class TechFingerprinter:
    def __init__(self, base_url):
        self.base = base_url.rstrip("/")
        self.session = requests.Session()
        self.technologies = defaultdict(list)
        self.findings = []

    def fingerprint_headers(self, headers):
        """Extract technology info from response headers"""
        for header_name, patterns in HEADER_FINGERPRINTS.items():
            header_value = headers.get(header_name, "")
            if not header_value:
                continue
                
            for pattern, info in patterns.items():
                match = re.search(pattern, header_value, re.IGNORECASE)
                if match:
                    version = match.group(1) if match.lastindex and match.group(1) else None
                    self.add_technology(info["tech"], info["category"], version, f"Header: {header_name}")

    def fingerprint_cookies(self, cookies):
        """Extract technology info from cookies"""
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        
        for pattern, info in COOKIE_FINGERPRINTS.items():
            if re.search(pattern, cookie_str, re.IGNORECASE):
                self.add_technology(info["tech"], info["category"], None, "Cookie pattern")

    def fingerprint_html(self, html):
        """Extract technology info from HTML content"""
        for pattern, info in HTML_FINGERPRINTS.items():
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                version = match.group(1) if match.lastindex and match.group(1) else None
                self.add_technology(info["tech"], info["category"], version, "HTML pattern")

    def add_technology(self, tech, category, version, source):
        """Add detected technology"""
        existing = next((t for t in self.technologies[category] if t["name"] == tech), None)
        
        if existing:
            if version and not existing.get("version"):
                existing["version"] = version
            if source not in existing.get("sources", []):
                existing.setdefault("sources", []).append(source)
        else:
            self.technologies[category].append({
                "name": tech,
                "category": category,
                "version": version,
                "sources": [source],
            })

    def check_vulnerabilities(self):
        """Check detected technologies for known vulnerabilities"""
        vulns = []
        
        for category, techs in self.technologies.items():
            for tech in techs:
                tech_name = tech["name"]
                version = tech.get("version")
                
                if tech_name in KNOWN_VULNS:
                    for vuln_version, vuln_info in KNOWN_VULNS[tech_name].items():
                        if version_compare(version, vuln_version):
                            vulns.append({
                                "technology": tech_name,
                                "detected_version": version or "unknown",
                                "vulnerable_spec": vuln_version,
                                "cve": vuln_info["cve"],
                                "severity": vuln_info["severity"],
                                "description": vuln_info["description"],
                            })
                            break
                            
        return vulns

    def scan_additional_paths(self):
        """Check additional paths for technology hints"""
        paths_to_check = [
            "/robots.txt",
            "/sitemap.xml",
            "/humans.txt",
            "/package.json",
            "/composer.json",
            "/Gemfile",
            "/requirements.txt",
        ]
        
        for path in paths_to_check:
            url = urljoin(self.base + "/", path.lstrip("/"))
            try:
                resp = self.session.get(url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False, allow_redirects=False)
                if resp.status_code == 200:
                    # Package.json reveals Node.js ecosystem
                    if "package.json" in path and "{" in resp.text:
                        self.add_technology("Node.js", "runtime", None, "package.json exists")
                        try:
                            pkg = json.loads(resp.text)
                            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                            for dep in ["react", "vue", "angular", "express", "next", "nuxt", "svelte"]:
                                if dep in deps:
                                    self.add_technology(dep.title(), "framework", deps[dep].replace("^", "").replace("~", ""), "package.json")
                        except:
                            pass
                    # Composer.json reveals PHP ecosystem
                    elif "composer.json" in path:
                        self.add_technology("PHP", "language", None, "composer.json exists")
                        try:
                            pkg = json.loads(resp.text)
                            deps = pkg.get("require", {})
                            if "laravel/framework" in deps:
                                self.add_technology("Laravel", "framework", deps.get("laravel/framework"), "composer.json")
                            if "symfony/symfony" in deps:
                                self.add_technology("Symfony", "framework", deps.get("symfony/symfony"), "composer.json")
                        except:
                            pass
                    # Gemfile reveals Ruby ecosystem
                    elif "Gemfile" in path:
                        self.add_technology("Ruby", "language", None, "Gemfile exists")
                        if "rails" in resp.text.lower():
                            self.add_technology("Ruby on Rails", "framework", None, "Gemfile")
                    # requirements.txt reveals Python
                    elif "requirements.txt" in path:
                        self.add_technology("Python", "language", None, "requirements.txt exists")
                        if "django" in resp.text.lower():
                            self.add_technology("Django", "framework", None, "requirements.txt")
                        if "flask" in resp.text.lower():
                            self.add_technology("Flask", "framework", None, "requirements.txt")
                        if "fastapi" in resp.text.lower():
                            self.add_technology("FastAPI", "framework", None, "requirements.txt")
            except:
                pass

    def run(self):
        """Run the fingerprinting scan"""
        try:
            resp = self.session.get(self.base, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
            
            # Fingerprint from various sources
            self.fingerprint_headers(resp.headers)
            self.fingerprint_cookies(self.session.cookies.get_dict())
            self.fingerprint_html(resp.text)
            
            # Check additional paths
            self.scan_additional_paths()
            
            # Check for vulnerabilities
            vulnerabilities = self.check_vulnerabilities()
            
            return {
                "technologies": dict(self.technologies),
                "vulnerabilities": vulnerabilities,
                "summary": {
                    "total_technologies": sum(len(t) for t in self.technologies.values()),
                    "categories": list(self.technologies.keys()),
                    "critical_vulns": len([v for v in vulnerabilities if v["severity"] == "CRITICAL"]),
                    "high_vulns": len([v for v in vulnerabilities if v["severity"] == "HIGH"]),
                }
            }
            
        except Exception as e:
            return {"error": str(e), "technologies": {}, "vulnerabilities": []}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Technology Fingerprinter Pro")
    parser.add_argument("--target", "-t", required=True, help="Target URL")
    args = parser.parse_args()
    
    print(f"{Fore.CYAN}[*] Technology Fingerprinter Pro - Starting scan{Style.RESET_ALL}")
    print(f"{Fore.CYAN}[*] Target: {args.target}{Style.RESET_ALL}")
    
    scanner = TechFingerprinter(args.target)
    results = scanner.run()
    
    if results.get("technologies"):
        print(f"\n{Fore.GREEN}[+] Detected Technologies:{Style.RESET_ALL}")
        for category, techs in results["technologies"].items():
            print(f"\n  {Fore.CYAN}{category.upper()}{Style.RESET_ALL}")
            for tech in techs:
                version = f" v{tech['version']}" if tech.get('version') else ""
                print(f"    - {tech['name']}{version}")
                
    if results.get("vulnerabilities"):
        print(f"\n{Fore.RED}[!] Known Vulnerabilities:{Style.RESET_ALL}")
        for vuln in results["vulnerabilities"]:
            color = Fore.RED if vuln["severity"] == "CRITICAL" else Fore.YELLOW
            print(f"  {color}- {vuln['technology']} {vuln['detected_version']}: {vuln['cve']} ({vuln['severity']}){Style.RESET_ALL}")
            print(f"    {vuln['description']}")
    else:
        print(f"\n{Fore.GREEN}[+] No known vulnerabilities detected{Style.RESET_ALL}")
        
    # Save report
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(OUTPUT_BASE, f"tech_report_{ts}.json")
    with open(report_file, "w") as f:
        json.dump({"target": args.target, **results, "timestamp": utc_now().isoformat()}, f, indent=2)
    print(f"\n{Fore.CYAN}[*] Report saved: {report_file}{Style.RESET_ALL}")


if __name__ == "__main__":
    main()
