"""Technology Fingerprinter wrapper for AI 30 Days integration"""
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
        "toolName": "Technology Fingerprinter Pro",
        "title": title,
        "description": description,
        "severity": _normalize_severity(severity),
        "remediation": remediation,
        "evidence": evidence,
        "complianceMapping": ["OWASP-A06-2021", "CWE-1035"],
    }


@register_tool("tech_fingerprinter")
class TechFingerprinterTool:
    """Technology Fingerprinter - detects tech stack and known vulnerable versions"""
    
    name = "tech_fingerprinter"
    supported_scopes = ["WEB", "API", "FULL"]
    
    def run(self, ctx) -> List[Dict[str, Any]]:
        target = str(ctx.target or "").strip()
        if not target:
            return []

        if not target.startswith("http://") and not target.startswith("https://"):
            target = "https://" + target

        findings: List[Dict[str, Any]] = []
        
        try:
            module = _safe_import_ai30_script("tech_fingerprinter_pro.py")
            scanner = module.TechFingerprinter(target)
            results = scanner.run()
            
            # Report detected technologies (informational)
            tech_summary = []
            for category, techs in results.get("technologies", {}).items():
                for tech in techs:
                    version = f" v{tech['version']}" if tech.get('version') else ""
                    tech_summary.append(f"{tech['name']}{version}")
            
            if tech_summary:
                findings.append(_finding(
                    title="Technology Stack Detected",
                    description=f"Identified {len(tech_summary)} technologies in use.",
                    severity="INFO",
                    remediation="Keep all technologies updated to their latest secure versions.",
                    evidence={"technologies": tech_summary[:20]},  # Limit to 20
                ))
            
            # Report known vulnerabilities (these are important)
            for vuln in results.get("vulnerabilities", []):
                findings.append(_finding(
                    title=f"Vulnerable Component: {vuln['technology']} {vuln.get('detected_version', '')}",
                    description=f"{vuln.get('description', 'Known vulnerability in detected version')}",
                    severity=vuln.get("severity", "MEDIUM"),
                    remediation=f"Upgrade {vuln['technology']} to the latest secure version.",
                    evidence={
                        "technology": vuln["technology"],
                        "detected_version": vuln.get("detected_version"),
                        "cve": vuln.get("cve"),
                        "vulnerable_spec": vuln.get("vulnerable_spec"),
                    },
                ))
                
        except FileNotFoundError:
            pass
        except Exception as e:
            findings.append(_finding(
                title="Technology Fingerprinter Error",
                description=f"Scanner error: {str(e)}",
                severity="INFO",
                remediation="Check scanner configuration.",
                evidence={"error": str(e)},
            ))
            
        return findings
