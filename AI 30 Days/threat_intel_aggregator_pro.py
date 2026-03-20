#!/usr/bin/env python3
"""
Threat Intelligence Aggregator PRO — Folder Auto-Scan Version
- Auto-scans files & folders for IPs
- Offline ASN heuristics
- Threat scoring
- TXT + JSON reports
"""

import os
import json
from datetime import datetime
from collections import defaultdict, Counter
import re

# ------------------------
# Folder Setup
# ------------------------
TXT_DIR = "reports/threatintel/txt"
JSON_DIR = "reports/threatintel/json"
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)

# ------------------------
# Offline Patterns (Heuristics)
# ------------------------
CLOUD_ASN_KEYWORDS = [
    "aws", "amazon", "google", "gcp", "azure",
    "digitalocean", "contabo", "vultr", "linode", "oracle"
]

KNOWN_SCANNER_AGENTS = [
    "sqlmap", "acunetix", "nessus", "nmap", "masscan",
    "whatweb", "dirbuster", "skipfish", "nikto"
]

TOR_PATTERNS = [
    r".*tor.*", r".*exit.*"
]

VPN_PATTERNS = [
    r".*vpn.*", r".*proxy.*"
]

COUNTRY_GUESS = {
    "aws": "US",
    "google": "US",
    "azure": "US",
    "digitalocean": "US",
    "ovh": "FR",
    "hetzner": "DE",
    "contabo": "DE",
    "linode": "US",
    "vultr": "US",
}

def guess_country_from_asn(asn):
    if not asn:
        return "Unknown"
    for key, c in COUNTRY_GUESS.items():
        if key in asn.lower():
            return c
    return "Unknown"

# ------------------------
# Threat scoring
# ------------------------
def score_ip(data):
    score = 0
    reasons = []

    if data["counts"] > 50:
        score += 20
        reasons.append("High activity volume")

    if data["flags"]:
        score += len(data["flags"]) * 10
        reasons.extend(data["flags"])

    # Cloud bots
    if data["asn"] and any(k in data["asn"].lower() for k in CLOUD_ASN_KEYWORDS):
        score += 10
        reasons.append("Cloud provider IP (bot likelihood)")

    # Tor
    if any(re.match(p, data["asn"], re.I) for p in TOR_PATTERNS):
        score += 15
        reasons.append("Possible Tor exit node")

    # VPN
    if any(re.match(p, data["asn"], re.I) for p in VPN_PATTERNS):
        score += 5
        reasons.append("Possible VPN/proxy")

    if score >= 70:
        level = "MALICIOUS"
    elif score >= 40:
        level = "SUSPICIOUS"
    else:
        level = "LOW-RISK"

    return score, level, list(dict.fromkeys(reasons))


# ------------------------
# File & folder scanning
# ------------------------
def extract_ips_from_text(text):
    return re.findall(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", text)

def scan_file(path, all_ips):
    try:
        with open(path, "r", errors="ignore") as f:
            content = f.read()
            ips = extract_ips_from_text(content)
            for ip in ips:
                all_ips[ip] += 1
    except:
        pass

def scan_folder(folder_path, all_ips):
    for root, dirs, files in os.walk(folder_path):
        for fn in files:
            if fn.lower().endswith((".txt", ".log", ".json")):
                scan_file(os.path.join(root, fn), all_ips)

# ------------------------
# Main IP analyzer
# ------------------------
def analyze_ips(all_ips):
    results = {}

    for ip, count in all_ips.items():
        # ASN simulation (offline)
        if ip.endswith(".1"):
            asn = "AWS-EC2"
        elif ip.endswith(".2"):
            asn = "DigitalOcean"
        else:
            asn = "Generic-VPS"

        data = {
            "ip": ip,
            "counts": count,
            "asn": asn,
            "country": guess_country_from_asn(asn),
            "flags": []
        }

        # agent-based heuristics
        asn_lower = asn.lower()
        for agent in KNOWN_SCANNER_AGENTS:
            if agent in asn_lower:
                data["flags"].append(f"Known scanner: {agent}")

        # tor / vpn
        if any(re.match(p, asn_lower, re.I) for p in TOR_PATTERNS):
            data["flags"].append("Tor exit node")

        if any(re.match(p, asn_lower, re.I) for p in VPN_PATTERNS):
            data["flags"].append("VPN/Proxy pattern")

        # score
        score, level, reasons = score_ip(data)
        data["risk_score"] = score
        data["risk_level"] = level
        data["risk_reasons"] = reasons

        results[ip] = data

    return results

# ------------------------
# Report Writer
# ------------------------
def write_reports(client, results):
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    base = f"{client}_threatintel_{ts}"
    txt_path = f"{TXT_DIR}/{base}.txt"
    json_path = f"{JSON_DIR}/{base}.json"

    # TXT
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=== THREAT INTELLIGENCE AGGREGATOR PRO ===\n\n")
        f.write(f"Client: {client}\n")
        f.write(f"Generated: {datetime.now()}\n\n")

        for ip, data in results.items():
            f.write(f"- IP: {ip}\n")
            f.write(f"  ASN: {data['asn']}\n")
            f.write(f"  Country: {data['country']}\n")
            f.write(f"  Hit Count: {data['counts']}\n")
            f.write(f"  Risk Score: {data['risk_score']} ({data['risk_level']})\n")
            if data["risk_reasons"]:
                f.write("  Reasons:\n")
                for r in data["risk_reasons"]:
                    f.write(f"   - {r}\n")
            f.write("\n")

    # JSON
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(results, jf, indent=2, ensure_ascii=False)

    print(f"\n[✓] TXT report → {txt_path}")
    print(f"[✓] JSON report → {json_path}\n")


# ------------------------
# Interactive Runner
# ------------------------
def main():
    print("\n=== THREAT INTELLIGENCE AGGREGATOR PRO (AUTO-FOLDER SCAN) ===\n")
    client = input("Client name: ").strip()

    print("\nEnter file or folder paths (comma separated).")
    print("Example: reports/, reports/subdomains_pro/txt/, my_ips.txt\n")

    inputs = input("Paths: ").strip()

    all_ips = Counter()

    if inputs:
        paths = [p.strip() for p in inputs.split(",")]
        for p in paths:
            if os.path.isdir(p):
                print(f"[SCAN] Folder → {p}")
                scan_folder(p, all_ips)
            elif os.path.isfile(p):
                print(f"[SCAN] File → {p}")
                scan_file(p, all_ips)
            else:
                print(f"[WARN] Path not found: {p}")

    # Manual entry fallback
    manual = input("\nEnter IPs manually (comma separated, blank to skip): ").strip()
    if manual:
        for ip in manual.split(","):
            ip = ip.strip()
            if re.match(r"\d+\.\d+\.\d+\.\d+", ip):
                all_ips[ip] += 1

    print("\nAnalyzing...\n")

    results = analyze_ips(all_ips)
    write_reports(client, results)

    print("Done.\n")


if __name__ == "__main__":
    main()
