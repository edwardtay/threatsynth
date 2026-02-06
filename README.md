# ThreatSynth AI

**Autonomous AI-Powered Penetration Testing & Threat Intelligence Platform**

Live demo: [threatsynth.vercel.app](https://threatsynth.vercel.app)

## What It Does

ThreatSynth AI is a security platform that combines autonomous penetration testing with real-time threat intelligence. It ingests vulnerabilities from 6 live sources, correlates them against your infrastructure, and generates actionable briefings using a local LLM.

**Pentest Pipeline** — 4-phase autonomous workflow (Recon → Vuln Scan → Exploit Validation → Report) with a mandatory human approval gate before any active exploitation.

**Threat Intelligence** — Aggregates CVEs from NVD, CISA KEV, ExploitDB, GitHub Advisories, Shodan CVE DB, and FIRST.org EPSS. All sources are free and require no API keys.

**AI Briefings** — Matches threats to your registered assets by vendor/product and generates prioritized briefings with remediation steps and business impact analysis via a local LLM (Ollama).

## Architecture

```
Frontend (React 19 + Tailwind CSS 4)
│   Dashboard, Assets, Threats, Briefings
│   WebSocket live agent log streaming
│
├── REST API + WebSocket
│
Backend (FastAPI + SQLAlchemy + SQLite)
│
├── Multi-Agent Orchestrator
│   ├── Recon Agent        → nmap, whatweb, wafw00f, gobuster
│   ├── Vuln Scanner       → nikto, sqlmap, security headers
│   ├── Exploit Validator  → SQLi, XSS, command injection
│   │   └── Human Approval Gate
│   └── Reporter Agent     → LLM-generated reports
│
├── Threat Intel Pipeline (6 sources)
│   ├── NVD, CISA KEV, ExploitDB, GitHub Advisories
│   ├── Shodan CVE DB, FIRST.org EPSS
│   └── Asset-threat correlation + AI briefings
│
└── Ollama (gemma3:4b) — local LLM, no data leaves your network
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Tailwind CSS 4, Recharts, Lucide Icons |
| Backend | FastAPI, SQLAlchemy (async), SQLite (aiosqlite) |
| AI/LLM | Ollama (gemma3:4b) |
| Pentest Tools | nmap, whatweb, wafw00f, gobuster, nikto, sqlmap |
| Threat Intel | NVD, CISA KEV, ExploitDB, GitHub Advisories, Shodan CVE DB, FIRST EPSS |
| Infrastructure | Docker Compose, Vite, Vercel |

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) with `gemma3:4b`
- Docker (for the test target)
- Kali Linux recommended (includes nmap, nikto, sqlmap, etc.)

### Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`, proxies `/api` to the backend.

### Test Target

```bash
docker compose up -d
```

Starts DVWA on port 4280 as a safe pentesting target.

## Usage

1. Add assets (manual entry, YAML import, or network scan)
2. Ingest threats from all 6 intelligence sources
3. Generate AI briefings that correlate threats to your assets
4. Launch autonomous pentests against targets
5. Review AI-generated reports and briefings

## Security

This tool is for **authorized security testing only**. The exploit validation phase requires explicit human approval before any active exploitation runs.

## License

MIT
