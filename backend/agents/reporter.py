"""Reporter agent: LLM generates executive + technical pentest report."""

from backend.agents.base import BaseAgent
from backend.database import Finding, Report, async_session
from sqlalchemy import select


class ReporterAgent(BaseAgent):
    phase = "report"

    async def run(self, context: dict = None) -> dict:
        target_url = context.get("target_url", "")
        target_name = context.get("target_name", target_url)

        await self._log("thinking", "Generating penetration test report...")

        # Gather all findings for this target
        async with async_session() as session:
            result = await session.execute(
                select(Finding).where(Finding.target_id == self.target_id)
            )
            findings = result.scalars().all()

        # Count by severity
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in findings:
            sev = f.severity.lower() if f.severity else "info"
            if sev in counts:
                counts[sev] += 1

        validated = [f for f in findings if f.is_validated]
        total = len(findings)

        # Calculate risk score (0-100)
        risk_score = min(100.0, (
            counts["critical"] * 25 +
            counts["high"] * 15 +
            counts["medium"] * 8 +
            counts["low"] * 3 +
            counts["info"] * 1
        ))

        # Build findings summary for LLM
        findings_text = ""
        for f in findings[:40]:
            validated_tag = " [VALIDATED]" if f.is_validated else ""
            findings_text += (
                f"- [{f.severity.upper()}]{validated_tag} {f.title}\n"
                f"  Type: {f.finding_type} | URL: {f.url or 'N/A'}\n"
                f"  {f.description[:200] if f.description else ''}\n\n"
            )

        # Generate executive summary
        exec_prompt = (
            f"You are a senior penetration tester writing a report for executives.\n\n"
            f"Target: {target_name} ({target_url})\n"
            f"Total findings: {total}\n"
            f"Critical: {counts['critical']}, High: {counts['high']}, "
            f"Medium: {counts['medium']}, Low: {counts['low']}, Info: {counts['info']}\n"
            f"Validated exploits: {len(validated)}\n"
            f"Risk Score: {risk_score}/100\n\n"
            f"Key findings:\n{findings_text[:4000]}\n\n"
            f"Write a concise executive summary (2-3 paragraphs) suitable for non-technical stakeholders. "
            f"Focus on business risk, not technical details. Include overall risk level."
        )
        executive_summary = await self._ask_llm(exec_prompt)
        await self._log("decision", f"Executive Summary generated")

        # Generate technical details
        tech_prompt = (
            f"You are a penetration tester writing the technical details section.\n\n"
            f"Target: {target_url}\n"
            f"Findings:\n{findings_text[:6000]}\n\n"
            f"Write a detailed technical report covering:\n"
            f"1. Methodology used\n"
            f"2. Each vulnerability found with impact assessment\n"
            f"3. Attack vectors and exploitation details\n"
            f"4. Evidence and proof of concept\n"
            f"Use markdown formatting."
        )
        technical_details = await self._ask_llm(tech_prompt)
        await self._log("decision", f"Technical details generated")

        # Generate remediation plan
        remediation_prompt = (
            f"You are a security consultant creating a remediation plan.\n\n"
            f"Findings:\n{findings_text[:4000]}\n\n"
            f"Create a prioritized remediation plan with:\n"
            f"1. Immediate actions (critical/high findings)\n"
            f"2. Short-term improvements (medium findings)\n"
            f"3. Long-term security enhancements\n"
            f"Be specific and actionable. Use markdown formatting."
        )
        remediation_plan = await self._ask_llm(remediation_prompt)
        await self._log("decision", f"Remediation plan generated")

        # Save report to DB
        async with async_session() as session:
            report = Report(
                target_id=self.target_id,
                executive_summary=executive_summary,
                technical_details=technical_details,
                remediation_plan=remediation_plan,
                risk_score=risk_score,
                critical_count=counts["critical"],
                high_count=counts["high"],
                medium_count=counts["medium"],
                low_count=counts["low"],
                info_count=counts["info"],
            )
            session.add(report)
            await session.commit()
            await session.refresh(report)

        await self._log("finding", f"Report generated. Risk score: {risk_score}/100")

        return {
            "report_id": report.id,
            "risk_score": risk_score,
            "counts": counts,
            "summary": executive_summary[:500],
        }
