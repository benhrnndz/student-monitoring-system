from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import CORS_ORIGINS
from .database import engine, Base, SessionLocal
from .models import User, Classroom, ClassroomEnrollment, Session as SessionModel
from .auth_utils import hash_password
from .routers import auth, classrooms, sessions, ws

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Student Learning Monitoring System API",
    version="1.0.0",
    description="Real-time telemetry and monitoring backend for online classrooms"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API & WebSocket Routers
app.include_router(auth.router)
app.include_router(classrooms.router)
app.include_router(sessions.router)
app.include_router(ws.router)

@app.on_event("startup")
def seed_demo_data():
    """Populates demo teacher, students, classroom, and live session if not present."""
    db = SessionLocal()
    try:
        teacher = db.query(User).filter(User.email == "teacher@demo.com").first()
        if not teacher:
            teacher = User(
                email="teacher@demo.com",
                password_hash=hash_password("teacher123"),
                full_name="Prof. Sarah Jenkins",
                role="teacher"
            )
            db.add(teacher)
            db.commit()
            db.refresh(teacher)

            # Sample Students
            student1 = User(
                email="alex@demo.com",
                password_hash=hash_password("student123"),
                full_name="Alex Chen",
                role="student"
            )
            student2 = User(
                email="beatrice@demo.com",
                password_hash=hash_password("student123"),
                full_name="Beatrice Davis",
                role="student"
            )
            db.add_all([student1, student2])
            db.commit()
            db.refresh(student1)
            db.refresh(student2)

            # Sample Classroom
            classroom = Classroom(
                name="Computer Science 101 - Algorithms",
                subject="Computer Science",
                join_code="CS101A",
                teacher_id=teacher.id
            )
            db.add(classroom)
            db.commit()
            db.refresh(classroom)

            # Enroll students
            e1 = ClassroomEnrollment(classroom_id=classroom.id, student_id=student1.id)
            e2 = ClassroomEnrollment(classroom_id=classroom.id, student_id=student2.id)
            db.add_all([e1, e2])

            # Sample Live Session
            live_session = SessionModel(
                classroom_id=classroom.id,
                title="Lecture 4: Data Structures & Real-Time Telemetry",
                status="live"
            )
            db.add(live_session)
            db.commit()
            print(">>> Demo data seeded successfully! Join Code: CS101A")
    finally:
        db.close()

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Student Learning Monitoring System API",
        "docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

