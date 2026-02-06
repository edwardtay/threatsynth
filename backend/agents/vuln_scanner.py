"""Vulnerability scanner agent: nikto, sqlmap detection, security headers, custom checks."""

import shlex
from urllib.parse import urlparse

from backend.agents.base import BaseAgent
from backend.database import Finding, async_session
from backend.tools.web_scanner import check_security_headers, check_cors, check_http_methods, check_cookies


class VulnScannerAgent(BaseAgent):
    phase = "vuln_scan"

    async def run(self, context: dict = None) -> dict:
        target_url = context.get("target_url", "")
        recon_results = context.get("recon_results", {})
        base_url = recon_results.get("base_url", target_url)

        await self._log("thinking", f"Starting vulnerability assessment on {target_url}")

        results = {"vulnerabilities": [], "nikto_findings": [], "sqlmap_targets": []}

        # 1. Nikto scan
        await self._log("decision", "Phase 1: Running Nikto web vulnerability scanner")
        nikto_cmd = f"nikto -h {shlex.quote(base_url)} -Tuning 1234567890abcde -maxtime 180 -nointeractive 2>/dev/null || true"
        job_id, nikto_out, nikto_analysis = await self._run_tool("nikto", nikto_cmd, timeout=200)
        results["nikto_output"] = nikto_out
        results["nikto_analysis"] = nikto_analysis

        # Parse Nikto findings and create DB entries
        await self._parse_nikto_findings(nikto_out, job_id, target_url)

        # 2. Python-based security checks
        await self._log("decision", "Phase 2: Checking security headers and configurations")
        header_issues = await check_security_headers(base_url)
        cors_issues = await check_cors(base_url)
        method_issues = await check_http_methods(base_url)
        cookie_issues = await check_cookies(base_url)

        all_issues = header_issues + cors_issues + method_issues + cookie_issues
        for issue in all_issues:
            await self._log("finding", f"Found: {issue['title']}")
            async with async_session() as session:
                finding = Finding(
                    target_id=self.target_id,
                    finding_type=issue["type"],
                    title=issue["title"],
                    description=issue["description"],
                    severity=issue["severity"],
                    evidence=issue.get("evidence", ""),
                    url=target_url,
                    cwe_id=issue.get("cwe_id"),
                    remediation=issue.get("remediation"),
                )
                session.add(finding)
                await session.commit()
        results["security_check_issues"] = all_issues

        # 3. SQL injection detection with sqlmap (detection only, no exploit)
        await self._log("decision", "Phase 3: SQL injection detection with sqlmap (--level 2 --risk 1, detection only)")
        # Look for forms/params to test
        directories = recon_results.get("directories", [])
        test_urls = [base_url]
        for d in directories[:5]:
            path = d.split("(")[0].strip() if "(" in d else d.strip()
            if path.startswith("/"):
                test_urls.append(f"{base_url}{path}")

        # Use sqlmap crawl mode for detection
        sqlmap_cmd = (
            f"sqlmap -u {shlex.quote(base_url)} --crawl=2 --batch --level=2 --risk=1 "
            f"--threads=3 --timeout=15 --output-dir=/tmp/sqlmap_scan "
            f"--forms --smart 2>/dev/null || true"
        )
        job_id, sqlmap_out, sqlmap_analysis = await self._run_tool("sqlmap", sqlmap_cmd, timeout=180)
        results["sqlmap_output"] = sqlmap_out

        # Check if SQLi was found
        if "is vulnerable" in sqlmap_out.lower() or "injectable" in sqlmap_out.lower():
            results["sqlmap_targets"].append({"url": base_url, "evidence": sqlmap_out[:2000]})
            async with async_session() as session:
                finding = Finding(
                    target_id=self.target_id,
                    scan_job_id=job_id,
                    finding_type="sqli",
                    title="SQL Injection vulnerability detected",
                    description="sqlmap detected a SQL injection vulnerability during crawl-based scanning.",
                    severity="critical",
                    cvss_score=9.8,
                    evidence=sqlmap_out[:3000],
                    url=base_url,
                    cwe_id="CWE-89",
                    remediation="Use parameterized queries/prepared statements. Implement input validation.",
                )
                session.add(finding)
                await session.commit()

        # 4. LLM decides what additional checks to run
        vuln_summary_prompt = (
            f"You are a penetration tester. Based on the vulnerability scan results:\n\n"
            f"Nikto analysis: {nikto_analysis[:2000]}\n"
            f"Security issues found: {len(all_issues)}\n"
            f"SQLi detected: {'Yes' if results['sqlmap_targets'] else 'No'}\n\n"
            f"Summarize all vulnerabilities found and their severity. "
            f"Also suggest which vulnerabilities should be validated through exploitation."
        )
        vuln_summary = await self._ask_llm(vuln_summary_prompt)
        results["summary"] = vuln_summary
        await self._log("decision", f"Vulnerability Assessment Summary:\n{vuln_summary}")

        return results

    async def _parse_nikto_findings(self, nikto_output: str, job_id: int, target_url: str):
        """Parse Nikto output and create Finding records."""
        findings_created = 0
        for line in nikto_output.split("\n"):
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue
            if "OSVDB" in line or "+ " in line:
                # Determine severity based on content
                severity = "low"
                finding_type = "misconfig"
                if any(w in line.lower() for w in ["sql", "injection"]):
                    severity = "high"
                    finding_type = "sqli"
                elif any(w in line.lower() for w in ["xss", "cross-site"]):
                    severity = "high"
                    finding_type = "xss"
                elif any(w in line.lower() for w in ["directory listing", "index of", "backup"]):
                    severity = "medium"
                    finding_type = "info_disclosure"
                elif any(w in line.lower() for w in ["phpinfo", "server-status", "debug"]):
                    severity = "medium"
                    finding_type = "info_disclosure"
                elif any(w in line.lower() for w in ["default", "admin"]):
                    severity = "medium"
                    finding_type = "misconfig"

                title = line[:200] if len(line) > 200 else line
                # Strip leading "+ " for cleaner title
                if title.startswith("+ "):
                    title = title[2:]

                async with async_session() as session:
                    finding = Finding(
                        target_id=self.target_id,
                        scan_job_id=job_id,
                        finding_type=finding_type,
                        title=title,
                        description=line,
                        severity=severity,
                        evidence=line,
                        url=target_url,
                    )
                    session.add(finding)
                    await session.commit()
                    findings_created += 1

                if findings_created >= 30:
                    break

        await self._log("finding", f"Parsed {findings_created} findings from Nikto output")
