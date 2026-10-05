import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(20), default="student", nullable=False) # "teacher", "student", "admin"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    taught_classrooms = relationship("Classroom", back_populates="teacher")
    enrollments = relationship("ClassroomEnrollment", back_populates="student")
    attendances = relationship("SessionAttendance", back_populates="student")


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(200), nullable=False)
    subject = Column(String(150), nullable=True)
    join_code = Column(String(12), unique=True, index=True, nullable=False)
    teacher_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    teacher = relationship("User", back_populates="taught_classrooms")
    enrollments = relationship("ClassroomEnrollment", back_populates="classroom", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="classroom", cascade="all, delete-orphan")


class ClassroomEnrollment(Base):
    __tablename__ = "classroom_enrollments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    classroom_id = Column(String(36), ForeignKey("classrooms.id"), nullable=False)
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    enrolled_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    classroom = relationship("Classroom", back_populates="enrollments")
    student = relationship("User", back_populates="enrollments")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    classroom_id = Column(String(36), ForeignKey("classrooms.id"), nullable=False)
    title = Column(String(200), nullable=False)
    status = Column(String(20), default="scheduled", nullable=False) # "scheduled", "live", "completed"
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    end_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    classroom = relationship("Classroom", back_populates="sessions")
    attendances = relationship("SessionAttendance", back_populates="session", cascade="all, delete-orphan")


class SessionAttendance(Base):
    __tablename__ = "session_attendances"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    first_joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_left_at = Column(DateTime, nullable=True)
    
    # Telemetry aggregate counters
    total_active_seconds = Column(Integer, default=0)
    total_idle_seconds = Column(Integer, default=0)
    total_tab_away_seconds = Column(Integer, default=0)
    total_window_away_seconds = Column(Integer, default=0)
    camera_on_seconds = Column(Integer, default=0)
    engagement_score = Column(Float, default=100.0)
    extension_verified = Column(Boolean, default=False)

    session = relationship("Session", back_populates="attendances")
    student = relationship("User", back_populates="attendances")
    events = relationship("TelemetryEvent", back_populates="attendance", cascade="all, delete-orphan")


class TelemetryEvent(Base):
    __tablename__ = "telemetry_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    attendance_id = Column(String(36), ForeignKey("session_attendances.id"), nullable=False)
    event_type = Column(String(50), nullable=False) # "IDLE", "TAB_HIDDEN", "WINDOW_BLURRED", "CAMERA_TOGGLE"
    duration_seconds = Column(Integer, default=0)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    attendance = relationship("SessionAttendance", back_populates="events")

