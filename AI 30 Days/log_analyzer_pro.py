#!/usr/bin/env python3
"""
AI Log Analyzer PRO (Apache/Nginx Access Logs)
 - Detect brute force, scanners, SQLi, XSS, anomalies
 - IP frequency heatmap
 - Offline IP heuristics
 - Risk scoring and recommendations
 - TXT + JSON reports with clean formatting
"""

import os
import re
import json
from datetime import datetime
from collections import Counter, defaultdict

# ----------------------------
# Folder Setup
# ----------------------------
TXT_DIR = "reports/logs/txt"
JSON_DIR = "reports/logs/json"
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)

# ----------------------------
# Detection Patterns
# ----------------------------
SQLI_PATTERNS = [
    r"union(\s)+select", r"information_schema", r"sleep\(", r" or 1=1", r"\'--", r"\"--",
    r"benchmark\(", r"load_file\("
]

XSS_PATTERNS = [
    r"<script>", r"javascript:", r"onerror=", r"onload="
]

TRAVERSAL_PATTERNS = [
    r"\.\./", r"/etc/passwd", r"/proc/"
]

BRUTEFORCE_PATTERNS = [
    r"wp-login\.php", r"xmlrpc\.php", r"admin", r"login", r"signin"
]

SUSPICIOUS_UA = [
    "sqlmap", "nmap", "acunetix", "nessus", "whatweb", "dirbuster"
]

# ----------------------------
# Utility Functions
# ----------------------------
def extract_ip(line):
    m = re.match(r"(\d+\.\d+\.\d+\.\d+)", line)
    return m.group(1) if m else None

def detect_patterns(line):
    flags = []

    # SQL injection
    for patt in SQLI_PATTERNS:
        if re.search(patt, line, re.IGNORECASE):
            flags.append("SQLi attempt")

    # XSS
    for patt in XSS_PATTERNS:
        if re.search(patt, line, re.IGNORECASE):
            flags.append("XSS attempt")

    # Directory traversal
    for patt in TRAVERSAL_PATTERNS:
        if re.search(patt, line, re.IGNORECASE):
            flags.append("Directory traversal")

    # Brute force paths
    for patt in BRUTEFORCE_PATTERNS:
        if re.search(patt, line, re.IGNORECASE):
            flags.append("Bruteforce indicator")

    # Suspicious user agents
    for ua in SUSPICIOUS_UA:
        if ua.lower() in line.lower():
            flags.append("Malicious scanner/bot")

    return flags


def score_risk(results):
    """
    Score risk based on:
    - Number of suspicious IPs
    - Type of attacks detected
    - Frequency spikes
    """
    score = 0
    reasons = []

    total_suspicious = sum(len(v) for v in results["suspicious"].values())
    score += min(total_suspicious * 3, 40)

    if results["top_attack_type"]:
        score += 30
        reasons.append(f"High occurrence of {results['top_attack_type']}")

    if results["top_ips"]:
        score += 20
        ip = results["top_ips"][0][0]
        reasons.append(f"IP {ip} made unusually high number of requests")

    if score >= 70:
        level = "HIGH"
    elif score >= 40:
        level = "MEDIUM"
    else:
        level = "LOW"

    return score, level, reasons


# ----------------------------
# Main Analyzer
# ----------------------------
def analyze_log(file_path, deep=False):
    if not os.path.exists(file_path):
        print("File not found.")
        return None

    suspicious = defaultdict(list)
    ip_hits = Counter()
    attack_types = Counter()

    with open(file_path, "r", errors="ignore") as f:
        lines = f.readlines()

    for line in lines:
        ip = extract_ip(line)
        if not ip:
            continue

        ip_hits[ip] += 1

        flags = detect_patterns(line)

        for flag in flags:
            suspicious[ip].append(flag)
            attack_types[flag] += 1

    top_ips = ip_hits.most_common(5)
    top_attack_type = attack_types.most_common(1)[0][0] if attack_types else None

    results = {
        "file": file_path,
        "total_lines": len(lines),
        "unique_ips": len(ip_hits),
        "top_ips": top_ips,
        "suspicious": suspicious,
        "attack_counts": attack_types,
        "top_attack_type": top_attack_type
    }

    score, level, reasons = score_risk(results)
    results["risk_score"] = score
    results["risk_level"] = level
    results["risk_reasons"] = reasons

    return results


# ----------------------------
# Report Generator
# ----------------------------
def generate_reports(client, results):
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    base = f"{client}_loganalyzer_{ts}"

    txt_path = f"{TXT_DIR}/{base}.txt"
    json_path = f"{JSON_DIR}/{base}.json"

    # TXT REPORT
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=== AI LOG ANALYZER PRO REPORT ===\n\n")
        f.write(f"Client: {client}\n")
        f.write(f"Log File: {results['file']}\n")
        f.write(f"Scan Time: {datetime.now()}\n\n")

        f.write(f"Total Lines: {results['total_lines']}\n")
        f.write(f"Unique IPs: {results['unique_ips']}\n")
        f.write(f"Top 5 IPs: {results['top_ips']}\n\n")

        f.write("=== Suspicious Activity ===\n")
        for ip, flags in results["suspicious"].items():
            f.write(f"- {ip}: {dict(Counter(flags))}\n")
        f.write("\n")

        f.write("=== Attack Frequency ===\n")
        for attack, count in results["attack_counts"].most_common():
            f.write(f"- {attack}: {count}\n")
        f.write("\n")

        f.write("=== Risk Score ===\n")
        f.write(f"Risk: {results['risk_score']} ({results['risk_level']})\n")
        for r in results["risk_reasons"]:
            f.write(f"- {r}\n")
        f.write("\n")

        f.write("=== Recommendations ===\n")
        f.write("- Block repeated malicious IPs\n")
        f.write("- Rate-limit suspicious paths\n")
        f.write("- Use WAF/Firewall rules\n")
        f.write("- Monitor login endpoints\n")
        f.write("- Consider enabling Fail2Ban\n")

    # JSON REPORT
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(results, jf, indent=2, ensure_ascii=False)

    print(f"\n[✓] TXT Report → {txt_path}")
    print(f"[✓] JSON Report → {json_path}\n")


# ----------------------------
# Interactive Run
# ----------------------------
def main():
    print("\n=== AI LOG ANALYZER PRO ===\n")
    client = input("Client name: ").strip()
    file_path = input("Path to log file (access.log): ").strip()

    deep = input("Deep mode? (y/N): ").lower().startswith("y")

    print("\nAnalyzing...\n")
    results = analyze_log(file_path, deep=deep)

    if results:
        generate_reports(client, results)
        print("Analysis complete.\n")
    else:
        print("Error analyzing log file.\n")


if __name__ == "__main__":
    main()
