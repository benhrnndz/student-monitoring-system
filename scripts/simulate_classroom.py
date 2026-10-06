"""
Classroom Telemetry Simulator
Spawns realistic virtual student bots connected to the live session via WebSockets.
"""

import asyncio
import json
import random
import sys
import urllib.request
import urllib.parse
import signal
from typing import List, Dict

import functools
# Ensure all output flushes immediately to console
print = functools.partial(print, flush=True)

# Ensure Windows terminal handles UTF-8 emojis cleanly
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

API_BASE = "http://localhost:8000/api"
WS_BASE = "ws://localhost:8000/ws/session"

# Roster of realistic student personas
STUDENT_ROSTER = [
    {"name": "Liam Smith", "persona": "attentive"},
    {"name": "Emma Johnson", "persona": "attentive"},
    {"name": "Noah Williams", "persona": "multitasker"},
    {"name": "Olivia Brown", "persona": "attentive"},
    {"name": "Sophia Davis", "persona": "idle"},
    {"name": "Lucas Miller", "persona": "multitasker"},
    {"name": "Mia Wilson", "persona": "attentive"},
    {"name": "Ethan Moore", "persona": "distracted"},
    {"name": "Ava Taylor", "persona": "attentive"},
    {"name": "Jackson Anderson", "persona": "attentive"},
    {"name": "Isabella Thomas", "persona": "multitasker"},
    {"name": "Aiden Jackson", "persona": "idle"},
    {"name": "Harper White", "persona": "attentive"},
    {"name": "Elijah Harris", "persona": "attentive"},
    {"name": "Charlotte Martin", "persona": "multitasker"},
    {"name": "James Robinson", "persona": "attentive"},
    {"name": "Amelia Clark", "persona": "distracted"},
    {"name": "Benjamin Rodriguez", "persona": "attentive"},
]

class VirtualStudent:
    def __init__(self, student_id: str, name: str, persona: str, session_id: str):
        self.student_id = student_id
        self.name = name
        self.persona = persona
        self.session_id = session_id
        self.current_status = "ACTIVE"
        self.camera_on = random.choice([True, True, False]) # 66% chance camera is on
        self.ws = None
        self.running = True

    async def run(self):
        import websockets
        ws_url = (
            f"{WS_BASE}/{self.session_id}?role=student"
            f"&user_id={self.student_id}&user_name={urllib.parse.quote(self.name)}"
        )

        try:
            async with websockets.connect(ws_url) as ws:
                self.ws = ws
                print(f"  [+] {self.name:<18} ({self.persona}) joined class (📹 Cam: {'ON' if self.camera_on else 'OFF'})")

                # Send initial heartbeat
                await self.send_heartbeat()

                # Start concurrent listen & behavior tasks
                listen_task = asyncio.create_task(self.listen_messages())
                behavior_task = asyncio.create_task(self.behavior_loop())

                await asyncio.gather(listen_task, behavior_task)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"  [!] {self.name} connection error: {e}")

    async def listen_messages(self):
        try:
            while self.running and self.ws:
                msg_text = await self.ws.recv()
                data = json.loads(msg_text)
                if data.get("event") == "student:nudge":
                    print(f"\n  🔔 [NUDGE] {self.name} received a focus ping from the teacher! Acknowledging and focusing...")
                    # Automatically acknowledge nudge and restore to ACTIVE
                    await asyncio.sleep(random.uniform(1.0, 2.5))
                    await self.change_status("ACTIVE", "Teacher ping acknowledged")
        except Exception:
            pass

    async def behavior_loop(self):
        while self.running:
            # Sleep a variable amount of seconds between behavior ticks
            sleep_duration = random.uniform(8.0, 18.0)
            await asyncio.sleep(sleep_duration)

            if not self.running:
                break

            # Send heartbeat keepalive
            await self.send_heartbeat()

            # Execute persona-specific state changes
            if self.persona == "attentive":
                # Attentive students stay ACTIVE, occasionally toggle camera
                if self.current_status != "ACTIVE":
                    await self.change_status("ACTIVE", "Resumed notes")
                elif random.random() < 0.15:
                    await self.toggle_camera()

            elif self.persona == "multitasker":
                # Multitaskers switch tabs periodically
                if self.current_status == "ACTIVE":
                    if random.random() < 0.45:
                        await self.change_status("TAB_AWAY", "Switched to browser tab > 5s")
                else:
                    # Return to class after being away
                    await self.change_status("ACTIVE", "Returned to classroom tab")

            elif self.persona == "idle":
                # Idle students stop typing/moving mouse
                if self.current_status == "ACTIVE":
                    if random.random() < 0.50:
                        await self.change_status("IDLE", "No mouse/keyboard input for 5 mins")
                else:
                    await self.change_status("ACTIVE", "Mouse movement detected")

            elif self.persona == "distracted":
                # Distracted students click other apps (window blur)
                if self.current_status == "ACTIVE":
                    if random.random() < 0.55:
                        await self.change_status("WINDOW_UNFOCUSED", "Clicked outside to other app > 10s")
                else:
                    await self.change_status("ACTIVE", "Refocused class window")

    async def change_status(self, new_status: str, reason: str):
        if self.current_status == new_status or not self.ws:
            return
        
        prev = self.current_status
        self.current_status = new_status
        icon = "🟢" if new_status == "ACTIVE" else "🟡" if new_status == "IDLE" else "🟠" if new_status == "TAB_AWAY" else "🔴"
        print(f"  {icon} {self.name:<18} ➔ {new_status:<16} ({reason})")

        payload = {
            "event": "telemetry:status_change",
            "sessionId": self.session_id,
            "timestamp": int(asyncio.get_event_loop().time() * 1000),
            "payload": {
                "studentId": self.student_id,
                "previousStatus": prev,
                "newStatus": new_status,
                "reason": reason,
                "gracePeriodSeconds": 5 if new_status == "TAB_AWAY" else 10 if new_status == "WINDOW_UNFOCUSED" else 0,
                "cameraOn": self.camera_on,
            },
        }
        try:
            await self.ws.send(json.dumps(payload))
        except Exception:
            pass

    async def toggle_camera(self):
        if not self.ws:
            return
        self.camera_on = not self.camera_on
        status_str = "ON 📹" if self.camera_on else "OFF 🚫"
        print(f"  📷 {self.name:<18} toggled camera to {status_str}")

        payload = {
            "event": "telemetry:camera_toggle",
            "sessionId": self.session_id,
            "timestamp": int(asyncio.get_event_loop().time() * 1000),
            "payload": {
                "studentId": self.student_id,
                "cameraOn": self.camera_on,
            },
        }
        try:
            await self.ws.send(json.dumps(payload))
        except Exception:
            pass

    async def send_heartbeat(self):
        if not self.ws:
            return
        payload = {
            "event": "telemetry:heartbeat",
            "sessionId": self.session_id,
            "timestamp": int(asyncio.get_event_loop().time() * 1000),
            "payload": {
                "studentId": self.student_id,
                "status": self.current_status,
                "cameraOn": self.camera_on,
                "extensionActive": True,
            },
        }
        try:
            await self.ws.send(json.dumps(payload))
        except Exception:
            pass

def fetch_active_session_id() -> str:
    try:
        req = urllib.request.Request(f"{API_BASE}/sessions/active", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read().decode())
            return data.get("id", "live-demo-session")
    except Exception as e:
        print(f"[!] Could not query /api/sessions/active ({e}). Defaulting to 'live-demo-session'.")
        return "live-demo-session"

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Multi-Student Classroom Simulator")
    parser.add_argument("--count", type=int, default=15, help="Number of students to simulate (default: 15, max: 18)")
    parser.add_argument("--session", type=str, default=None, help="Explicit session ID to connect to")
    args = parser.parse_args()

    session_id = args.session or fetch_active_session_id()
    student_count = min(max(1, args.count), len(STUDENT_ROSTER))

    print("=================================================================")
    print("  🎓 STUDENT LEARNING MONITORING SYSTEM — CLASSROOM SIMULATOR   ")
    print("=================================================================")
    print(f"  Target Session: {session_id}")
    print(f"  Simulating:     {student_count} Students with Diverse Focus Personas")
    print(f"  Teacher UI:     http://localhost:3000/teacher")
    print("-----------------------------------------------------------------")
    print("  Press Ctrl + C at any time to disconnect all students cleanly.")
    print("=================================================================\n")

    students: List[VirtualStudent] = []
    tasks = []

    for i in range(student_count):
        entry = STUDENT_ROSTER[i]
        student_id = f"sim-student-{i+1}"
        s = VirtualStudent(student_id, entry["name"], entry["persona"], session_id)
        students.append(s)
        tasks.append(asyncio.create_task(s.run()))
        # Stagger join times slightly for realistic entry
        await asyncio.sleep(random.uniform(0.15, 0.4))

    try:
        await asyncio.gather(*tasks)
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\n\n[Shutting Down] Disconnecting all virtual students...")
        for s in students:
            s.running = False
        print("[Done] All students disconnected cleanly.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.")
