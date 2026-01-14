#!/usr/bin/env python3
"""
Vulnerability Scorer AI — Enterprise v2
- Enterprise-grade aggregator & scorer for your tool outputs
- Inputs: any JSON files under a reports root (default "reports")
- Outputs: TXT, JSON, CSV, HTML (self-contained) under reports/score_enterprise/
- Optional: convert HTML -> PDF via pdfkit (not included by default)
- Dependencies: colorama (optional, for terminal colors)
Author: Gigi (assistant) for Shrey — production-ready defaults
"""

import os
import re
import json
import csv
import math
import html
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter

# optional colors
try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init(autoreset=True)
except Exception:
    class _C:
        def __getattr__(self, k): return ""
    Fore = Style = _C()

# ---------- Config ----------
REPORTS_ROOT_DEFAULT = "reports"
OUTPUT_BASE = os.path.join("reports", "score_enterprise")
os.makedirs(OUTPUT_BASE, exist_ok=True)

TS_FMT = "%Y-%m-%d_%H-%M-%S"
MAX_TOP_FINDINGS = 50       # how many top findings to keep in reports
MAX_ASSETS_LIST = 200       # limit assets in TXT summary for readability
HTML_INLINE_CSS = """
body{font-family:Inter,Segoe UI,Arial;margin:20px;color:#111}
h1{color:#0b5; margin-bottom:4px}
h2{color:#0a58ca;margin-top:18px}
.badge{display:inline-block;padding:4px 8px;border-radius:6px;font-weight:600}
.badge-CRITICAL{background:#8b0000;color:#fff}
.badge-HIGH{background:#ff4500;color:#fff}
.badge-MEDIUM{background:#ffb347;color:#111}
.badge-LOW{background:#2ecc71;color:#fff}
.card{border:1px solid #e6e6e6;padding:12px;border-radius:8px;margin-bottom:10px}
.item{margin-bottom:8px}
.small{color:#666;font-size:0.9rem}
table{width:100%;border-collapse:collapse}
th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
"""

# Scoring building blocks (tunable)
TAG_WEIGHTS = {
    # very high risk
    "env_file": 95,
    "backup_file": 90,
    "exposed_admin": 85,
    "phpinfo": 85,
    "sensitive_file": 85,
    "sql_injection": 95,
    "rce": 100,
    "dir_traversal": 85,
    "exposed_db": 95,
    "unauth_api_json": 80,
    "permissive_cors": 80,
    # medium
    "xss": 60,
    "open_port": 40,
    "weak_ssl": 70,
    "missing_header": 20,
    "scanner_detected": 30,
    "suspicious_ua": 25,
    "config_file": 75,
    "ssh_open": 55,
    # infra/cloud
    "s3_public": 90,
    "iam_overpriv": 90,
    "k8s_exposed": 85,
}

# Map keywords to tags (heuristic)
KEYWORD_TAGS = {
    ".env": "env_file",
    "backup": "backup_file",
    "backup.zip": "backup_file",
    "wp-config": "config_file",
    "config.php": "config_file",
    ".git": "sensitive_file",
    "phpinfo": "phpinfo",
    "admin": "exposed_admin",
    "/admin": "exposed_admin",
    "union select": "sql_injection",
    "or 1=1": "sql_injection",
    "sqlmap": "scanner_detected",
    "<script": "xss",
    "cross-origin": "permissive_cors",
    "access-control-allow-origin": "permissive_cors",
    "application/json": "unauth_api_json",
    "s3.amazonaws.com": "s3_public",
    "iam": "iam_overpriv",
    "kubernetes": "k8s_exposed",
    "ssh": "ssh_open",
    "port 22": "ssh_open",
}

# Category mapping: tag -> category
CATEGORY_MAP = {
    "env_file": "Web & Data",
    "backup_file": "Web & Data",
    "exposed_admin": "Web & App",
    "config_file": "Web & App",
    "phpinfo": "Web & App",
    "sql_injection": "Injection",
    "xss": "Injection",
    "unauth_api_json": "API",
    "permissive_cors": "API",
    "open_port": "Infrastructure",
    "ssh_open": "Infrastructure",
    "s3_public": "Cloud",
    "iam_overpriv": "Cloud",
    "k8s_exposed": "Cloud",
    "scanner_detected": "Recon",
    "suspicious_ua": "Recon",
    "weak_ssl": "Crypto",
    "missing_header": "Config",
    "sensitive_file": "Data Exposure",
}

# serialization-safe helper
def sanitize(obj):
    """Recursively convert non-serializable builtins to serializable versions."""
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(i) for i in obj]
    if isinstance(obj, set):
        return [sanitize(i) for i in sorted(list(obj))]
    if isinstance(obj, (bytes, bytearray)):
        try:
            return obj.decode('utf-8', errors='ignore')
        except:
            return str(obj)
    # datetime -> iso
    if hasattr(obj, 'isoformat'):
        try:
            return obj.isoformat()
        except:
            return str(obj)
    # fallback
    return obj

# find jsons
def find_json_reports(root):
    p = Path(root)
    if not p.exists():
        return []
    return [str(x) for x in p.rglob("*.json") if x.is_file()]

# load json with guard
def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(Fore.YELLOW + f"[WARN] Could not load {path}: {e}")
        return None

# infer tags from text
def infer_tags_from_text(text):
    tags = set()
    t = (text or "").lower()
    for k, tag in KEYWORD_TAGS.items():
        if k in t:
            tags.add(tag)
    # heuristics
    if "application/json" in t or re.search(r'\"\s*{', t):
        tags.add("unauth_api_json")
    for scanner in ("sqlmap","nmap","acunetix","nikto","masscan"):
        if scanner in t:
            tags.add("scanner_detected")
    return tags

# normalize generic findings to canonical form
def normalize_report(path, data):
    findings = []
    base = os.path.basename(path).lower()
    # tool hint from filename
    tool_hint = "unknown"
    if "port" in base: tool_hint = "port_scanner"
    if "subdomain" in base: tool_hint = "subdomain"
    if "api" in base: tool_hint = "api_enum"
    if "ids" in base: tool_hint = "ids"
    if "header" in base or "ssl" in base: tool_hint = "header_ssl"
    if "directory" in base: tool_hint = "directory"
    if "threat" in base or "intel" in base: tool_hint = "threat_intel"

    # handle various shapes
    if isinstance(data, dict):
        # common: {"results": [...]}:
        if "results" in data and isinstance(data["results"], (list, dict)):
            items = data["results"]
            if isinstance(items, dict):
                for k, v in items.items():
                    findings.extend(normalize_item(path, v, tool_hint))
            else:
                for it in items:
                    findings.extend(normalize_item(path, it, tool_hint))
            return findings

        # common: {"findings": [...]}
        if "findings" in data and isinstance(data["findings"], list):
            for it in data["findings"]:
                findings.extend(normalize_item(path, it, tool_hint))
            return findings

        # simple port/object based shapes
        # detect open ports list
        for k in ("open_ports","ports","open"):
            if k in data and isinstance(data[k], list):
                for p in data[k]:
                    if isinstance(p, dict):
                        title = f"Open port {p.get('port')}/{p.get('service', '')}"
                        asset = p.get('ip') or data.get('target') or data.get('host') or "unknown"
                        findings.append({
                            "title": title,
                            "description": str(p),
                            "asset": asset,
                            "source_file": path,
                            "tool": tool_hint,
                            "tags": ["open_port"],
                            "raw": p
                        })
                return findings

        # fallback: inspect lists inside top-level
        for k,v in data.items():
            if isinstance(v, list) and v and (isinstance(v[0], dict) or isinstance(v[0], str)):
                for it in v:
                    findings.extend(normalize_item(path, it, tool_hint))
        # last resort: if dict keys look like a finding
        if any(k in data for k in ("title","issue","description","url","ip","path")):
            findings.extend(normalize_item(path, data, tool_hint))
        return findings

    if isinstance(data, list):
        for it in data:
            findings.extend(normalize_item(path, it, tool_hint))
        return findings

    return findings

def normalize_item(path, item, tool_hint):
    out = []
    if isinstance(item, str):
        tags = infer_tags_from_text(item)
        # attempt to capture asset as url/ip/path
        urlm = re.search(r"https?://[^\s'\",]+", item)
        ipm = re.search(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", item)
        asset = urlm.group(0) if urlm else (ipm.group(0) if ipm else "unknown")
        out.append({
            "title": item[:200],
            "description": item,
            "asset": asset,
            "source_file": path,
            "tool": tool_hint,
            "tags": list(tags),
            "raw": item
        })
        return out

    if isinstance(item, dict):
        title = item.get("title") or item.get("name") or item.get("issue") or item.get("path") or item.get("finding") or ""
        desc = item.get("description") or item.get("detail") or item.get("summary") or ""
        # asset heuristic
        asset = item.get("url") or item.get("ip") or item.get("target") or item.get("host") or item.get("path") or "unknown"
        # tags from known fields
        tags = set()
        if "tags" in item and isinstance(item["tags"], (list,set)):
            tags.update(item["tags"])
        if "severity" in item:
            tags.add(str(item["severity"]))
        # infer tags from title/desc/raw
        tags.update(infer_tags_from_text(" ".join([str(title), str(desc), str(item.get("raw",""))])))
        # base_score if provided
        base_score = None
        if "risk_score" in item and isinstance(item["risk_score"], (int,float)):
            base_score = int(item["risk_score"])
        elif "score" in item and isinstance(item["score"], (int,float)):
            base_score = int(item["score"])
        obj = {
            "title": title or (desc[:120] if desc else str(item)[:120]),
            "description": desc,
            "asset": asset,
            "source_file": path,
            "tool": tool_hint,
            "tags": list(tags),
            "base_score": base_score,
            "raw": item
        }
        out.append(obj)
        return out

    return out

# CVSS-like scoring model (simpler)
def compute_score(finding):
    """
    Score composition:
      - base from explicit base_score OR tag weights sum
      - exposure multiplier (publicly reachable / unauthenticated / wildcard CORS)
      - confidence multiplier based on presence of identifiers
    """
    base = 0
    if isinstance(finding.get("base_score"), int):
        base = finding["base_score"]
    else:
        for t in finding.get("tags", []):
            base += TAG_WEIGHTS.get(t, 0)

    # small boosts from tool names
    tool = (finding.get("tool") or "").lower()
    if "api" in tool: base += 5
    if "ids" in tool: base += 5
    if "port" in tool: base += 3

    # exposure multipliers
    exposure = 1.0
    tags = set([t.lower() for t in finding.get("tags",[])])
    # unauth API JSON is high exposure
    if "unauth_api_json" in tags:
        exposure *= 1.25
    if "permissive_cors" in tags:
        exposure *= 1.2
    # public asset awarded
    if is_public_asset(finding.get("asset","")):
        exposure *= 1.1

    # confidence multiplier
    confidence = 1.0
    # if raw contains status codes or lengths, bump confidence
    raw = finding.get("raw", "")
    if isinstance(raw, dict) and raw:
        confidence += 0.05
    if any(k in str(raw).lower() for k in ("200","401","403","open","ssh","json")):
        confidence += 0.05

    # final calc
    score = int(max(0, min(100, math.ceil(base * exposure * confidence))))
    reasons = []
    if finding.get("base_score") is not None:
        reasons.append(f"base_score:{finding.get('base_score')}")
    # list tag-driven reasons
    for t in finding.get("tags", []):
        w = TAG_WEIGHTS.get(t, 0)
        if w:
            reasons.append(f"{t}:{w}")
    if is_public_asset(finding.get("asset","")):
        reasons.append("asset:public")
    return score, reasons

def is_public_asset(asset):
    asset = (asset or "").lower()
    # heuristics: starts with http and not localhost/private ranges
    if asset.startswith("http"):
        if "localhost" in asset or "127.0.0.1" in asset:
            return False
        return True
    # IP public ranges: naive
    m = re.match(r"(\d+)\.(\d+)\.(\d+)\.(\d+)", asset)
    if m:
        a = int(m.group(1))
        # private ranges 10/8, 172.16/12, 192.168/16
        if a == 10: return False
        if a == 192: return False
        if a == 172: return False
        return True
    return False

# Aggregate findings
def aggregate(findings):
    by_asset = defaultdict(list)
    for f in findings:
        asset = f.get("asset") or "unknown"
        by_asset[asset].append(f)
    asset_summary = {}
    for asset, items in by_asset.items():
        scores = [it["score"] for it in items]
        asset_summary[asset] = {
            "max_score": max(scores) if scores else 0,
            "avg_score": int(sum(scores)/len(scores)) if scores else 0,
            "count": len(items),
            "high_count": sum(1 for s in scores if s>=70),
            "medium_count": sum(1 for s in scores if 40<=s<70),
            "low_count": sum(1 for s in scores if s<40),
        }
    # global score: weight asset max_scores by sqrt(count)
    total_w = 0.0
    total_v = 0.0
    for asset, meta in asset_summary.items():
        w = (meta["max_score"] + 1) * math.sqrt(max(1, meta["count"]))
        total_w += w
        total_v += meta["avg_score"] * w
    global_score = int(total_v/total_w) if total_w else 0
    return asset_summary, global_score

# Write outputs: TXT, JSON, CSV, HTML
def write_outputs(client, root_reports, findings, asset_summary, global_score):
    ts = datetime.now().strftime(TS_FMT)
    safe = re.sub(r'[^a-zA-Z0-9_\-]', '_', client)[:30]
    basefn = f"{safe}_vulnscore_{ts}"
    out_dir = OUTPUT_BASE
    os.makedirs(out_dir, exist_ok=True)
    txt_path = os.path.join(out_dir, basefn + ".txt")
    json_path = os.path.join(out_dir, basefn + ".json")
    csv_path = os.path.join(out_dir, basefn + ".csv")
    html_path = os.path.join(out_dir, basefn + ".html")

    # TXT summary
    high = sum(1 for f in findings if f["score"] >= 70)
    medium = sum(1 for f in findings if 40 <= f["score"] < 70)
    low = sum(1 for f in findings if f["score"] < 40)
    with open(txt_path, "w", encoding="utf-8") as tf:
        tf.write("=== VULNERABILITY SCORER AI — ENTERPRISE REPORT ===\n\n")
        tf.write(f"Client: {client}\nReports root: {root_reports}\nGenerated: {datetime.now()}\n\n")
        tf.write(f"Global Score: {global_score}\n")
        tf.write(f"Total Findings: {len(findings)} | High: {high} | Medium: {medium} | Low: {low}\n\n")
        tf.write("Top Critical Findings:\n")
        for f in findings[:MAX_TOP_FINDINGS]:
            tf.write(f"- [{f['score']:>3}] {f['title']}\n")
            tf.write(f"    Asset: {f.get('asset')}\n")
            tf.write(f"    Source: {os.path.basename(f.get('source_file',''))}\n")
            if f.get("tags"):
                tf.write(f"    Tags: {', '.join(f.get('tags'))}\n")
            tf.write(f"    Reasons: {', '.join(f.get('reasons')[:5])}\n\n")
        tf.write("\nAssets Summary (top by max score):\n")
        assets_sorted = sorted(asset_summary.items(), key=lambda x: x[1]["max_score"], reverse=True)
        for asset, meta in assets_sorted[:MAX_ASSETS_LIST]:
            tf.write(f"- {asset} | max={meta['max_score']} avg={meta['avg_score']} count={meta['count']} (H/M/L: {meta['high_count']}/{meta['medium_count']}/{meta['low_count']})\n")

    # JSON file (sanitized)
    out = {
        "client": client,
        "generated": str(datetime.now()),
        "reports_root": root_reports,
        "global_score": global_score,
        "finding_count": len(findings),
        "findings": findings,
        "asset_summary": asset_summary,
    }
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(sanitize(out), jf, indent=2, ensure_ascii=False)

    # CSV flat
    with open(csv_path, "w", newline='', encoding="utf-8") as cf:
        w = csv.writer(cf)
        w.writerow(["score","title","asset","source_file","tool","tags","reasons"])
        for f in findings:
            w.writerow([f["score"], f.get("title",""), f.get("asset",""), os.path.basename(f.get("source_file","")), f.get("tool",""), ";".join(f.get("tags") or []), ";".join(f.get("reasons") or [])])

    # HTML (self-contained)
    html_rows = []
    for f in findings[:MAX_TOP_FINDINGS]:
        lvl = "LOW"
        if f["score"] >= 80: lvl = "CRITICAL"
        elif f["score"] >= 70: lvl = "HIGH"
        elif f["score"] >= 40: lvl = "MEDIUM"
        html_rows.append({
            "score": f["score"],
            "level": lvl,
            "title": html.escape(f.get("title","")),
            "asset": html.escape(str(f.get("asset",""))),
            "source": html.escape(os.path.basename(f.get("source_file",""))),
            "tags": ", ".join(f.get("tags") or []),
            "reasons": ", ".join(f.get("reasons") or [])[:400]
        })
    html_content = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Vulnerability Scorer — {html.escape(client)}</title>
<style>{HTML_INLINE_CSS}</style></head><body>
<h1>Vulnerability Scorer AI — Enterprise</h1>
<div class="small">Client: {html.escape(client)} | Generated: {datetime.now()}</div>
<div class="card"><strong>Global Score:</strong> <span class="badge badge-{('CRITICAL' if global_score>=80 else 'HIGH' if global_score>=60 else 'MEDIUM' if global_score>=35 else 'LOW')}" style="margin-left:8px">{global_score}</span></div>
<h2>Top Findings</h2>
<div class="card">"""
    for r in html_rows:
        html_content += f"""<div class="item"><strong>[{r['score']}]</strong> <strong>{r['title']}</strong><div class="small">Asset: {r['asset']} | Source: {r['source']} | Level: {r['level']}</div><div class="small">Tags: {r['tags']}</div><div class="small">Reasons: {r['reasons']}</div></div>"""
    html_content += "</div><h2>Assets Summary</h2><div class='card'><table><thead><tr><th>Asset</th><th>Max</th><th>Avg</th><th>Count</th></tr></thead><tbody>"
    for asset, meta in sorted(asset_summary.items(), key=lambda x: x[1]["max_score"], reverse=True)[:200]:
        html_content += f"<tr><td>{html.escape(asset)}</td><td>{meta['max_score']}</td><td>{meta['avg_score']}</td><td>{meta['count']}</td></tr>"
    html_content += "</tbody></table></div><div class='small'>This report was generated by Vulnerability Scorer AI — Enterprise v2</div></body></html>"
    with open(html_path, "w", encoding="utf-8") as hf:
        hf.write(html_content)

    print(Fore.GREEN + f"[✓] TXT → {txt_path}")
    print(Fore.GREEN + f"[✓] JSON → {json_path}")
    print(Fore.GREEN + f"[✓] CSV → {csv_path}")
    print(Fore.GREEN + f"[✓] HTML → {html_path}")
    return txt_path, json_path, csv_path, html_path

# Main runner
def main():
    print("\n=== Vulnerability Scorer AI — Enterprise v2 ===\n")
    client = input("Client name: ").strip() or "client"
    reports_root = input(f"Reports root (default '{REPORTS_ROOT_DEFAULT}'): ").strip() or REPORTS_ROOT_DEFAULT

    json_paths = find_json_reports(reports_root)
    if not json_paths:
        print(Fore.YELLOW + f"[!] No JSON reports found under {reports_root}. Place tool JSON outputs under that folder and try again.")
        return

    print(f"[i] Found {len(json_paths)} JSON files. Parsing and normalizing findings...")
    all_findings = []
    for p in json_paths:
        d = load_json(p)
        if d is None:
            continue
        n = normalize_report(p, d)
        for f in n:
            # ensure tags list
            if not f.get("tags"):
                f["tags"] = list(infer_tags_from_text(json.dumps(f.get("raw",""))))
            # compute score + reasons
            score, reasons = compute_score(f)
            f["score"] = score
            f["reasons"] = reasons
            all_findings.append(f)

    # sort
    all_findings.sort(key=lambda x: x["score"], reverse=True)
    print(f"[i] Normalized {len(all_findings)} findings from reports.")

    # limit list to avoid enormous payloads in HTML/TXT (we still keep all in JSON)
    trimmed_findings = all_findings  # keep complete for now; HTML/TXT trims when printing

    # aggregate
    asset_summary, global_score = aggregate(trimmed_findings)

    # write outputs
    txt, jsn, csvf, htmlf = write_outputs(client, reports_root, trimmed_findings, asset_summary, global_score)

    # terminal summary (nice for screenshot)
    level = "LOW"
    if global_score >= 80: level = "CRITICAL"
    elif global_score >= 60: level = "HIGH"
    elif global_score >= 35: level = "MEDIUM"
    print(Fore.CYAN + f"\nGlobal Score: {global_score} ({level})")
    print(Fore.YELLOW + "Top 5 findings:")
    for f in trimmed_findings[:5]:
        col = Fore.RED if f["score"]>=70 else (Fore.YELLOW if f["score"]>=40 else Fore.GREEN)
        print(col + f"[{f['score']:>3}] {f['title']} | {f.get('asset')} (source: {os.path.basename(f.get('source_file',''))})")
    print("\nDone.\n")

if __name__ == "__main__":
    main()
