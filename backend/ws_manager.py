"""WebSocket connection manager for real-time agent streaming."""

import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, target_id: int):
        await websocket.accept()
        if target_id not in self._connections:
            self._connections[target_id] = []
        self._connections[target_id].append(websocket)

    def disconnect(self, websocket: WebSocket, target_id: int):
        if target_id in self._connections:
            self._connections[target_id] = [
                ws for ws in self._connections[target_id] if ws != websocket
            ]

    async def broadcast(self, target_id: int, data: dict):
        if target_id not in self._connections:
            return
        dead = []
        for ws in self._connections[target_id]:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, target_id)

    async def broadcast_log(self, target_id: int, phase: str, log_type: str, message: str, **extra):
        payload = {
            "type": "agent_log",
            "target_id": target_id,
            "phase": phase,
            "log_type": log_type,
            "message": message,
            **extra,
        }
        await self.broadcast(target_id, payload)


ws_manager = ConnectionManager()
