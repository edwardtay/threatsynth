# ThreatSynth AI

**Autonomous AI-Powered Penetration Testing & Threat Intelligence Platform**

> Built for the [Deriv AI Talent Sprint Hackathon](https://lablab.ai/ai-hackathons/deriv-ai-talent-sprint)

## Overview

ThreatSynth AI is a multi-agent autonomous security platform that orchestrates penetration testing workflows, correlates threat intelligence, and generates actionable security briefings using LLMs. It combines real-time tool execution with AI-driven analysis to deliver end-to-end security assessments with a human-in-the-loop approval gate.

## Architecture

```
Frontend (React 19 + Vite + Tailwind)
│   Dashboard / Assets / Threats / Briefings
│   Real-time WebSocket agent log streaming
│
├── HTTP REST API + WebSocket
│
Backend (FastAPI + SQLAlchemy + SQLite)
│
├── Multi-Agent Orchestrator (4-Phase Pipeline)
│   ├── Phase 1: Recon Agent       → nmap, whatweb, wafw00f, gobuster
│   ├── Phase 2: Vuln Scanner      → nikto, sqlmap, security headers
│   ├── Phase 3: Exploit Validator  → SQL injection, XSS, command injection
│   │   └── Human Approval Gate (before active exploitation)
│   └── Phase 4: Reporter Agent    → LLM-generated executive reports
│
├── Threat Intelligence Pipeline
│   ├── 6-source threat ingestion
│   ├── Asset-threat correlation
│   └── AI briefing synthesis
│
└── LLM Backend (Ollama - gemma3:4b)
    ├── Payload generation
    ├── Vulnerability analysis
    └── Report generation
```

## Key Features

- **4-Phase Autonomous Pentesting** - Automated recon, vulnerability scanning, exploit validation, and report generation chained together with intelligent orchestration
- **Human-in-the-Loop** - Approval gate before any active exploitation, keeping humans in control of offensive actions
- **Multi-Agent System** - Specialized agents (Recon, VulnScanner, ExploitValidator, Reporter) with a coordinating orchestrator
- **Real-Time Streaming** - WebSocket-based live streaming of agent logs, tool output, and scan progress
- **AI-Powered Analysis** - Local LLM (Ollama) for vulnerability analysis, payload generation, and executive report writing
- **Threat Intelligence Dashboard** - Centralized view of assets, threats, and AI-generated security briefings with severity scoring
- **Web Security Scanning** - Automated checks for security headers, CORS misconfigurations, HTTP methods, and cookie security

## Tech Stack

| Layer          | Technology                                    |
|----------------|-----------------------------------------------|
| Frontend       | React 19, React Router 7, Tailwind CSS 4, Recharts, Lucide Icons |
| Backend        | FastAPI, SQLAlchemy (async), SQLite            |
| AI/LLM         | Ollama (gemma3:4b)                            |
| Security Tools | nmap, whatweb, wafw00f, gobuster, nikto, sqlmap |
| Infrastructure | Docker Compose, DVWA (vulnerable test target)  |
| Real-Time      | WebSocket (native FastAPI)                     |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) with `gemma3:4b` model pulled
- Docker & Docker Compose (for test target)

### 1. Start the vulnerable test target

```bash
docker compose up -d
```

This spins up DVWA (Damn Vulnerable Web Application) on port 4280 as a safe testing target.

### 2. Backend setup

```bash
cd backend
python -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend.

### 4. Pull the LLM model

```bash
ollama pull gemma3:4b
```

## Usage

1. Open the dashboard at `http://localhost:5173`
2. Add target assets via the **Assets** page
3. Launch an autonomous pentest from the **Dashboard**
4. Monitor real-time agent progress via WebSocket streaming
5. Approve or reject exploit validation when prompted
6. Review AI-generated reports and briefings

## Project Structure

```
deriv-ai-hackathon/
├── backend/
│   ├── agents/           # Multi-agent system
│   │   ├── base.py           # Base agent with LLM + tool execution
│   │   ├── orchestrator.py   # 4-phase pentest orchestrator
│   │   ├── recon.py          # Reconnaissance agent
│   │   ├── vuln_scanner.py   # Vulnerability scanning agent
│   │   ├── exploit_validator.py  # Exploit validation agent
│   │   └── reporter.py       # LLM report generation agent
│   ├── routes/           # API route handlers
│   ├── tools/            # Security scanning tools
│   ├── templates/        # HTML templates
│   ├── database.py       # SQLAlchemy models
│   ├── main.py           # FastAPI entry point
│   └── ws_manager.py     # WebSocket manager
├── frontend/
│   └── src/
│       ├── pages/        # Dashboard, Assets, Threats, Briefings
│       ├── components/   # Shared UI components
│       └── services/     # API client
├── data/                 # SQLite database (gitignored)
├── docker-compose.yml    # DVWA test target
└── e2e_test.py           # End-to-end test script
```

## Security Note

This tool is designed for **authorized security testing only**. The exploit validation phase includes a mandatory human approval gate. Always ensure you have explicit permission before scanning any target.

## License

MIT
