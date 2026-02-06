"""Base agent class with tool execution, LLM integration, and logging."""

import asyncio
import logging
import shlex
from datetime import datetime, timezone

import ollama

from backend.database import AgentLog, ScanJob, async_session
from backend.ws_manager import ws_manager

logger = logging.getLogger(__name__)

OLLAMA_MODEL = "gemma3:4b"


class BaseAgent:
    phase: str = "base"

    def __init__(self, target_id: int):
        self.target_id = target_id

    # ------------------------------------------------------------------
    # Tool execution
    # ------------------------------------------------------------------

    async def _run_tool(self, tool_name: str, command: str, timeout: int = 300) -> tuple[int, str, str]:
        """Run a shell command, stream output via WebSocket, save to DB.
        Returns (scan_job_id, stdout, ai_analysis)."""

        await self._log("tool_start", f"Running: {command}")

        # Create ScanJob record
        async with async_session() as session:
            job = ScanJob(
                target_id=self.target_id,
                phase=self.phase,
                tool_name=tool_name,
                status="running",
                command=command,
            )
            session.add(job)
            await session.commit()
            await session.refresh(job)
            job_id = job.id

        # Execute command
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=None,
            )

            output_lines = []
            while True:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=timeout)
                except asyncio.TimeoutError:
                    proc.kill()
                    output_lines.append("\n[TIMEOUT - process killed]")
                    break
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace").rstrip()
                output_lines.append(decoded)
                await self._log("tool_output", decoded, scan_job_id=job_id)

            await proc.wait()
            raw_output = "\n".join(output_lines)

            # Truncate very long output for LLM
            llm_input = raw_output[:8000] if len(raw_output) > 8000 else raw_output

            # AI analysis of output
            ai_analysis = await self._ask_llm(
                f"You are a penetration tester analyzing tool output. "
                f"Tool: {tool_name}\nCommand: {command}\n\nOutput:\n{llm_input}\n\n"
                f"Provide a concise analysis: what was found, potential vulnerabilities, "
                f"and recommended next steps. Be specific about any findings."
            )

            await self._log("decision", f"AI Analysis:\n{ai_analysis}", scan_job_id=job_id)

            # Update ScanJob
            async with async_session() as session:
                job = await session.get(ScanJob, job_id)
                job.status = "completed"
                job.raw_output = raw_output
                job.ai_analysis = ai_analysis
                job.completed_at = datetime.now(timezone.utc)
                await session.commit()

            return job_id, raw_output, ai_analysis

        except Exception as e:
            error_msg = f"Tool execution failed: {str(e)}"
            await self._log("error", error_msg, scan_job_id=job_id)
            async with async_session() as session:
                job = await session.get(ScanJob, job_id)
                job.status = "failed"
                job.raw_output = error_msg
                job.completed_at = datetime.now(timezone.utc)
                await session.commit()
            return job_id, error_msg, ""

    # ------------------------------------------------------------------
    # LLM integration
    # ------------------------------------------------------------------

    async def _ask_llm(self, prompt: str) -> str:
        """Ask the local Ollama LLM a question."""
        await self._log("thinking", "AI is analyzing...")

        try:
            response = await asyncio.to_thread(
                ollama.chat,
                model=OLLAMA_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            return response["message"]["content"]
        except Exception as e:
            logger.error(f"LLM error: {e}")
            return f"[LLM unavailable: {str(e)}]"

    # ------------------------------------------------------------------
    # Logging (DB + WebSocket)
    # ------------------------------------------------------------------

    async def _log(self, log_type: str, message: str, scan_job_id: int = None):
        """Log to database and broadcast via WebSocket."""
        # Save to DB
        async with async_session() as session:
            log = AgentLog(
                target_id=self.target_id,
                scan_job_id=scan_job_id,
                phase=self.phase,
                log_type=log_type,
                message=message,
            )
            session.add(log)
            await session.commit()

        # Broadcast via WebSocket
        await ws_manager.broadcast_log(
            target_id=self.target_id,
            phase=self.phase,
            log_type=log_type,
            message=message,
            scan_job_id=scan_job_id,
        )

    # ------------------------------------------------------------------
    # Run (override in subclasses)
    # ------------------------------------------------------------------

    async def run(self, context: dict = None) -> dict:
        raise NotImplementedError
