"""
Briefings API router.

Provides briefing listing, AI-powered generation from asset-threat
correlation using Ollama, and status management.
"""

import asyncio
import logging
from typing import Any

import ollama
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import Asset, Briefing, Threat, async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/briefings", tags=["Briefings"])

OLLAMA_MODEL = "gemma3:4b"


# ---------------------------------------------------------------------------
# Dependency helper
# ---------------------------------------------------------------------------

async def _get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class StatusUpdate(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", summary="List all briefings")
@router.get("/", summary="List all briefings", include_in_schema=False)
async def list_briefings(
    db: AsyncSession = Depends(_get_db),
) -> dict[str, Any]:
    result = await db.execute(
        select(Briefing).order_by(Briefing.priority_score.desc())
    )
    briefings = result.scalars().all()
    return {"briefings": [b.to_dict() for b in briefings], "total": len(briefings)}


@router.post("/generate", summary="Generate AI briefings from threat-asset correlation")
async def generate_briefings(
    db: AsyncSession = Depends(_get_db),
) -> dict[str, Any]:
    """
    Correlate threats with assets based on vendor/product matching,
    then use the LLM to generate actionable briefings for each match.
    """
    # Fetch all assets and threats
    assets_result = await db.execute(select(Asset))
    assets = assets_result.scalars().all()

    threats_result = await db.execute(select(Threat))
    threats = threats_result.scalars().all()

    if not assets:
        return {"message": "No assets found. Import assets first.", "briefings_generated": 0}
    if not threats:
        return {"message": "No threats found. Ingest threats first.", "briefings_generated": 0}

    # Correlate: match threats to assets by vendor/product
    matches = []
    for threat in threats:
        for asset in assets:
            # Match on vendor+product (case-insensitive)
            t_vendor = (threat.affected_vendor or "").lower().strip()
            t_product = (threat.affected_product or "").lower().strip()
            a_vendor = (asset.vendor or "").lower().strip()
            a_product = (asset.product or "").lower().strip()

            if not t_vendor and not t_product:
                continue

            vendor_match = t_vendor and a_vendor and (t_vendor in a_vendor or a_vendor in t_vendor)
            product_match = t_product and a_product and (t_product in a_product or a_product in t_product)

            if vendor_match or product_match:
                # Check if briefing already exists for this pair
                existing = await db.execute(
                    select(Briefing).where(
                        Briefing.threat_id == threat.id,
                        Briefing.asset_id == asset.id,
                    )
                )
                if existing.scalar():
                    continue
                matches.append((threat, asset))

    if not matches:
        return {
            "message": "No new threat-asset correlations found.",
            "briefings_generated": 0,
            "total_briefings": 0,
        }

    # Generate briefings using LLM
    generated = 0
    for threat, asset in matches:
        try:
            briefing_data = await _generate_single_briefing(threat, asset)

            briefing = Briefing(
                threat_id=threat.id,
                asset_id=asset.id,
                summary=briefing_data.get("summary", ""),
                remediation=briefing_data.get("remediation", ""),
                business_impact=briefing_data.get("business_impact", ""),
                priority_score=briefing_data.get("priority_score", 5.0),
                status="new",
            )
            db.add(briefing)
            generated += 1
        except Exception as e:
            logger.error(f"Failed to generate briefing for threat {threat.id} / asset {asset.id}: {e}")
            continue

    await db.commit()

    return {
        "message": f"Generated {generated} new briefings from {len(matches)} threat-asset correlations",
        "briefings_generated": generated,
        "total_briefings": generated,
    }


@router.patch("/{briefing_id}/status", summary="Update briefing status")
async def update_status(
    briefing_id: int,
    payload: StatusUpdate,
    db: AsyncSession = Depends(_get_db),
) -> dict[str, Any]:
    valid_statuses = {"new", "acknowledged", "in_progress", "resolved"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    briefing = await db.get(Briefing, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")

    briefing.status = payload.status
    await db.commit()
    await db.refresh(briefing)
    return briefing.to_dict()


# ---------------------------------------------------------------------------
# LLM briefing generation
# ---------------------------------------------------------------------------

async def _generate_single_briefing(threat: Threat, asset: Asset) -> dict:
    """Use the LLM to generate a threat briefing for a specific asset."""

    # Calculate base priority score from threat attributes
    base_score = 5.0
    if threat.severity == "critical":
        base_score = 9.0
    elif threat.severity == "high":
        base_score = 7.0
    elif threat.severity == "medium":
        base_score = 5.0
    elif threat.severity == "low":
        base_score = 3.0

    if threat.actively_exploited:
        base_score = min(10.0, base_score + 1.5)
    if threat.exploits_available:
        base_score = min(10.0, base_score + 0.5)

    prompt = (
        f"You are a cybersecurity analyst generating a threat intelligence briefing.\n\n"
        f"THREAT:\n"
        f"- ID: {threat.source_id}\n"
        f"- Title: {threat.title}\n"
        f"- Source: {threat.source}\n"
        f"- Severity: {threat.severity}\n"
        f"- CVSS: {threat.cvss_score}\n"
        f"- Actively Exploited: {threat.actively_exploited}\n"
        f"- Description: {(threat.description or '')[:1000]}\n\n"
        f"AFFECTED ASSET:\n"
        f"- Name: {asset.name}\n"
        f"- Type: {asset.type}\n"
        f"- Vendor: {asset.vendor}\n"
        f"- Product: {asset.product}\n"
        f"- Version: {asset.version}\n"
        f"- Port: {asset.port}\n\n"
        f"Generate a JSON-like response with EXACTLY these three sections:\n"
        f"SUMMARY: (2-3 sentences about the threat and how it affects this specific asset)\n"
        f"REMEDIATION: (3-5 specific actionable steps to mitigate this threat)\n"
        f"BUSINESS_IMPACT: (2-3 sentences about potential business consequences if unaddressed)\n"
    )

    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response["message"]["content"]

        # Parse the response
        summary = _extract_section(text, "SUMMARY")
        remediation = _extract_section(text, "REMEDIATION")
        business_impact = _extract_section(text, "BUSINESS_IMPACT")

        # Fallback if parsing failed
        if not summary:
            summary = text[:500]
        if not remediation:
            remediation = "1. Update to the latest patched version. 2. Monitor for indicators of compromise. 3. Review access controls."
        if not business_impact:
            business_impact = "Failure to address this threat could lead to unauthorized access, data breach, or service disruption."

        return {
            "summary": summary,
            "remediation": remediation,
            "business_impact": business_impact,
            "priority_score": round(base_score, 1),
        }
    except Exception as e:
        logger.error(f"LLM briefing generation failed: {e}")
        return {
            "summary": f"Threat {threat.source_id} ({threat.severity}) affects {asset.name} ({asset.product} {asset.version}). {threat.description or ''}",
            "remediation": "1. Update to the latest patched version.\n2. Monitor for indicators of compromise.\n3. Review access controls and network segmentation.",
            "business_impact": "This vulnerability could lead to unauthorized access, data breach, or service disruption if not addressed promptly.",
            "priority_score": round(base_score, 1),
        }


def _extract_section(text: str, section: str) -> str:
    """Extract a section from LLM output."""
    markers = {
        "SUMMARY": ["SUMMARY:", "**SUMMARY:**", "**SUMMARY**:"],
        "REMEDIATION": ["REMEDIATION:", "**REMEDIATION:**", "**REMEDIATION**:"],
        "BUSINESS_IMPACT": ["BUSINESS_IMPACT:", "**BUSINESS_IMPACT:**", "**BUSINESS_IMPACT**:", "BUSINESS IMPACT:"],
    }
    next_sections = {
        "SUMMARY": ["REMEDIATION"],
        "REMEDIATION": ["BUSINESS_IMPACT", "BUSINESS IMPACT"],
        "BUSINESS_IMPACT": [],
    }

    text_upper = text.upper()
    start_pos = -1

    for marker in markers.get(section, []):
        pos = text_upper.find(marker.upper())
        if pos != -1:
            start_pos = pos + len(marker)
            break

    if start_pos == -1:
        return ""

    # Find end position (next section or end of text)
    end_pos = len(text)
    for next_sec in next_sections.get(section, []):
        for marker in markers.get(next_sec, []):
            pos = text_upper.find(marker.upper(), start_pos)
            if pos != -1 and pos < end_pos:
                end_pos = pos

    return text[start_pos:end_pos].strip()
