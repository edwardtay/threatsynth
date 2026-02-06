#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "[*] Installing dependencies..."
npm install
echo "[*] Dependencies installed. Run 'npm run dev' to start the dev server."
