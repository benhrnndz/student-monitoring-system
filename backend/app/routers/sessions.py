import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Dict, Any
from ..database import get_db
from ..models import Session as SessionModel, Classroom, SessionAttendance, User
from ..schemas import SessionCreate, SessionResponse

def format_duration(seconds: int) -> str:
    if seconds is None:
        return "0s"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}h {m}m {s}s"
    elif m > 0:
        return f"{m}m {s}s"
    return f"{s}s"

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


@router.get("/{session_id}/export/csv")
def export_session_csv(session_id: str, db: Session = Depends(get_db)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    classroom = db.query(Classroom).filter(Classroom.id == session_obj.classroom_id).first()
    attendances = db.query(SessionAttendance).filter(SessionAttendance.session_id == session_id).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Session Metadata Header Rows
    writer.writerow(["# SESSION REPORT", session_obj.title])
    writer.writerow(["# Course / Classroom", classroom.name if classroom else "General Classroom"])
    writer.writerow(["# Join Code", classroom.join_code if classroom else "N/A"])
    writer.writerow(["# Session ID", session_obj.id])
    writer.writerow(["# Start Time", session_obj.start_time.isoformat() if session_obj.start_time else "N/A"])
    writer.writerow(["# End Time", session_obj.end_time.isoformat() if session_obj.end_time else "In Progress"])
    writer.writerow(["# Generated At", datetime.now(timezone.utc).isoformat()])
    writer.writerow([])

    # Table Header
    writer.writerow([
        "Student Name",
        "Email",
        "Joined At",
        "Left At",
        "Active Time",
        "Active Seconds",
        "Idle Time",
        "Idle Seconds",
        "Tab Away Time",
        "Tab Away Seconds",
        "Window Away Time",
        "Window Away Seconds",
        "Camera Duration",
        "Camera Seconds",
        "Engagement Score (%)",
        "Extension Verified"
    ])

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

        writer.writerow([
            student.full_name if student else "Unknown",
            student.email if student else "N/A",
            att.first_joined_at.strftime("%Y-%m-%d %H:%M:%S") if att.first_joined_at else "N/A",
            att.last_left_at.strftime("%Y-%m-%d %H:%M:%S") if att.last_left_at else "Still Connected",
            format_duration(att.total_active_seconds),
            att.total_active_seconds,
            format_duration(att.total_idle_seconds),
            att.total_idle_seconds,
            format_duration(att.total_tab_away_seconds),
            att.total_tab_away_seconds,
            format_duration(att.total_window_away_seconds),
            att.total_window_away_seconds,
            format_duration(att.camera_on_seconds),
            att.camera_on_seconds,
            f"{computed_score}%",
            "Yes" if att.extension_verified else "No"
        ])

    csv_bytes = "\ufeff" + output.getvalue()
    safe_title = "".join(c for c in session_obj.title if c.isalnum() or c in ("-", "_")).strip() or "session"
    filename = f"{safe_title}_report_{session_id[:8]}.csv"

    return Response(
        content=csv_bytes.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/{session_id}/export/excel")
def export_session_excel(session_id: str, db: Session = Depends(get_db)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    classroom = db.query(Classroom).filter(Classroom.id == session_obj.classroom_id).first()
    attendances = db.query(SessionAttendance).filter(SessionAttendance.session_id == session_id).all()

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance & Engagement"
    ws.views.sheetView[0].showGridLines = True

    # Styling definitions
    title_font = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
    title_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid") # Dark slate
    
    meta_label_font = Font(name="Calibri", size=10, bold=True, color="475569")
    meta_val_font = Font(name="Calibri", size=10, color="0F172A")
    
    kpi_title_font = Font(name="Calibri", size=9, bold=True, color="64748B")
    kpi_val_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
    kpi_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    tbl_header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    tbl_header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    
    data_font = Font(name="Calibri", size=10, color="1E293B")
    name_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    mono_font = Font(name="Consolas", size=9, color="334155")
    
    thin_border_side = Side(border_style="thin", color="E2E8F0")
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    # High engagement (>=80%): soft emerald
    high_eng_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    high_eng_font = Font(name="Calibri", size=10, bold=True, color="166534")

    # Mid engagement (50-79%): soft amber
    mid_eng_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    mid_eng_font = Font(name="Calibri", size=10, bold=True, color="92400E")

    # Low engagement (<50%): soft rose
    low_eng_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    low_eng_font = Font(name="Calibri", size=10, bold=True, color="991B1B")

    # 1. Header Banner
    ws.merge_cells("A1:K2")
    banner_cell = ws["A1"]
    banner_cell.value = " STUDENT ENGAGEMENT & ATTENDANCE REPORT"
    banner_cell.font = title_font
    banner_cell.fill = title_fill
    banner_cell.alignment = Alignment(vertical="center", horizontal="left")

    # 2. Session Info Block (Rows 4-6)
    ws["A4"] = "Course / Subject:"
    ws["A4"].font = meta_label_font
    ws["B4"] = classroom.name if classroom else "General"
    ws["B4"].font = meta_val_font

    ws["A5"] = "Session Title:"
    ws["A5"].font = meta_label_font
    ws["B5"] = session_obj.title
    ws["B5"].font = meta_val_font

    ws["A6"] = "Session ID:"
    ws["A6"].font = meta_label_font
    ws["B6"] = session_obj.id
    ws["B6"].font = mono_font

    ws["D4"] = "Started At:"
    ws["D4"].font = meta_label_font
    ws["E4"] = session_obj.start_time.strftime("%Y-%m-%d %H:%M:%S") if session_obj.start_time else "N/A"
    ws["E4"].font = meta_val_font

    ws["D5"] = "Ended At:"
    ws["D5"].font = meta_label_font
    ws["E5"] = session_obj.end_time.strftime("%Y-%m-%d %H:%M:%S") if session_obj.end_time else "In Progress"
    ws["E5"].font = meta_val_font

    ws["D6"] = "Generated At:"
    ws["D6"].font = meta_label_font
    ws["E6"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    ws["E6"].font = meta_val_font

    # KPI summary cards
    scores = []
    for att in attendances:
        tt = att.total_active_seconds + att.total_idle_seconds + att.total_tab_away_seconds + att.total_window_away_seconds
        score = ((att.total_active_seconds + 0.2 * att.total_idle_seconds) / tt * 100.0) if tt > 0 else 100.0
        scores.append(score)

    avg_engagement = round(sum(scores) / len(scores), 1) if scores else 100.0

    ws.merge_cells("G4:H4")
    ws["G4"] = "TOTAL STUDENTS"
    ws["G4"].font = kpi_title_font
    ws["G4"].fill = kpi_fill
    ws["G4"].alignment = Alignment(horizontal="center")
    
    ws.merge_cells("G5:H6")
    ws["G5"] = len(attendances)
    ws["G5"].font = kpi_val_font
    ws["G5"].fill = kpi_fill
    ws["G5"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("I4:J4")
    ws["I4"] = "AVG ENGAGEMENT"
    ws["I4"].font = kpi_title_font
    ws["I4"].fill = kpi_fill
    ws["I4"].alignment = Alignment(horizontal="center")

    ws.merge_cells("I5:J6")
    ws["I5"] = f"{avg_engagement}%"
    ws["I5"].font = kpi_val_font
    ws["I5"].fill = kpi_fill
    ws["I5"].alignment = Alignment(horizontal="center", vertical="center")

    # Table Header Row (Row 8)
    headers = [
        "Student Name",
        "Email",
        "Joined At",
        "Left At",
        "Active Time",
        "Idle Time",
        "Tab Away",
        "Window Away",
        "Camera Duration",
        "Engagement Score",
        "Extension Verified"
    ]
    
    header_row_idx = 8
    ws.row_dimensions[header_row_idx].height = 25
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=header_row_idx, column=col_idx, value=h)
        cell.font = tbl_header_font
        cell.fill = tbl_header_fill
        cell.alignment = Alignment(horizontal="center" if col_idx > 2 else "left", vertical="center")
        cell.border = thin_border

    # Data Rows
    current_row = header_row_idx + 1
    for i, att in enumerate(attendances):
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

        row_fill = zebra_fill if (i % 2 == 1) else white_fill
        ws.row_dimensions[current_row].height = 20

        # Cells
        c1 = ws.cell(row=current_row, column=1, value=student.full_name if student else "Unknown")
        c1.font = name_font
        c1.fill = row_fill
        c1.border = thin_border

        c2 = ws.cell(row=current_row, column=2, value=student.email if student else "N/A")
        c2.font = data_font
        c2.fill = row_fill
        c2.border = thin_border

        c3 = ws.cell(row=current_row, column=3, value=att.first_joined_at.strftime("%H:%M:%S") if att.first_joined_at else "N/A")
        c3.font = mono_font
        c3.alignment = Alignment(horizontal="center")
        c3.fill = row_fill
        c3.border = thin_border

        c4 = ws.cell(row=current_row, column=4, value=att.last_left_at.strftime("%H:%M:%S") if att.last_left_at else "Connected")
        c4.font = mono_font
        c4.alignment = Alignment(horizontal="center")
        c4.fill = row_fill
        c4.border = thin_border

        c5 = ws.cell(row=current_row, column=5, value=format_duration(att.total_active_seconds))
        c5.font = mono_font
        c5.alignment = Alignment(horizontal="center")
        c5.fill = row_fill
        c5.border = thin_border

        c6 = ws.cell(row=current_row, column=6, value=format_duration(att.total_idle_seconds))
        c6.font = mono_font
        c6.alignment = Alignment(horizontal="center")
        c6.fill = row_fill
        c6.border = thin_border

        c7 = ws.cell(row=current_row, column=7, value=format_duration(att.total_tab_away_seconds))
        c7.font = mono_font
        c7.alignment = Alignment(horizontal="center")
        c7.fill = row_fill
        c7.border = thin_border

        c8 = ws.cell(row=current_row, column=8, value=format_duration(att.total_window_away_seconds))
        c8.font = mono_font
        c8.alignment = Alignment(horizontal="center")
        c8.fill = row_fill
        c8.border = thin_border

        c9 = ws.cell(row=current_row, column=9, value=format_duration(att.camera_on_seconds))
        c9.font = mono_font
        c9.alignment = Alignment(horizontal="center")
        c9.fill = row_fill
        c9.border = thin_border

        # Engagement score cell with badge styling
        c10 = ws.cell(row=current_row, column=10, value=f"{computed_score}%")
        c10.alignment = Alignment(horizontal="center")
        c10.border = thin_border
        if computed_score >= 80:
            c10.fill = high_eng_fill
            c10.font = high_eng_font
        elif computed_score >= 50:
            c10.fill = mid_eng_fill
            c10.font = mid_eng_font
        else:
            c10.fill = low_eng_fill
            c10.font = low_eng_font

        c11 = ws.cell(row=current_row, column=11, value="Verified" if att.extension_verified else "Unverified")
        c11.font = data_font
        c11.alignment = Alignment(horizontal="center")
        c11.fill = row_fill
        c11.border = thin_border

        current_row += 1

    # Freeze pane below header
    ws.freeze_panes = "A9"

    # Auto-adjust column widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            # Skip merged banner row in width calculation
            if cell.row in (1, 2):
                continue
            if cell.value:
                val_str = str(cell.value)
                max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = max(max_len + 4, 13)

    excel_stream = io.BytesIO()
    wb.save(excel_stream)
    excel_stream.seek(0)

    safe_title = "".join(c for c in session_obj.title if c.isalnum() or c in ("-", "_")).strip() or "session"
    filename = f"{safe_title}_report_{session_id[:8]}.xlsx"

    return Response(
        content=excel_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

