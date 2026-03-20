import dns.resolver
import socket
import ssl
import requests
import os
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

# -----------------------------------
# Folder setup
# -----------------------------------
TXT_DIR = "reports/subdomains_pro/txt"
JSON_DIR = "reports/subdomains_pro/json"
os.makedirs(TXT_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)

FAST_WORDLIST = [
    "www","api","mail","smtp","dev","test","stage","dashboard","portal","files",
    "admin","login","secure","vpn","app","cdn","beta","shop","m","research",
    "staging","uat","internal","forum","support","images","static","assets"
]

DEEP_WORDLIST = FAST_WORDLIST + [
    "backup","backup1","old","legacy","exchange","payments","auth","demo",
    "api-v2","graphql","partners","qa","mobile","b2b"
]

resolver = dns.resolver.Resolver()
resolver.timeout = 2
resolver.lifetime = 3


def resolve_a(host):
    try:
        answers = resolver.resolve(host, "A")
        return [r.to_text() for r in answers]
    except:
        return []


def has_wildcard(domain):
    test_subs = ["this-should-not-exist-123", "rand-wild-999"]
    ips = []
    for sub in test_subs:
        res = resolve_a(f"{sub}.{domain}")
        if res:
            ips.extend(res)
    return len(ips) > 0


def fetch_http_info(hostname, timeout=3):
    session = requests.Session()
    session.headers.update({"User-Agent":"Mozilla/5.0 (Tool2-Pro)"})
    result = {
        "url": None,
        "status": None,
        "final_url": None,
        "title": None,
        "headers": {},
        "scheme": None,
        "error": None
    }

    for scheme in ("https://", "http://"):
        url = scheme + hostname
        try:
            resp = session.get(url, timeout=timeout, allow_redirects=True, verify=True)
            result["url"] = url
            result["status"] = resp.status_code
            result["final_url"] = resp.url
            result["scheme"] = scheme.replace("://","")
            result["headers"] = dict(resp.headers)

            try:
                soup = BeautifulSoup(resp.text, "html.parser")
                title = soup.title.string.strip() if soup.title else None
                result["title"] = title
            except:
                result["title"] = None

            return result

        except Exception as e:
            result["error"] = str(e)

    return result


def fetch_cert_info(hostname):
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
            s.settimeout(3)
            s.connect((hostname, 443))
            cert = s.getpeercert()
            subject = dict(x[0] for x in cert.get("subject", ()))
            issuer = dict(x[0] for x in cert.get("issuer", ()))
            return {
                "subject_common_name": subject.get("commonName"),
                "issuer_common_name": issuer.get("commonName"),
                "not_after": cert.get("notAfter")
            }
    except:
        return None


def tech_fingerprint(headers, body_text):
    tech = []
    server = headers.get("Server", "")
    xp = headers.get("X-Powered-By", "")

    if server:
        tech.append(server)
    if xp:
        tech.append(xp)
    if "wordpress" in body_text.lower() or "wp-content" in body_text.lower():
        tech.append("WordPress")
    if "shopify" in body_text.lower():
        tech.append("Shopify")
    if "cloudflare" in server.lower():
        tech.append("Cloudflare")

    return list(dict.fromkeys(tech))


def probe(domain, sub):
    full = f"{sub}.{domain}"
    result = {
        "subdomain": full,
        "resolved": False,
        "ips": [],
        "http": None,
        "cert": None,
        "tech": [],
        "notes": []
    }

    ips = resolve_a(full)
    if not ips: 
        return result

    result["resolved"] = True
    result["ips"] = ips

    http = fetch_http_info(full)
    result["http"] = http

    body_text = http.get("title") or ""
    headers = http.get("headers") or {}

    result["tech"] = tech_fingerprint(headers, body_text)

    if http.get("scheme") == "https":
        cert = fetch_cert_info(full)
        result["cert"] = cert

    if http.get("status") and http.get("status") >= 400:
        result["notes"].append(f"http_status:{http['status']}")

    return result


def risk_score(results):
    score = 0
    reasons = []

    for r in results:
        if not r["resolved"]: continue
        score += 5

        if r["http"]:
            status = r["http"].get("status")
            if status and status >= 400:
                score += 5
                reasons.append(f"{r['subdomain']} returns {status}")

        if r["tech"]:
            score += len(r["tech"]) * 2

    if score >= 50:
        level = "HIGH RISK"
    elif score >= 25:
        level = "MODERATE RISK"
    else:
        level = "LOW RISK"

    return score, level, reasons


def generate_reports(domain, results):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    base = f"Subdomain_Report_{domain}_{timestamp}"
    txt_path = f"{TXT_DIR}/{base}.txt"
    json_path = f"{JSON_DIR}/{base}.json"

    score, level, reasons = risk_score(results)

    # TXT REPORT
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=== AI SUBDOMAIN ENUM PRO (INTERACTIVE) ===\n\n")
        f.write(f"Domain: {domain}\n")
        f.write(f"Time: {datetime.now()}\n\n")

        found = [r for r in results if r["resolved"]]
        f.write(f"Found: {len(found)} subdomains\n\n")

        for r in found:
            f.write(f"- {r['subdomain']}\n")
            f.write(f"  IPs: {', '.join(r['ips'])}\n")

            if r["http"]:
                h = r["http"]
                f.write(f"  Status: {h.get('status')} | Title: {h.get('title')}\n")

            if r["cert"]:
                c = r["cert"]
                f.write(f"  SSL CN: {c.get('subject_common_name')} | Issuer: {c.get('issuer_common_name')}\n")

            if r["tech"]:
                f.write(f"  Tech: {', '.join(r['tech'])}\n")

            if r["notes"]:
                f.write(f"  Notes: {', '.join(r['notes'])}\n")

            f.write("\n")

        f.write("=== AI RISK SUMMARY ===\n")
        f.write(f"Risk Score: {score}/100\n")
        f.write(f"Risk Level: {level}\n")
        if reasons:
            for r in reasons:
                f.write(f"- {r}\n")

    # JSON REPORT
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump({
            "domain": domain,
            "timestamp": str(datetime.now()),
            "results": results,
            "risk_score": score,
            "risk_level": level,
            "risk_reasons": reasons
        }, jf, indent=2, ensure_ascii=False)

    print(f"\n[✓] TXT saved → {txt_path}")
    print(f"[✓] JSON saved → {json_path}")


def main():
    print("\n=== ADVANCED SUBDOMAIN FINDER PRO (INTERACTIVE) ===\n")

    domain = input("Enter target domain (example.com): ").strip()

    print("\nChoose scan mode:")
    print("1) Fast (recommended)")
    print("2) Deep (bigger wordlist)")
    mode_choice = input("Enter 1 or 2: ").strip()

    mode = "fast" if mode_choice == "1" else "deep"

    threads = input("\nEnter number of threads (default 30): ").strip()
    threads = int(threads) if threads else 30

    custom = input("\nCustom wordlist? (path or leave blank): ").strip()
    if custom and os.path.exists(custom):
        with open(custom, "r", encoding="utf-8") as f:
            wordlist = [w.strip() for w in f if w.strip()]
    else:
        wordlist = FAST_WORDLIST if mode == "fast" else DEEP_WORDLIST

    print("\nChecking for wildcard DNS...")
    wildcard = has_wildcard(domain)
    if wildcard:
        print("[!] Wildcard DNS detected: some results may be false positives.\n")

    print(f"Scanning {domain} with {threads} threads...\n")

    results = []
    with ThreadPoolExecutor(max_workers=threads) as exe:
        futures = {exe.submit(probe, domain, sub): sub for sub in wordlist}
        for fut in as_completed(futures):
            res = fut.result()
            if res["resolved"]:
                print(f"[FOUND] {res['subdomain']} | Title: {res.get('http',{}).get('title')}")
            results.append(res)

    print("\nGenerating reports...")
    generate_reports(domain, results)

    print("\nScan complete! ✔\n")


if __name__ == "__main__":
    main()
