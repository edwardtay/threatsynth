"""
FastAPI application entry point for the Autonomous Threat Intel Synthesizer.

Configures CORS, registers all routers, initialises the database on startup,
and exposes a health-check endpoint.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.routes.assets import router as assets_router
from backend.routes.threats import router as threats_router
from backend.routes.briefings import router as briefings_router
from backend.routes.dashboard import router as dashboard_router

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifespan (startup / shutdown hooks)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application startup and shutdown events.

    On startup: initialise database tables.
    """
    logger.info("Initialising database tables...")
    await init_db()
    logger.info("Database ready.")
    yield
    logger.info("Application shutting down.")


# ---------------------------------------------------------------------------
# FastAPI application instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Autonomous Threat Intel Synthesizer",
    description=(
        "AI-powered threat intelligence platform that ingests data from "
        "6 sources, correlates against your infrastructure stack, and "
        "generates prioritised actionable briefings using a local LLM."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS middleware (permissive for hackathon)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

app.include_router(assets_router)
app.include_router(threats_router)
app.include_router(briefings_router)
app.include_router(dashboard_router)


# ---------------------------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["System"])
async def health_check() -> dict[str, Any]:
    """
    Basic health check endpoint.

    Returns the application status, current UTC timestamp, and version.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "service": "Autonomous Threat Intel Synthesizer",
    }
