"""
Database setup and ORM models for the AI Pentester & Threat Intel Synthesizer.

Models: Target, ScanJob, Finding, Report, AgentLog, Asset, Threat, Briefing
"""

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

# ---------------------------------------------------------------------------
# Database path and engine
# ---------------------------------------------------------------------------

DB_DIR = Path("/home/ed0x/deriv-ai-hackathon/data")
DB_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DB_DIR / "pentester.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"timeout": 30},
)

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Target
# ---------------------------------------------------------------------------

class Target(Base):
    __tablename__ = "targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    target_url = Column(String(1024), nullable=False)
    target_type = Column(String(50), nullable=False, default="web")
    status = Column(String(30), nullable=False, default="idle")
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    scan_jobs = relationship("ScanJob", back_populates="target", lazy="selectin", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="target", lazy="selectin", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="target", lazy="selectin", cascade="all, delete-orphan")
    agent_logs = relationship("AgentLog", back_populates="target", lazy="selectin", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "target_url": self.target_url,
            "target_type": self.target_type,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# ScanJob
# ---------------------------------------------------------------------------

class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id", ondelete="CASCADE"), nullable=False, index=True)
    phase = Column(String(50), nullable=False)
    tool_name = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    command = Column(Text, nullable=True)
    raw_output = Column(Text, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    target = relationship("Target", back_populates="scan_jobs")
    findings = relationship("Finding", back_populates="scan_job", lazy="selectin", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "phase": self.phase,
            "tool_name": self.tool_name,
            "status": self.status,
            "command": self.command,
            "raw_output": self.raw_output,
            "ai_analysis": self.ai_analysis,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# ---------------------------------------------------------------------------
# Finding
# ---------------------------------------------------------------------------

class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id", ondelete="CASCADE"), nullable=False, index=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    finding_type = Column(String(50), nullable=False)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, default="medium")
    cvss_score = Column(Float, nullable=True)
    evidence = Column(Text, nullable=True)
    url = Column(String(1024), nullable=True)
    parameter = Column(String(255), nullable=True)
    payload_used = Column(Text, nullable=True)
    is_validated = Column(Boolean, default=False, nullable=False)
    cwe_id = Column(String(20), nullable=True)
    remediation = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="open")
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    target = relationship("Target", back_populates="findings")
    scan_job = relationship("ScanJob", back_populates="findings")

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "scan_job_id": self.scan_job_id,
            "finding_type": self.finding_type,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "cvss_score": self.cvss_score,
            "evidence": self.evidence,
            "url": self.url,
            "parameter": self.parameter,
            "payload_used": self.payload_used,
            "is_validated": self.is_validated,
            "cwe_id": self.cwe_id,
            "remediation": self.remediation,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id", ondelete="CASCADE"), nullable=False, index=True)
    executive_summary = Column(Text, nullable=True)
    technical_details = Column(Text, nullable=True)
    remediation_plan = Column(Text, nullable=True)
    risk_score = Column(Float, nullable=True)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    info_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    target = relationship("Target", back_populates="reports")

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "executive_summary": self.executive_summary,
            "technical_details": self.technical_details,
            "remediation_plan": self.remediation_plan,
            "risk_score": self.risk_score,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "medium_count": self.medium_count,
            "low_count": self.low_count,
            "info_count": self.info_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# AgentLog
# ---------------------------------------------------------------------------

class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id", ondelete="CASCADE"), nullable=False, index=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id", ondelete="SET NULL"), nullable=True)
    phase = Column(String(50), nullable=True)
    log_type = Column(String(30), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    target = relationship("Target", back_populates="agent_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "scan_job_id": self.scan_job_id,
            "phase": self.phase,
            "log_type": self.log_type,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Asset (Threat Intelligence)
# ---------------------------------------------------------------------------

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False, default="service")
    vendor = Column(String(255), nullable=True)
    product = Column(String(255), nullable=True)
    version = Column(String(100), nullable=True)
    port = Column(Integer, nullable=True)
    network = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    briefings = relationship("Briefing", back_populates="asset", lazy="selectin", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "vendor": self.vendor,
            "product": self.product,
            "version": self.version,
            "port": self.port,
            "network": self.network,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Threat (Threat Intelligence)
# ---------------------------------------------------------------------------

class Threat(Base):
    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(50), nullable=False)
    source_id = Column(String(255), nullable=True)
    title = Column(String(1024), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, default="medium")
    cvss_score = Column(Float, nullable=True)
    affected_vendor = Column(String(255), nullable=True)
    affected_product = Column(String(255), nullable=True)
    affected_version = Column(String(255), nullable=True)
    exploits_available = Column(Boolean, default=False, nullable=False)
    actively_exploited = Column(Boolean, default=False, nullable=False)
    published_date = Column(DateTime, nullable=True)
    raw_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    briefings = relationship("Briefing", back_populates="threat", lazy="selectin", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "source_id": self.source_id,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "cvss_score": self.cvss_score,
            "affected_vendor": self.affected_vendor,
            "affected_product": self.affected_product,
            "affected_version": self.affected_version,
            "exploits_available": self.exploits_available,
            "actively_exploited": self.actively_exploited,
            "published_date": self.published_date.isoformat() if self.published_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Briefing (AI-generated threat intelligence briefing)
# ---------------------------------------------------------------------------

class Briefing(Base):
    __tablename__ = "briefings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    threat_id = Column(Integer, ForeignKey("threats.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    summary = Column(Text, nullable=True)
    remediation = Column(Text, nullable=True)
    business_impact = Column(Text, nullable=True)
    priority_score = Column(Float, nullable=False, default=0.0)
    status = Column(String(30), nullable=False, default="new")
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    threat = relationship("Threat", back_populates="briefings")
    asset = relationship("Asset", back_populates="briefings")

    def to_dict(self):
        return {
            "id": self.id,
            "threat_id": self.threat_id,
            "asset_id": self.asset_id,
            "summary": self.summary,
            "remediation": self.remediation,
            "business_impact": self.business_impact,
            "priority_score": self.priority_score,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Database initialisation
# ---------------------------------------------------------------------------

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
