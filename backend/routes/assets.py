"""
Assets API router.

Provides CRUD operations for infrastructure assets, YAML bulk import,
and network scanning via nmap.
"""

import logging
from typing import Any

import yaml
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import Asset, async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets", tags=["Assets"])


# ---------------------------------------------------------------------------
# Dependency helper
# ---------------------------------------------------------------------------

async def _get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AssetCreate(BaseModel):
    name: str
    type: str = "service"
    vendor: str | None = None
    product: str | None = None
    version: str | None = None
    port: int | None = None
    network: str | None = None


class YamlImport(BaseModel):
    yaml_content: str


class ScanRequest(BaseModel):
    target: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", summary="List all assets")
@router.get("/", summary="List all assets", include_in_schema=False)
async def list_assets(
    db: AsyncSession = Depends(_get_db),
) -> list[dict[str, Any]]:
    result = await db.execute(select(Asset).order_by(Asset.created_at.desc()))
    assets = result.scalars().all()
    return [a.to_dict() for a in assets]


@router.post("", summary="Create a single asset", status_code=201)
async def create_asset(
    payload: AssetCreate,
    db: AsyncSession = Depends(_get_db),
) -> dict[str, Any]:
    asset = Asset(
        name=payload.name,
        type=payload.type,
        vendor=payload.vendor,
        product=payload.product,
        version=payload.version,
        port=payload.port,
        network=payload.network,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset.to_dict()


@router.post("/import-yaml", summary="Bulk import assets from YAML")
async def import_yaml(
    payload: YamlImport,
    db: AsyncSession = Depends(_get_db),
) -> dict[str, Any]:
    try:
        data = yaml.safe_load(payload.yaml_content)
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")

    asset_list = data.get("assets", []) if isinstance(data, dict) else []
    if not asset_list:
        raise HTTPException(status_code=400, detail="No assets found in YAML. Expected key 'assets' with a list.")

    created = []
    for item in asset_list:
        asset = Asset(
            name=item.get("name", "unnamed"),
            type=item.get("type", "service"),
            vendor=item.get("vendor"),
            product=item.get("product"),
            version=str(item.get("version", "")) if item.get("version") is not None else None,
            port=item.get("port"),
            network=item.get("network"),
        )
        db.add(asset)
        await db.flush()
        created.append(asset.to_dict())

    await db.commit()

    return {
        "message": f"Imported {len(created)} assets",
        "assets": created,
    }


@router.post("/scan", summary="Scan network for assets")
async def scan_network(
    payload: ScanRequest,
    db: AsyncSession = Depends(_get_db),
) -> dict[str, Any]:
    """Run a quick nmap scan on the target and create assets from discovered services."""
    import asyncio
    target = payload.target

    try:
        proc = await asyncio.create_subprocess_shell(
            f"nmap -sV -T4 --top-ports 100 -oG - {target} 2>/dev/null",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
        output = stdout.decode("utf-8", errors="replace")
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Scan timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {e}")

    discovered = []
    for line in output.split("\n"):
        if "Ports:" not in line:
            continue
        # Extract host
        host = line.split()[1] if len(line.split()) > 1 else target
        # Parse ports section
        ports_section = line.split("Ports:")[1] if "Ports:" in line else ""
        for port_info in ports_section.split(","):
            port_info = port_info.strip()
            parts = port_info.split("/")
            if len(parts) >= 5:
                port_num = int(parts[0]) if parts[0].isdigit() else None
                service = parts[4].strip() if len(parts) > 4 else ""
                version = parts[6].strip() if len(parts) > 6 else ""
                product = parts[5].strip() if len(parts) > 5 else service

                asset = Asset(
                    name=f"{host}:{port_num}" if port_num else host,
                    type="service",
                    vendor=service,
                    product=product,
                    version=version if version else None,
                    port=port_num,
                    network=target,
                )
                db.add(asset)
                await db.flush()
                discovered.append(asset.to_dict())

    await db.commit()

    return {
        "message": f"Discovered {len(discovered)} services on {target}",
        "assets": discovered,
        "raw_output": output[:5000],
    }


@router.delete("/{asset_id}", summary="Delete an asset")
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(_get_db),
) -> dict[str, str]:
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
    return {"message": f"Asset {asset_id} deleted"}
