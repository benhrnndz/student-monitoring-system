import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any
from fastapi import WebSocket

logger = logging.getLogger("websocket")

class WebSocketRoomManager:
    def __init__(self):
        # sessionId -> { "students": { studentId: { "ws": WebSocket, ... } }, "teachers": [WebSocket] }
        self.rooms: Dict[str, Dict[str, Any]] = {}

    def _ensure_room(self, session_id: str):
        if session_id not in self.rooms:
            self.rooms[session_id] = {
                "students": {},
                "teachers": []
            }

    def _serialize_student(self, s: dict) -> dict:
        """Returns clean student data omitting non-serializable WebSocket objects."""
        return {
            "studentId": s.get("studentId"),
            "name": s.get("name", "Student"),
            "currentStatus": s.get("currentStatus", "ACTIVE"),
            "cameraOn": bool(s.get("cameraOn", False)),
            "extensionActive": bool(s.get("extensionActive", False)),
            "tabAwayCount": int(s.get("tabAwayCount", 0)),
            "windowBlurCount": int(s.get("windowBlurCount", 0)),
            "lastActiveAt": s.get("lastActiveAt", 0)
        }

    async def connect_teacher(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self._ensure_room(session_id)
        self.rooms[session_id]["teachers"].append(websocket)
        
        # Send initial roster snapshot to teacher
        roster = self.get_roster_snapshot(session_id)
        await websocket.send_text(json.dumps({
            "event": "teacher:roster_sync",
            "sessionId": session_id,
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "payload": roster
        }))
        logger.info(f"Teacher connected to room {session_id}. Sent roster with {len(roster['students'])} students.")

    async def connect_student(self, session_id: str, student_id: str, student_info: dict, websocket: WebSocket):
        await websocket.accept()
        self._ensure_room(session_id)
        
        self.rooms[session_id]["students"][student_id] = {
            "ws": websocket,
            "studentId": student_id,
            "name": student_info.get("name", "Student"),
            "currentStatus": "ACTIVE",
            "cameraOn": student_info.get("cameraOn", False),
            "extensionActive": student_info.get("extensionInstalled", False),
            "tabAwayCount": 0,
            "windowBlurCount": 0,
            "lastActiveAt": int(datetime.now(timezone.utc).timestamp() * 1000)
        }

        # Broadcast clean student joined / updated payload to teachers
        clean_student = self._serialize_student(self.rooms[session_id]["students"][student_id])
        await self.broadcast_to_teachers(session_id, {
            "event": "teacher:student_updated",
            "sessionId": session_id,
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "payload": clean_student
        })
        logger.info(f"Student {clean_student['name']} broadcasted to teachers in {session_id}")

    def disconnect_teacher(self, session_id: str, websocket: WebSocket):
        if session_id in self.rooms and websocket in self.rooms[session_id]["teachers"]:
            self.rooms[session_id]["teachers"].remove(websocket)

    async def disconnect_student(self, session_id: str, student_id: str):
        if session_id in self.rooms and student_id in self.rooms[session_id]["students"]:
            student_data = self.rooms[session_id]["students"][student_id]
            clean_student = self._serialize_student(student_data)
            clean_student["currentStatus"] = "DISCONNECTED"
            
            # Notify teachers
            await self.broadcast_to_teachers(session_id, {
                "event": "teacher:student_updated",
                "sessionId": session_id,
                "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                "payload": clean_student
            })
            del self.rooms[session_id]["students"][student_id]

    async def update_student_status(self, session_id: str, student_id: str, status_payload: dict):
        if session_id in self.rooms and student_id in self.rooms[session_id]["students"]:
            student = self.rooms[session_id]["students"][student_id]
            new_status = status_payload.get("newStatus", student["currentStatus"])
            student["currentStatus"] = new_status
            student["lastActiveAt"] = int(datetime.now(timezone.utc).timestamp() * 1000)

            if new_status == "TAB_AWAY":
                student["tabAwayCount"] += 1
            elif new_status == "WINDOW_UNFOCUSED":
                student["windowBlurCount"] += 1

            if "cameraOn" in status_payload:
                student["cameraOn"] = status_payload["cameraOn"]

            # Broadcast update to teachers
            clean_student = self._serialize_student(student)
            clean_student["reason"] = status_payload.get("reason", "")
            
            await self.broadcast_to_teachers(session_id, {
                "event": "teacher:student_updated",
                "sessionId": session_id,
                "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                "payload": clean_student
            })

    async def update_student_camera(self, session_id: str, student_id: str, camera_on: bool):
        if session_id in self.rooms and student_id in self.rooms[session_id]["students"]:
            student = self.rooms[session_id]["students"][student_id]
            student["cameraOn"] = camera_on
            clean_student = self._serialize_student(student)
            
            await self.broadcast_to_teachers(session_id, {
                "event": "teacher:student_updated",
                "sessionId": session_id,
                "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                "payload": clean_student
            })

    async def nudge_student(self, session_id: str, student_id: str, message: str):
        if session_id in self.rooms and student_id in self.rooms[session_id]["students"]:
            student_ws = self.rooms[session_id]["students"][student_id]["ws"]
            try:
                await student_ws.send_text(json.dumps({
                    "event": "student:nudge",
                    "sessionId": session_id,
                    "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                    "payload": { "message": message }
                }))
            except Exception:
                pass

    def get_roster_snapshot(self, session_id: str) -> dict:
        if session_id not in self.rooms:
            return {
                "activeCount": 0,
                "idleCount": 0,
                "awayCount": 0,
                "cameraOnCount": 0,
                "totalEnrolled": 0,
                "students": []
            }

        students = list(self.rooms[session_id]["students"].values())
        clean_students = []
        active_count = 0
        idle_count = 0
        away_count = 0
        cam_count = 0

        for s in students:
            status = s["currentStatus"]
            if status == "ACTIVE":
                active_count += 1
            elif status == "IDLE":
                idle_count += 1
            elif status in ("TAB_AWAY", "WINDOW_UNFOCUSED"):
                away_count += 1

            if s.get("cameraOn"):
                cam_count += 1

            clean_students.append(self._serialize_student(s))

        return {
            "activeCount": active_count,
            "idleCount": idle_count,
            "awayCount": away_count,
            "cameraOnCount": cam_count,
            "totalEnrolled": len(students),
            "students": clean_students
        }

    async def broadcast_to_teachers(self, session_id: str, message: dict):
        if session_id not in self.rooms:
            return
        dead_connections = []
        payload_str = json.dumps(message)
        for ws in self.rooms[session_id]["teachers"]:
            try:
                await ws.send_text(payload_str)
            except Exception as e:
                logger.error(f"Failed to send to teacher ws: {e}")
                dead_connections.append(ws)

        for dead in dead_connections:
            self.rooms[session_id]["teachers"].remove(dead)

# Global manager instance
ws_manager = WebSocketRoomManager()
