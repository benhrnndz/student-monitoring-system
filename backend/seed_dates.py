import sqlite3
import uuid
import os

for db_path in ['backend/learning_monitor.db', 'learning_monitor.db']:
    if not os.path.exists(db_path):
        continue
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Get classroom and teacher
    cur.execute("SELECT id, teacher_id FROM classrooms LIMIT 1")
    cls_row = cur.fetchone()
    if not cls_row:
        conn.close()
        continue
    classroom_id, teacher_id = cls_row

    # Get student users
    cur.execute("SELECT id, full_name, email FROM users WHERE role = 'student' AND full_name != ''")
    students = cur.fetchall()
    if len(students) < 5:
        conn.close()
        continue

    # Clean existing sessions and attendances to start crystal clean
    cur.execute("DELETE FROM telemetry_events")
    cur.execute("DELETE FROM session_attendances")
    cur.execute("DELETE FROM sessions")

    # Create sessions across distinct dates
    session_configs = [
        {
            "id": "session-2026-10-08-lecture-5",
            "title": "Lecture 5: Advanced Graph Algorithms & Tree Traversal",
            "status": "completed",
            "start_time": "2026-10-08 09:00:00",
            "end_time": "2026-10-08 09:48:15",
            "created_at": "2026-10-08 08:59:00",
            "student_count": 16,
        },
        {
            "id": "session-2026-10-07-lecture-4",
            "title": "Lecture 4: Google Meet Telemetry & Roster Sync",
            "status": "completed",
            "start_time": "2026-10-07 09:00:00",
            "end_time": "2026-10-07 09:51:30",
            "created_at": "2026-10-07 08:58:00",
            "student_count": 18,
        },
        {
            "id": "session-2026-10-06-lecture-3",
            "title": "Lecture 3: Asynchronous State & Real-Time Sync",
            "status": "completed",
            "start_time": "2026-10-06 10:00:00",
            "end_time": "2026-10-06 10:45:10",
            "created_at": "2026-10-06 09:58:00",
            "student_count": 15,
        },
        {
            "id": "session-2026-10-05-lecture-2",
            "title": "Lecture 2: Privacy-Preserving Classroom Observability",
            "status": "completed",
            "start_time": "2026-10-05 09:00:00",
            "end_time": "2026-10-05 09:42:00",
            "created_at": "2026-10-05 08:59:00",
            "student_count": 17,
        }
    ]

    for s in session_configs:
        cur.execute("""
            INSERT INTO sessions (id, classroom_id, title, status, start_time, end_time, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (s["id"], classroom_id, s["title"], s["status"], s["start_time"], s["end_time"], s["created_at"]))

        sel_students = students[:s["student_count"]]
        for i, st in enumerate(sel_students):
            att_id = str(uuid.uuid4())
            active_sec = max(900, 2400 - (i * 90))
            idle_sec = 60 + (i * 25)
            tab_sec = (i % 4) * 45
            win_sec = (i % 3) * 30
            cam_sec = 2100 if i % 2 == 0 else 0
            total_t = active_sec + idle_sec + tab_sec + win_sec
            score = round(((active_sec + 0.2 * idle_sec) / total_t) * 100, 1)

            cur.execute("""
                INSERT INTO session_attendances (
                    id, session_id, student_id, first_joined_at, last_left_at,
                    total_active_seconds, total_idle_seconds, total_tab_away_seconds,
                    total_window_away_seconds, camera_on_seconds, engagement_score, extension_verified
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                att_id, s["id"], st[0], s["start_time"], s["end_time"],
                active_sec, idle_sec, tab_sec, win_sec, cam_sec, score, 1 if i % 2 == 0 else 0
            ))

    conn.commit()
    conn.close()
    print(f"Successfully seeded {len(session_configs)} dated sessions into {db_path}!")

