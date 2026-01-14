#!/usr/bin/env python3
"""
HEADER & SSL SECURITY ANALYZER PRO
- Analyzes HTTP security headers
- Inspects SSL certificates
- Generates TXT + JSON reports
"""

import requests
import ssl
import socket
import json
import os
from datetime import datetime
from urllib.parse import urlparse
from collections import defaultdict
import re

# ----------------------------
# Folder Setup
# ----------------------------
TXT_DIR = "reports/headers/txt"
JSON_DIR = "reports/headers/json"
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)

# ----------------------------
# Required Security Headers
# ----------------------------
REQUIRED_HEADERS = {
    "strict-transport-security": "HSTS missing (protects against downgrade attacks)",
    "x-frame-options": "Prevents clickjacking",
    "x-content-type-options": "Prevents MIME sniffing",
    "content-security-policy": "CSP missing (major XSS risk)",
    "referrer-policy": "Referrer privacy not enforced",
    "permissions-policy": "Controls browser API permissions",
    "expect-ct": "Certificate transparency missing",
    "cache-control": "Missing cache protections",
}

COOKIE_FLAGS = ["httponly", "secure", "samesite"]

# ----------------------------
# Header Analyzer
# ----------------------------
def analyze_headers(url):
    try:
        r = requests.get(url, timeout=5, allow_redirects=True)
    except Exception as e:
        return None, f"Request failed: {e}"

    headers = {k.lower(): v for k, v in r.headers.items()}

    missing = []
    for h, desc in REQUIRED_HEADERS.items():
        if h not in headers:
            missing.append((h, desc))

    cookies = r.cookies
    cookie_issues = []
    for c in cookies:
        flags = c.__dict__.get("_rest", {})
        for flag in COOKIE_FLAGS:
            if flag not in c.__dict__.get("_rest", {}).keys():
                cookie_issues.append(f"Cookie '{c.name}' missing {flag}")

    server = headers.get("server", "Unknown")

    return {
        "final_url": r.url,
        "status": r.status_code,
        "headers": headers,
        "missing_headers": missing,
        "cookies": {c.name: dict(c.__dict__.get("_rest", {})) for c in cookies},
        "cookie_issues": cookie_issues,
        "server": server,
    }, None

# ----------------------------
# SSL Analyzer
# ----------------------------
def analyze_ssl(domain):
    context = ssl.create_default_context()
    conn = context.wrap_socket(
        socket.socket(socket.AF_INET),
        server_hostname=domain,
    )

    try:
        conn.settimeout(5)
        conn.connect((domain, 443))
        cert = conn.getpeercert()
    except Exception as e:
        return None, f"SSL inspect failed: {e}"

    issuer = dict(x[0] for x in cert.get("issuer", []))
    subject = dict(x[0] for x in cert.get("subject", []))
    valid_from = cert.get("notBefore")
    valid_to = cert.get("notAfter")

    return {
        "issuer": issuer,
        "subject": subject,
        "valid_from": valid_from,
        "valid_to": valid_to,
    }, None

# ----------------------------
# Risk Scoring
# ----------------------------
def score_risk(head, ssl_info):
    score = 0
    reasons = []

    # Missing headers
    score += len(head["missing_headers"]) * 10
    for h, d in head["missing_headers"]:
        reasons.append(f"Missing header: {h} ({d})")

    # Cookie issues
    score += len(head["cookie_issues"]) * 5
    for c in head["cookie_issues"]:
        reasons.append(c)

    # SSL expiry check
    if ssl_info:
        exp = ssl_info["valid_to"]
        try:
            expiry = datetime.strptime(exp, "%b %d %H:%M:%S %Y %Z")
            if expiry < datetime.now():
                score += 30
                reasons.append("SSL certificate expired")
        except:
            pass

    if score >= 70:
        level = "HIGH"
    elif score >= 40:
        level = "MEDIUM"
    else:
        level = "LOW"

    return score, level, reasons

# ----------------------------
# Report Generator
# ----------------------------
def write_reports(client, url, head, ssl_info, risk):
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    base = f"{client}_header_ssl_{ts}"

    txt_path = f"{TXT_DIR}/{base}.txt"
    json_path = f"{JSON_DIR}/{base}.json"

    score, level, reasons = risk

    # TXT REPORT
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=== HEADER & SSL SECURITY ANALYZER PRO ===\n\n")
        f.write(f"Client: {client}\n")
        f.write(f"URL: {url}\n")
        f.write(f"Final URL: {head['final_url']}\n")
        f.write(f"Status: {head['status']}\n\n")

        f.write("=== SERVER INFO ===\n")
        f.write(f"Server: {head['server']}\n\n")

        f.write("=== MISSING HEADERS ===\n")
        for h, desc in head["missing_headers"]:
            f.write(f"- {h}: {desc}\n")
        f.write("\n")

        f.write("=== COOKIE ISSUES ===\n")
        for c in head["cookie_issues"]:
            f.write(f"- {c}\n")
        f.write("\n")

        if ssl_info:
            f.write("=== SSL CERTIFICATE INFO ===\n")
            f.write(f"Issuer: {ssl_info['issuer']}\n")
            f.write(f"Subject: {ssl_info['subject']}\n")
            f.write(f"Valid From: {ssl_info['valid_from']}\n")
            f.write(f"Valid To: {ssl_info['valid_to']}\n\n")

        f.write("=== RISK SCORE ===\n")
        f.write(f"Risk: {score} ({level})\n")
        for r in reasons:
            f.write(f"- {r}\n")
        f.write("\n")

        f.write("=== RECOMMENDATIONS ===\n")
        f.write("- Enable all missing headers\n")
        f.write("- Enforce HTTPS + HSTS\n")
        f.write("- Add Secure/HttpOnly/SameSite cookie flags\n")
        f.write("- Validate certificate chain\n")
        f.write("- Review server exposure\n")

    # JSON REPORT
    out = {
        "client": client,
        "url": url,
        "headers": head,
        "ssl": ssl_info,
        "risk": {
            "score": score,
            "level": level,
            "reasons": reasons,
        },
    }

    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(out, jf, indent=2, ensure_ascii=False)

    print(f"\n[✓] TXT Report → {txt_path}")
    print(f"[✓] JSON Report → {json_path}\n")

# ----------------------------
# Main
# ----------------------------
def main():
    print("\n=== HEADER & SSL SECURITY ANALYZER PRO ===\n")
    client = input("Client name: ").strip()
    url = input("Enter URL (http or https): ").strip()

    if not url.startswith("http"):
        url = "https://" + url

    print("\nAnalyzing headers...")
    head, err = analyze_headers(url)
    if err:
        print("Header error:", err)
        return

    domain = urlparse(url).hostname
    print("Analyzing SSL...")
    ssl_info, err2 = analyze_ssl(domain)

    risk = score_risk(head, ssl_info)

    write_reports(client, url, head, ssl_info, risk)

    print("Finished.\n")


if __name__ == "__main__":
    main()
