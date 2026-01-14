#!/usr/bin/env python3
"""
Port Scanner PRO — Multi-threaded, banner-grabbing, CVE-hinting, OS fingerprinting
Usage: run interactively. Use only on targets you have permission to test.
"""
import socket
import threading
import queue
import json
import os
import re
import subprocess
import time
from datetime import datetime
from collections import Counter

# External libs
try:
    from colorama import init as colorama_init, Fore, Style
    import requests
except Exception:
    print("Missing dependencies. Run: python -m pip install colorama requests")
    raise

colorama_init(autoreset=True)

# -----------------------------
# Configuration
# -----------------------------
COMMON_PORTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 139: "NetBIOS", 143: "IMAP", 161: "SNMP",
    443: "HTTPS", 445: "SMB", 3306: "MySQL", 3389: "RDP", 5900: "VNC",
    6379: "Redis", 8080: "HTTP-Proxy"
}

REPORT_TXT_DIR = "reports/txt"
REPORT_JSON_DIR = "reports/json"
os.makedirs(REPORT_TXT_DIR, exist_ok=True)
os.makedirs(REPORT_JSON_DIR, exist_ok=True)

# Thread queue
q = queue.Queue()
lock = threading.Lock()

# Small offline CVE hint rules (pattern -> messages)
CVE_HINT_RULES = [
    # pattern (service/version regex), hint
    (re.compile(r"OpenSSH[_/\-\s]?([0-9]+\.[0-9]+(\.[0-9]+)?)", re.I),
     "Older OpenSSH versions (<7.0 or 6.x) may have known user enumeration or info-leak CVEs. Consider upgrading OpenSSH."),
    (re.compile(r"Apache/?([0-9]+\.[0-9]+)", re.I),
     "Old Apache 2.2/2.4 versions may have multiple CVEs — ensure it's patched and modules are updated."),
    (re.compile(r"nginx/?([0-9]+\.[0-9]+)", re.I),
     "Older nginx builds may expose misconfigurations; validate server tokens and module updates."),
    (re.compile(r"Microsoft-IIS/?([0-9]+\.[0-9]+)?", re.I),
     "IIS servers can expose outdated endpoints; confirm latest Windows updates."),
    (re.compile(r"ProFTPD/?([0-9]+\.[0-9]+)", re.I),
     "ProFTPD historic CVEs exist; ensure secure config and latest patches."),
    (re.compile(r"vsftpd", re.I),
     "vsftpd should be configured securely; check for anonymous or legacy modules."),
    (re.compile(r"MySQL/?([0-9]+\.[0-9]+)", re.I),
     "Legacy MySQL (5.x) has known auth/privilege issues — consider using newer releases or strong auth."),
]

# Banner version extraction helpers
def extract_version_from_banner(banner_text):
    if not banner_text:
        return None
    for patt, _ in CVE_HINT_RULES:
        m = patt.search(banner_text)
        if m:
            return m.group(0)
    return None

def cve_hints_from_banner(banner_text):
    hints = []
    for patt, hint in CVE_HINT_RULES:
        if patt.search(banner_text or ""):
            hints.append(hint)
    return list(dict.fromkeys(hints))

# -----------------------------
# Utilities
# -----------------------------
def banner_grab(ip, port, recv_len=1024, timeout=1.0):
    """Attempt to grab a banner for a service (TCP connect then recv)."""
    try:
        s = socket.socket()
        s.settimeout(timeout)
        s.connect((ip, port))
        try:
            data = s.recv(recv_len)
            banner = data.decode(errors="ignore").strip()
        except Exception:
            banner = ""
        s.close()
        return banner
    except Exception:
        return ""

def ping_ttl(host, count=1, timeout=2):
    """Ping and parse TTL. Returns TTL int or None. Works via system ping command."""
    try:
        # Windows vs Unix ping args
        param = "-n" if os.name == "nt" else "-c"
        cmd = ["ping", param, str(count), "-w", str(timeout*1000) if os.name == "nt" else "-W", str(timeout), host]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout+2)
        out = proc.stdout + proc.stderr
        # find "TTL=" or "ttl="
        m = re.search(r"[Tt][Tt][Ll]=\s*(\d+)", out)
        if not m:
            m = re.search(r"ttl=(\d+)", out)
        if m:
            return int(m.group(1))
    except Exception:
        return None
    return None

def ttl_to_os(ttl):
    """Heuristic TTL -> OS mapping (very rough)."""
    if ttl is None:
        return None
    if ttl >= 128:
        return "Windows (likely)"
    if 60 <= ttl <= 80:
        return "Linux/Unix (likely)"
    if ttl >= 200:
        return "Network device / Embedded"
    return "Unknown"

def http_head_info(hostname, timeout=2):
    """Try an HTTP HEAD/GET to collect Server header and status"""
    try:
        url = "https://" + hostname
        r = requests.get(url, timeout=timeout, allow_redirects=True)
        return {"status": r.status_code, "server": r.headers.get("Server"), "final_url": r.url}
    except requests.exceptions.SSLError:
        # try http
        try:
            url = "http://" + hostname
            r = requests.get(url, timeout=timeout, allow_redirects=True)
            return {"status": r.status_code, "server": r.headers.get("Server"), "final_url": r.url}
        except Exception:
            return None
    except Exception:
        try:
            url = "http://" + hostname
            r = requests.get(url, timeout=timeout, allow_redirects=True)
            return {"status": r.status_code, "server": r.headers.get("Server"), "final_url": r.url}
        except Exception:
            return None

# -----------------------------
# Scanner worker
# -----------------------------
def worker(target, port, results):
    ip = target
    try:
        sock = socket.socket()
        sock.settimeout(0.6)
        res = sock.connect_ex((ip, port))
        sock.close()
        if res == 0:
            banner = banner_grab(ip, port, timeout=0.8)
            service = COMMON_PORTS.get(port, "unknown")
            version = extract_version_from_banner(banner)
            hints = cve_hints_from_banner(banner)
            results.append({
                "port": port,
                "service": service,
                "banner": banner,
                "version_found": version,
                "cve_hints": hints
            })
            with lock:
                print(Fore.RED + f"[OPEN] {port} | {service} | banner: {banner[:80]}")
        else:
            with lock:
                print(Fore.GREEN + f"[CLOSED] {port}")
    except Exception as e:
        with lock:
            print(Fore.YELLOW + f"[ERR] port {port} -> {e}")

# -----------------------------
# Risk scoring & report helpers
# -----------------------------
def compute_risk(scan_results, ttl_os_guess):
    score = 0
    reasons = []
    open_count = len(scan_results)
    score += open_count * 5
    for r in scan_results:
        # suggestions from CVE hints
        if r.get("cve_hints"):
            score += 8 * len(r["cve_hints"])
            reasons += r["cve_hints"]
        # common sensitive ports
        if r["port"] in (22, 23, 3389, 3306, 5900):
            score += 7
            reasons.append(f"Sensitive port open: {r['port']}")
        # HTTP on 80/8080
        if r["port"] in (80, 8080, 443) and r.get("banner") and "Apache" in (r.get("banner") or ""):
            reasons.append("Apache detected — check version & modules")
    if ttl_os_guess and "Windows" in (ttl_os_guess or ""):
        score += 3
        reasons.append("Host appears to be Windows — patch cadence differs")
    score = min(score, 100)
    level = "LOW"
    if score >= 50:
        level = "HIGH"
    elif score >= 25:
        level = "MEDIUM"
    return score, level, list(dict.fromkeys(reasons))

def ascii_summary(open_ports, closed_count, duration_secs):
    bars = []
    open_n = len(open_ports)
    total = open_n + closed_count
    if total == 0:
        total = 1
    open_bar = int((open_n / total) * 20)
    closed_bar = int((closed_count / total) * 20)
    return {
        "open": "█" * open_bar + " " * (20 - open_bar),
        "closed": "█" * closed_bar + " " * (20 - closed_bar),
        "open_n": open_n,
        "closed_n": closed_count,
        "duration": duration_secs
    }

# -----------------------------
# Main orchestration
# -----------------------------
def run_scan_interactive():
    print("\n=== PORT SCANNER PRO (Interactive) ===\n")
    target = input("Enter target IP or domain (e.g. scanme.nmap.org): ").strip()
    # resolve domain to IP if needed
    try:
        target_ip = socket.gethostbyname(target)
    except Exception:
        print("Could not resolve target. Try an IP address.")
        return

    client_name = input("Client name (for report file) [optional]: ").strip() or "unknown_client"

    print("\nScan mode:")
    print("1) Common ports (fast)")
    print("2) Full range (1-65535) SLOW")
    mode = input("Choose 1 or 2 [1]: ").strip() or "1"

    threads = input("Number of threads (default 100): ").strip()
    try:
        threads = int(threads) if threads else 100
    except:
        threads = 100

    port_list = []
    if mode == "1":
        port_list = list(COMMON_PORTS.keys())
    else:
        port_list = list(range(1, 65536))

    print("\nPerforming TTL-based OS guess (ping)...")
    ttl = ping_ttl(target_ip)
    os_guess = ttl_to_os(ttl)
    print(f"TTL: {ttl} -> {os_guess}")

    start_time = time.time()
    results = []
    closed_count = 0

    # queue and threads
    threads_list = []
    port_iter = iter(port_list)

    # custom worker threads that pull from iterator
    def thread_worker():
        nonlocal closed_count
        for p in port_iter:
            try:
                sock = socket.socket()
                sock.settimeout(0.6)
                res = sock.connect_ex((target_ip, p))
                sock.close()
                if res == 0:
                    # call worker logic for open port
                    banner = banner_grab(target_ip, p, timeout=0.8)
                    service = COMMON_PORTS.get(p, "unknown")
                    version = extract_version_from_banner(banner)
                    hints = cve_hints_from_banner(banner)
                    with lock:
                        print(Fore.RED + f"[OPEN] {p} | {service} | banner: {banner[:80]}")
                    results.append({
                        "port": p,
                        "service": service,
                        "banner": banner,
                        "version_found": version,
                        "cve_hints": hints
                    })
                else:
                    with lock:
                        print(Fore.GREEN + f"[CLOSED] {p}")
                    closed_count += 1
            except Exception as e:
                with lock:
                    print(Fore.YELLOW + f"[ERR] p={p} -> {e}")

    # start threads
    for _ in range(min(threads, len(port_list))):
        t = threading.Thread(target=thread_worker, daemon=True)
        threads_list.append(t)
        t.start()

    # wait
    for t in threads_list:
        t.join()

    duration = time.time() - start_time

    # risk score
    score, level, reasons = compute_risk(results, os_guess)

    # ascii summary
    summary = ascii_summary([r["port"] for r in results], closed_count, duration)

    # report filenames
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    txt_fn = f"{REPORT_TXT_DIR}/{client_name}_portscan_{target}_{ts}.txt"
    json_fn = f"{REPORT_JSON_DIR}/{client_name}_portscan_{target}_{ts}.json"

    # write TXT
    with open(txt_fn, "w", encoding="utf-8") as f:
        f.write("=== PORT SCANNER PRO REPORT ===\n\n")
        f.write(f"Client: {client_name}\n")
        f.write(f"Target: {target} ({target_ip})\n")
        f.write(f"Scan Time: {datetime.now()}\n")
        f.write(f"Duration: {duration:.2f}s\n\n")

        f.write("=== SUMMARY ===\n")
        f.write(f"Open Ports: {len(results)}\n")
        f.write(f"Closed Ports: {closed_count}\n")
        f.write(f"Risk Score: {score} ({level})\n\n")

        f.write("ASCII SUMMARY (open / closed bars)\n")
        f.write(f"Open  : {summary['open']}  ({summary['open_n']})\n")
        f.write(f"Closed: {summary['closed']}  ({summary['closed_n']})\n\n")

        if results:
            f.write("=== OPEN PORT DETAILS ===\n")
            for r in results:
                f.write(f"- Port {r['port']} | {r['service']}\n")
                f.write(f"  Banner: {r['banner'][:200]}\n")
                if r.get("version_found"):
                    f.write(f"  Version detected: {r['version_found']}\n")
                if r.get("cve_hints"):
                    for h in r["cve_hints"]:
                        f.write(f"  CVE HINT: {h}\n")
                f.write("\n")

        f.write("=== RISK ANALYSIS & RECOMMENDATIONS ===\n")
        f.write(f"Estimated Risk Score: {score}/100 ({level})\n")
        if reasons:
            f.write("Key reasons:\n")
            for rr in reasons:
                f.write(f"- {rr}\n")
        f.write("\nRecommended actions:\n")
        f.write("- Close unused services and ports\n")
        f.write("- Apply firewall / restrict access via security groups\n")
        f.write("- Patch detected services (see CVE hints)\n")
        f.write("- Run deeper vulnerability assessment for exposed services\n")

    # write JSON
    out = {
        "client": client_name,
        "target": target,
        "target_ip": target_ip,
        "scan_time": str(datetime.now()),
        "duration_seconds": duration,
        "ttl_guess": ttl,
        "os_guess": os_guess,
        "open_ports": results,
        "closed_ports_count": closed_count,
        "risk_score": score,
        "risk_level": level,
        "reasons": reasons
    }
    with open(json_fn, "w", encoding="utf-8") as jf:
        json.dump(out, jf, indent=2, ensure_ascii=False)

    # final terminal summary
    print(Style.BRIGHT + "\n=== SCAN COMPLETE ===")
    print(f"Report saved: {txt_fn}")
    print(f"JSON saved:   {json_fn}")
    print(f"Duration: {duration:.2f}s | Open ports: {len(results)} | Risk: {score} ({level})\n")

if __name__ == "__main__":
    run_scan_interactive()
