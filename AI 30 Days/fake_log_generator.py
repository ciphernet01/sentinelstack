#!/usr/bin/env python3
"""
Fake Log Generator PRO
Generates realistic Apache/Nginx access logs for testing Mini-IDS PRO.
Write-only. Safe to use locally.
"""

import random
import time
from datetime import datetime

# Output log file
LOG_FILE = "test_access.log"

# Sample IP pools
legit_ips = [
    "192.168.1.10", "192.168.1.11", "10.10.10.20",
    "172.16.0.5", "65.23.12.44"
]

attackers = [
    "45.155.23.12", "102.22.14.98", "8.8.8.8",
    "77.88.99.11", "66.66.66.66"
]

# User agents
normal_ua = [
    "Mozilla/5.0", "Chrome/122.0", "Safari/602.1",
    "Edge/100.0", "Opera/90.0"
]

attack_ua = [
    "sqlmap", "acunetix", "nmap", "dirbuster", "masscan"
]

# Paths
normal_paths = [
    "/", "/home", "/products", "/contact", "/about", "/blog/article1"
]

attack_paths = [
    "/login", "/admin", "/wp-login.php", "/xmlrpc.php",
    "/.env", "/config.php", "/phpinfo", "/etc/passwd"
]

# SQLi payloads
sqli_payloads = [
    "?id=1 UNION SELECT 1,2,3",
    "?user=admin' OR 1=1--",
    "?search=foobar'; DROP TABLE users; --",
]

# XSS payloads
xss_payloads = [
    "?q=<script>alert(1)</script>",
    "?name=<img src=x onerror=alert(1)>",
]

def fmt_log(ip, path, status=200, ua="Mozilla/5.0"):
    now = datetime.utcnow().strftime("%d/%b/%Y:%H:%M:%S +0000")
    size = random.randint(150, 4000)
    return f'{ip} - - [{now}] "GET {path} HTTP/1.1" {status} {size} "-" "{ua}"\n'


def generate_traffic(mode="mixed"):
    """mode: normal | attack | mixed | bruteforce | flood"""
    
    if mode == "normal":
        ip = random.choice(legit_ips)
        path = random.choice(normal_paths)
        ua = random.choice(normal_ua)
        return fmt_log(ip, path, 200, ua)
    
    elif mode == "attack":
        ip = random.choice(attackers)
        attack_type = random.choice(["sqli", "xss", "bruteforce", "scanner"])
        
        if attack_type == "sqli":
            path = "/products" + random.choice(sqli_payloads)
            return fmt_log(ip, path, 200, random.choice(attack_ua))
        
        if attack_type == "xss":
            path = "/search" + random.choice(xss_payloads)
            return fmt_log(ip, path, 200, random.choice(attack_ua))
        
        if attack_type == "bruteforce":
            path = "/login"
            return fmt_log(ip, path, 401, random.choice(normal_ua))
        
        if attack_type == "scanner":
            path = random.choice(attack_paths)
            return fmt_log(ip, path, random.choice([200, 403]), random.choice(attack_ua))
    
    elif mode == "bruteforce":
        ip = random.choice(attackers)
        return fmt_log(ip, "/login", 401, "Mozilla/5.0")
    
    elif mode == "flood":
        ip = random.choice(attackers)
        return fmt_log(ip, "/", 200, "curl/7.88")
    
    else:  # mixed
        return generate_traffic(random.choice(["normal", "attack"]))


def main():
    print("\n=== FAKE LOG GENERATOR PRO ===")
    print("Modes: normal | attack | mixed | bruteforce | flood")
    mode = input("Choose mode [mixed]: ").strip() or "mixed"
    
    delay = input("Delay between log lines in seconds (0 for fast spam) [0.5]: ").strip()
    try:
        delay = float(delay)
    except:
        delay = 0.5
    
    print(f"\nWriting logs to {LOG_FILE}...\nPress Ctrl+C to stop.\n")
    
    while True:
        line = generate_traffic(mode)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
        print(line.strip())
        time.sleep(delay)


if __name__ == "__main__":
    main()
