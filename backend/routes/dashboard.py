"""
Dashboard API router.

Provides aggregated statistics and recent high-priority briefings
for the frontend dashboard view.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import Asset, Briefing, Threat, async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


# ---------------------------------------------------------------------------
# Dependency helper
# ---------------------------------------------------------------------------

async def _get_db() -> AsyncSession:
    """Yield a database session."""
    async with async_session() as session:
        yield session


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/stats", summary="Get dashboard statistics")
async def get_stats(
    db: AsyncSession = Depends(_get_db),
) -> dict[str, Any]:
    """
    Return aggregate counts for the dashboard overview:

    - total_assets
    - total_threats
    - critical_threats
    - active_exploits (threats flagged as actively exploited)
    - pending_briefings (status = new)
    - acknowledged_briefings
    - in_progress_briefings
    - resolved_briefings
    - total_briefings
    """
    # Total assets
    result = await db.execute(select(func.count(Asset.id)))
    total_assets = result.scalar() or 0

    # Total threats
    result = await db.execute(select(func.count(Threat.id)))
    total_threats = result.scalar() or 0

    # Critical threats
    result = await db.execute(
        select(func.count(Threat.id)).where(Threat.severity == "critical")
    )
    critical_threats = result.scalar() or 0

    # Active exploits
    result = await db.execute(
        select(func.count(Threat.id)).where(Threat.actively_exploited == True)
    )
    active_exploits = result.scalar() or 0

    # Briefing counts by status
    result = await db.execute(select(func.count(Briefing.id)))
    total_briefings = result.scalar() or 0

    result = await db.execute(
        select(func.count(Briefing.id)).where(Briefing.status == "new")
    )
    pending_briefings = result.scalar() or 0

    result = await db.execute(
        select(func.count(Briefing.id)).where(Briefing.status == "acknowledged")
    )
    acknowledged_briefings = result.scalar() or 0

    result = await db.execute(
        select(func.count(Briefing.id)).where(Briefing.status == "in_progress")
    )
    in_progress_briefings = result.scalar() or 0

    result = await db.execute(
        select(func.count(Briefing.id)).where(Briefing.status == "resolved")
    )
    resolved_briefings = result.scalar() or 0

    # Threats by severity breakdown
    severity_breakdown = {}
    for sev in ("critical", "high", "medium", "low"):
        result = await db.execute(
            select(func.count(Threat.id)).where(Threat.severity == sev)
        )
        severity_breakdown[sev] = result.scalar() or 0

    # Threats by source breakdown
    source_breakdown = {}
    for src in ("nvd", "cisa_kev", "exploitdb", "github", "shodan", "greynoise"):
        result = await db.execute(
            select(func.count(Threat.id)).where(Threat.source == src)
        )
        source_breakdown[src] = result.scalar() or 0

    return {
        "total_assets": total_assets,
        "total_threats": total_threats,
        "critical_threats": critical_threats,
        "active_exploits": active_exploits,
        "total_briefings": total_briefings,
        "pending_briefings": pending_briefings,
        "acknowledged_briefings": acknowledged_briefings,
        "in_progress_briefings": in_progress_briefings,
        "resolved_briefings": resolved_briefings,
        "severity_breakdown": severity_breakdown,
        "source_breakdown": source_breakdown,
    }


@router.get("/recent", summary="Get recent high-priority briefings")
async def get_recent_briefings(
    db: AsyncSession = Depends(_get_db),
) -> list[dict[str, Any]]:
    """
    Return the 10 most recent briefings ordered by priority score (descending).

    These are typically the most urgent items that need attention.
    """
    result = await db.execute(
        select(Briefing)
        .order_by(Briefing.priority_score.desc())
        .limit(10)
    )
    briefings = result.scalars().all()
    return [b.to_dict() for b in briefings]
