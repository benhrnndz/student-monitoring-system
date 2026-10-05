import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from ..websocket_manager import ws_manager
from ..database import SessionLocal
from ..models import SessionAttendance, TelemetryEvent, Session as SessionModel, User, Classroom

router = APIRouter(tags=["websocket"])
logger = logging.getLogger("websocket")

@router.websocket("/ws/session/{session_id}")
async def session_websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    role: str = Query(default="student"),
    user_id: str = Query(default="anonymous"),
    user_name: str = Query(default="Student")
):
    db = SessionLocal()
    attendance_record = None

    try:
        if role == "teacher":
            await ws_manager.connect_teacher(session_id, websocket)
            logger.info(f"Teacher connected to session {session_id}")
            while True:
                data_text = await websocket.receive_text()
                try:
                    msg = json.loads(data_text)
                    event = msg.get("event")
                    payload = msg.get("payload", {})

                    if event == "teacher:nudge":
                        target_student_id = payload.get("studentId")
                        message = payload.get("message", "Your instructor is checking on your engagement.")
                        await ws_manager.nudge_student(session_id, target_student_id, message)
                except Exception as e:
                    logger.error(f"Error handling teacher message: {e}")
        else:
            # Student Connection
            # 1. First, connect to in-memory real-time manager so presence is INSTANT
            await ws_manager.connect_student(
                session_id=session_id,
                student_id=user_id,
                student_info={"name": user_name},
                websocket=websocket
            )
            logger.info(f"Student {user_name} ({user_id}) joined session {session_id}")

            # 2. Safely ensure session & user exist in DB so FK constraints succeed
            try:
                session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
                if not session_obj:
                    # Get or create default classroom
                    classroom = db.query(Classroom).first()
                    if not classroom:
                        classroom = Classroom(
                            id="cs101-classroom-uuid",
                            name="Computer Science 101 - Algorithms",
                            subject="Computer Science",
                            join_code="CS101A",
                            teacher_id="teacher-jenkins-uuid"
                        )
                        db.add(classroom)
                        db.commit()

                    session_obj = SessionModel(
                        id=session_id,
                        classroom_id=classroom.id,
                        title="Live Lecture Session",
                        status="live"
                    )
                    db.add(session_obj)
                    db.commit()

                user_obj = db.query(User).filter(User.id == user_id).first()
                if not user_obj:
                    user_obj = User(
                        id=user_id,
                        email=f"{user_id}@demo.com",
                        password_hash="demo",
                        full_name=user_name,
                        role="student"
                    )
                    db.add(user_obj)
                    db.commit()

                attendance_record = db.query(SessionAttendance).filter(
                    SessionAttendance.session_id == session_id,
                    SessionAttendance.student_id == user_id
                ).first()

                if not attendance_record:
                    attendance_record = SessionAttendance(
                        session_id=session_id,
                        student_id=user_id,
                        first_joined_at=datetime.now(timezone.utc)
                    )
                    db.add(attendance_record)
                    db.commit()
                    db.refresh(attendance_record)
            except Exception as db_err:
                logger.error(f"DB attendance setup error (continuing in real-time mode): {db_err}")
                db.rollback()

            # 3. Message loop
            while True:
                data_text = await websocket.receive_text()
                try:
                    msg = json.loads(data_text)
                    event = msg.get("event")
                    payload = msg.get("payload", {})

                    if event == "telemetry:status_change":
                        await ws_manager.update_student_status(session_id, user_id, payload)
                        
                        # Persist event in DB safely
                        try:
                            new_status = payload.get("newStatus")
                            if attendance_record and new_status:
                                evt = TelemetryEvent(
                                    attendance_id=attendance_record.id,
                                    event_type=new_status,
                                    duration_seconds=payload.get("gracePeriodSeconds", 0),
                                    metadata_json=json.dumps(payload)
                                )
                                db.add(evt)
                                
                                if new_status == "TAB_AWAY":
                                    attendance_record.total_tab_away_seconds += 5
                                elif new_status == "WINDOW_UNFOCUSED":
                                    attendance_record.total_window_away_seconds += 10
                                elif new_status == "IDLE":
                                    attendance_record.total_idle_seconds += 300

                                db.commit()
                        except Exception as log_err:
                            logger.error(f"Failed to persist event log: {log_err}")
                            db.rollback()

                    elif event == "telemetry:camera_toggle":
                        camera_on = payload.get("cameraOn", False)
                        await ws_manager.update_student_camera(session_id, user_id, camera_on)
                        try:
                            if attendance_record and camera_on:
                                attendance_record.camera_on_seconds += 15
                                db.commit()
                        except Exception:
                            db.rollback()

                    elif event == "telemetry:heartbeat":
                        pass
                except Exception as loop_err:
                    logger.error(f"Error handling student message: {loop_err}")

    except WebSocketDisconnect:
        if role == "teacher":
            ws_manager.disconnect_teacher(session_id, websocket)
            logger.info(f"Teacher disconnected from session {session_id}")
        else:
            await ws_manager.disconnect_student(session_id, user_id)
            if attendance_record:
                try:
                    attendance_record.last_left_at = datetime.now(timezone.utc)
                    db.commit()
                except Exception:
                    db.rollback()
            logger.info(f"Student {user_name} disconnected from session {session_id}")
    finally:
        db.close()
