"""Reconnaissance agent: nmap, whatweb, wafw00f, gobuster."""

import shlex
from urllib.parse import urlparse

from backend.agents.base import BaseAgent
from backend.database import Finding, async_session


class ReconAgent(BaseAgent):
    phase = "recon"

    async def run(self, context: dict = None) -> dict:
        target_url = context.get("target_url", "")
        parsed = urlparse(target_url)
        host = parsed.hostname or target_url
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        base_url = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme else f"http://{host}:{port}"

        await self._log("thinking", f"Starting reconnaissance on {target_url}")

        results = {"host": host, "port": port, "base_url": base_url, "technologies": [], "open_ports": [], "directories": [], "waf_detected": None}

        # 1. Nmap scan
        await self._log("decision", "Phase 1: Port scanning with nmap")
        nmap_cmd = f"nmap -sV -sC -T4 --top-ports 1000 -oN - {shlex.quote(host)}"
        job_id, nmap_out, nmap_analysis = await self._run_tool("nmap", nmap_cmd, timeout=120)
        results["nmap_output"] = nmap_out
        results["nmap_analysis"] = nmap_analysis

        # Parse open ports from nmap output
        for line in nmap_out.split("\n"):
            if "/tcp" in line and "open" in line:
                parts = line.strip().split()
                if parts:
                    results["open_ports"].append(parts[0])

        # 2. WhatWeb - technology detection
        await self._log("decision", "Phase 2: Technology fingerprinting with whatweb")
        whatweb_cmd = f"whatweb -a 3 --color=never {shlex.quote(base_url)}"
        job_id, whatweb_out, whatweb_analysis = await self._run_tool("whatweb", whatweb_cmd, timeout=60)
        results["whatweb_output"] = whatweb_out

        # 3. WAF detection
        await self._log("decision", "Phase 3: WAF detection with wafw00f")
        waf_cmd = f"wafw00f {shlex.quote(base_url)}"
        job_id, waf_out, waf_analysis = await self._run_tool("wafw00f", waf_cmd, timeout=30)
        if "No WAF" in waf_out:
            results["waf_detected"] = False
        elif "is behind" in waf_out:
            results["waf_detected"] = True

        # 4. Directory enumeration
        await self._log("decision", "Phase 4: Directory brute-forcing with gobuster")
        wordlist = "/usr/share/seclists/Discovery/Web-Content/common.txt"
        gobuster_cmd = (
            f"gobuster dir -u {shlex.quote(base_url)} "
            f"-w {wordlist} -t 20 --no-color --timeout 10s -q 2>/dev/null || true"
        )
        job_id, gobuster_out, gobuster_analysis = await self._run_tool("gobuster", gobuster_cmd, timeout=120)
        for line in gobuster_out.split("\n"):
            line = line.strip()
            if line.startswith("/") or "(Status:" in line:
                results["directories"].append(line)

        # 5. LLM summary of all recon
        summary_prompt = (
            f"You are a penetration tester. Summarize the reconnaissance findings for {target_url}.\n\n"
            f"Open ports: {results['open_ports']}\n"
            f"WAF detected: {results['waf_detected']}\n"
            f"WhatWeb output: {results.get('whatweb_output', '')[:2000]}\n"
            f"Directories found: {results['directories'][:30]}\n\n"
            f"List the key technologies, potential attack surface, and recommended vulnerability checks."
        )
        recon_summary = await self._ask_llm(summary_prompt)
        results["summary"] = recon_summary
        await self._log("decision", f"Recon Summary:\n{recon_summary}")

        # Create informational findings for discovered items
        async with async_session() as session:
            if results["open_ports"]:
                finding = Finding(
                    target_id=self.target_id,
                    finding_type="info_disclosure",
                    title=f"Open ports discovered: {', '.join(results['open_ports'][:10])}",
                    description=f"Nmap scan revealed {len(results['open_ports'])} open ports on {host}.",
                    severity="info",
                    evidence=nmap_out[:3000],
                    url=target_url,
                )
                session.add(finding)

            if results["waf_detected"] is False:
                finding = Finding(
                    target_id=self.target_id,
                    finding_type="misconfig",
                    title="No Web Application Firewall detected",
                    description="wafw00f did not detect a WAF protecting the application. This makes the target more susceptible to web attacks.",
                    severity="low",
                    evidence=waf_out[:2000],
                    url=target_url,
                )
                session.add(finding)

            await session.commit()

        await self._log("finding", f"Recon complete. Found {len(results['open_ports'])} open ports, {len(results['directories'])} directories.")
        return results
