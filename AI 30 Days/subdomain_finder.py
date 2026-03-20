import dns.resolver
import os
import json
from datetime import datetime

print("\n=== AI-POWERED SUBDOMAIN ENUMERATOR ===\n")

# ---------------------------
# FOLDER SYSTEM
# ---------------------------
def setup_folders():
    os.makedirs("reports/subdomains", exist_ok=True)

setup_folders()

# ---------------------------
# BASIC WORDLIST (Expandable later)
# ---------------------------
WORDLIST = [
    "www", "mail", "smtp", "api", "dev", "test", "stage", "dashboard",
    "portal", "files", "admin", "login", "secure", "vpn", "app", "cdn"
]

found_subdomains = []

# ---------------------------
# SUBDOMAIN ENUMERATOR
# ---------------------------
def check_subdomain(domain, sub):
    try:
        full = f"{sub}.{domain}"
        dns.resolver.resolve(full, "A")
        print(f"[FOUND] {full}")
        found_subdomains.append(full)
    except:
        pass

# ---------------------------
# REPORT GENERATOR
# ---------------------------
def generate_report(domain):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    txt_file = f"reports/subdomains/Subdomain_Report_{domain}_{timestamp}.txt"
    json_file = f"reports/subdomains/Subdomain_Report_{domain}_{timestamp}.json"

    with open(txt_file, "w", encoding="utf-8") as f:
        f.write("=== AI SUBDOMAIN ENUMERATION REPORT ===\n\n")
        f.write(f"Target Domain: {domain}\n")
        f.write(f"Scan Time: {datetime.now()}\n\n")

        if found_subdomains:
            f.write("Discovered Subdomains:\n")
            for sub in found_subdomains:
                f.write(f"- {sub}\n")
        else:
            f.write("No subdomains found using current wordlist.\n")

        f.write("\n=== AI RISK SUMMARY ===\n")
        if found_subdomains:
            f.write("⚠ Multiple public-facing subdomains detected.\n")
            f.write("These may host login panels, APIs, or outdated services.\n")
            f.write("Recommended:\n")
            f.write("- Review public assets\n")
            f.write("- Disable unused subdomains\n")
            f.write("- Add security headers\n")
            f.write("- Run port scans on critical subdomains\n")
        else:
            f.write("✔ No publicly resolvable subdomains detected.\n")

    with open(json_file, "w", encoding="utf-8") as jf:
        json.dump({
            "domain": domain,
            "timestamp": str(datetime.now()),
            "subdomains": found_subdomains
        }, jf, indent=4)

    print(f"\n[✓] TXT Report Saved → {txt_file}")
    print(f"[✓] JSON Report Saved → {json_file}")


def main():
    domain = input("Enter domain (example.com): ")

    print("\nEnumerating subdomains...\n")

    for sub in WORDLIST:
        check_subdomain(domain, sub)

    print("\nScan Complete.")
    generate_report(domain)


if __name__ == "__main__":
    main()
