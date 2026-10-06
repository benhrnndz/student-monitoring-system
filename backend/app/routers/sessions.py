from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Dict, Any
from ..database import get_db
from ..models import Session as SessionModel, Classroom, SessionAttendance, User
from ..schemas import SessionCreate, SessionResponse

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.post("/", response_model=SessionResponse)
def create_session(session_in: SessionCreate, db: Session = Depends(get_db)):
    classroom = db.query(Classroom).filter(Classroom.id == session_in.classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    new_session = SessionModel(
        classroom_id=session_in.classroom_id,
        title=session_in.title,
        status="live" # Start as live immediately for ease of testing
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/classroom/{classroom_id}", response_model=List[SessionResponse])
def get_classroom_sessions(classroom_id: str, db: Session = Depends(get_db)):
    return db.query(SessionModel).filter(SessionModel.classroom_id == classroom_id).order_by(SessionModel.created_at.desc()).all()

@router.get("/active")
def get_active_session(db: Session = Depends(get_db)):
    """Returns the current live session or creates an active demo session."""
    session_obj = db.query(SessionModel).filter(SessionModel.status == "live").first()
    if not session_obj:
        session_obj = db.query(SessionModel).first()

    # If still no session exists in DB, create one on the fly
    if not session_obj:
        teacher = db.query(User).filter(User.role == "teacher").first()
        if not teacher:
            teacher = User(
                id="teacher-jenkins-uuid",
                email="teacher@demo.com",
                password_hash="demo",
                full_name="Prof. Sarah Jenkins",
                role="teacher"
            )
            db.add(teacher)
            db.commit()

        classroom = db.query(Classroom).first()
        if not classroom:
            classroom = Classroom(
                id="cs101-classroom-uuid",
                name="Computer Science 101 - Algorithms",
                subject="Computer Science",
                join_code="CS101A",
                teacher_id=teacher.id
            )
            db.add(classroom)
            db.commit()

        session_obj = SessionModel(
            id="live-demo-session",
            classroom_id=classroom.id,
            title="Lecture: Real-Time Telemetry & Data Structures",
            status="live"
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

    classroom = db.query(Classroom).filter(Classroom.id == session_obj.classroom_id).first()
    return {
        "id": session_obj.id,
        "title": session_obj.title,
        "status": session_obj.status,
        "classroom_id": session_obj.classroom_id,
        "classroom_name": classroom.name if classroom else "Classroom",
        "join_code": classroom.join_code if classroom else "CS101A",
        "start_time": session_obj.start_time
    }


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_obj

@router.post("/{session_id}/end")
def end_session(session_id: str, db: Session = Depends(get_db)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    session_obj.status = "completed"
    session_obj.end_time = datetime.now(timezone.utc)
    db.commit()
    return {"status": "completed", "session_id": session_id}

@router.get("/{session_id}/report")
def get_session_report(session_id: str, db: Session = Depends(get_db)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    attendances = db.query(SessionAttendance).filter(SessionAttendance.session_id == session_id).all()
    results = []
    for att in attendances:
        student = db.query(User).filter(User.id == att.student_id).first()
        total_time = (
            att.total_active_seconds +
            att.total_idle_seconds +
            att.total_tab_away_seconds +
            att.total_window_away_seconds
        )
        if total_time > 0:
            computed_score = round(
                ((att.total_active_seconds + 0.2 * att.total_idle_seconds) / total_time) * 100.0,
                1
            )
            computed_score = max(0.0, min(100.0, computed_score))
        else:
            computed_score = 100.0

        results.append({
            "studentId": att.student_id,
            "studentName": student.full_name if student else "Unknown",
            "firstJoinedAt": att.first_joined_at,
            "lastLeftAt": att.last_left_at,
            "totalActiveSeconds": att.total_active_seconds,
            "totalIdleSeconds": att.total_idle_seconds,
            "totalTabAwaySeconds": att.total_tab_away_seconds,
            "totalWindowAwaySeconds": att.total_window_away_seconds,
            "cameraOnSeconds": att.camera_on_seconds,
            "engagementScore": computed_score,
            "extensionVerified": att.extension_verified
        })

    return {
        "sessionId": session_id,
        "title": session_obj.title,
        "status": session_obj.status,
        "startTime": session_obj.start_time,
        "endTime": session_obj.end_time,
        "totalStudents": len(results),
        "attendances": results
    }

