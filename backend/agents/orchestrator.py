"""Pentest orchestrator: chains all 4 phases and manages lifecycle."""

import asyncio
import logging
from datetime import datetime, timezone

from backend.agents.recon import ReconAgent
from backend.agents.vuln_scanner import VulnScannerAgent
from backend.agents.exploit_validator import ExploitValidatorAgent
from backend.agents.reporter import ReporterAgent
from backend.database import Target, async_session
from backend.ws_manager import ws_manager

logger = logging.getLogger(__name__)

# Track running pentests: target_id -> orchestrator instance
_active_pentests: dict[int, "PentestOrchestrator"] = {}


class PentestOrchestrator:
    def __init__(self, target_id: int, target_url: str, target_name: str = ""):
        self.target_id = target_id
        self.target_url = target_url
        self.target_name = target_name or target_url
        self.current_phase = None
        self.context = {
            "target_url": target_url,
            "target_name": target_name,
        }
        self._waiting_for_approval = False
        self._approval_event = asyncio.Event()
        self._cancelled = False

    @property
    def waiting_for_approval(self):
        return self._waiting_for_approval

    async def run_full_pentest(self):
        """Run the complete 4-phase pentest pipeline."""
        _active_pentests[self.target_id] = self

        try:
            await self._update_target_status("scanning")
            await self._broadcast_phase("starting", "Pentest initiated")

            # Phase 1: Recon
            self.current_phase = "recon"
            await self._broadcast_phase("recon", "Starting reconnaissance...")
            recon_agent = ReconAgent(self.target_id)
            recon_results = await recon_agent.run(self.context)
            self.context["recon_results"] = recon_results

            if self._cancelled:
                return await self._handle_cancel()

            # Phase 2: Vulnerability Scanning
            self.current_phase = "vuln_scan"
            await self._broadcast_phase("vuln_scan", "Starting vulnerability assessment...")
            vuln_agent = VulnScannerAgent(self.target_id)
            vuln_results = await vuln_agent.run(self.context)
            self.context["vuln_results"] = vuln_results

            if self._cancelled:
                return await self._handle_cancel()

            # Phase 3: Exploit Validation (requires approval)
            self.current_phase = "exploit"
            await self._broadcast_phase("exploit", "Exploit validation - awaiting approval...")

            # First run without approval to trigger the gate
            exploit_agent = ExploitValidatorAgent(self.target_id)
            exploit_results = await exploit_agent.run(self.context)

            if exploit_results.get("status") == "awaiting_approval":
                self._waiting_for_approval = True
                # Wait for human approval
                await self._approval_event.wait()
                self._waiting_for_approval = False

                if self._cancelled:
                    return await self._handle_cancel()

                # Re-run with approval
                self.context["exploit_approved"] = True
                await self._broadcast_phase("exploit", "Exploit validation approved - running exploits...")
                exploit_results = await exploit_agent.run(self.context)

            self.context["exploit_results"] = exploit_results

            if self._cancelled:
                return await self._handle_cancel()

            # Phase 4: Report
            self.current_phase = "report"
            await self._broadcast_phase("report", "Generating penetration test report...")
            reporter_agent = ReporterAgent(self.target_id)
            report_results = await reporter_agent.run(self.context)

            await self._update_target_status("completed")
            await self._broadcast_phase("completed", f"Pentest complete! Risk score: {report_results.get('risk_score', 'N/A')}/100")

            return report_results

        except Exception as e:
            logger.error(f"Pentest failed for target {self.target_id}: {e}")
            await self._update_target_status("failed")
            await self._broadcast_phase("error", f"Pentest failed: {str(e)}")
            raise
        finally:
            _active_pentests.pop(self.target_id, None)

    def approve_exploit(self):
        """Human approves the exploit phase."""
        self._approval_event.set()

    def cancel(self):
        """Cancel the pentest."""
        self._cancelled = True
        self._approval_event.set()  # Unblock if waiting

    async def _handle_cancel(self):
        await self._update_target_status("failed")
        await self._broadcast_phase("cancelled", "Pentest cancelled by user")
        return {"status": "cancelled"}

    async def _update_target_status(self, status: str):
        async with async_session() as session:
            target = await session.get(Target, self.target_id)
            if target:
                target.status = status
                await session.commit()

    async def _broadcast_phase(self, phase: str, message: str):
        await ws_manager.broadcast(self.target_id, {
            "type": "phase_update",
            "target_id": self.target_id,
            "phase": phase,
            "message": message,
        })


def get_active_pentest(target_id: int) -> PentestOrchestrator | None:
    return _active_pentests.get(target_id)


def get_all_active() -> dict[int, PentestOrchestrator]:
    return _active_pentests
