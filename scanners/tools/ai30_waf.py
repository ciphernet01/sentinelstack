"""WAF Bypass Tester wrapper for AI 30 Days integration"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

from scanners.engine.registry import register_tool


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _safe_import_ai30_script(script_filename: str):
    ai30_dir = _repo_root() / "AI 30 Days"
    script_path = ai30_dir / script_filename
    if not script_path.exists():
        raise FileNotFoundError(f"AI30 script not found: {script_path}")

    import importlib.util
    module_name = f"ai30_{script_filename.replace('.', '_')}"
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load spec for: {script_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _normalize_severity(raw: str) -> str:
    raw_upper = str(raw or "INFO").strip().upper()
    if raw_upper in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}:
        return raw_upper
    return "INFO"


def _finding(*, title: str, description: str, severity: str, remediation: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "toolName": "WAF Bypass Tester Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["CWE-693"],
    }


@register_tool("waf_bypass")
class WAFBypassTool:
    """WAF Detection and Bypass Tester - identifies WAFs and tests bypass techniques"""
    
    name = "waf_bypass"
    supported_scopes = ["WEB", "API", "FULL"]
    
    def run(self, ctx) -> List[Dict[str, Any]]:
        authorization_confirmed = bool((ctx.metadata or {}).get("authorizationConfirmed"))
        if not authorization_confirmed:
            return [
                _finding(
                    title="WAF Bypass Tester skipped (authorization not confirmed)",
                    description="This tool tests WAF bypass techniques. Disabled unless authorization confirmed.",
                    severity="INFO",
                    remediation="Set authorizationConfirmed=true to enable WAF bypass testing.",
                    evidence={"authorizationConfirmed": False},
                )
            ]

        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        findings: List[Dict[str, Any]] = []
        
        try:
            module = _safe_import_ai30_script("waf_bypass_tester_pro.py")
            tester = module.WafBypassTester(target)
            results = tester.run()
            
            # Report detected WAFs (informational)
            for waf in results.get("detected_wafs", []):
                findings.append(_finding(
                    title=f"WAF Detected: {waf['name']}",
                    description=f"Web Application Firewall identified with {waf.get('confidence', 'unknown')} confidence.",
                    severity="INFO",
                    remediation="WAF detection is informational. Ensure WAF rules are properly configured.",
                    evidence={
                        "waf_name": waf["name"],
                        "confidence": waf.get("confidence"),
                        "evidence": waf.get("evidence", [])[:5],
                    },
                ))
            
            # Report successful bypasses (these are security issues)
            for bypass in results.get("payload_bypasses", []):
                if bypass.get("success"):
                    findings.append(_finding(
                        title=f"WAF Bypass Found: {bypass.get('technique', 'Unknown')}",
                        description="A technique was found that bypasses the WAF protection.",
                        severity="HIGH",
                        remediation="Review and strengthen WAF rules. Add multiple layers of input validation.",
                        evidence={
                            "technique": bypass.get("technique"),
                            "original_payload": bypass.get("original_payload", "")[:100],
                            "modified_payload": bypass.get("modified_payload", "")[:100],
                        },
                    ))
            
            # Report header bypasses
            for header_bypass in results.get("header_bypasses", []):
                if header_bypass.get("potential_bypass"):
                    findings.append(_finding(
                        title=f"Header Bypass Potential: {header_bypass.get('header')}",
                        description="A header manipulation may bypass security controls.",
                        severity="MEDIUM",
                        remediation="Ensure backend validates requests regardless of headers.",
                        evidence={
                            "header": header_bypass.get("header"),
                            "value": header_bypass.get("value"),
                        },
                    ))
                
        except FileNotFoundError:
            pass
        except Exception as e:
            findings.append(_finding(
                title="WAF Bypass Tester Error",
                description=f"Scanner error: {str(e)}",
                severity="INFO",
                remediation="Check scanner configuration.",
                evidence={"error": str(e)},
            ))
            
        return findings
