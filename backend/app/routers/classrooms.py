import random
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Classroom, ClassroomEnrollment, User
from ..schemas import ClassroomCreate, ClassroomJoin, ClassroomResponse

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])

def generate_join_code(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

@router.post("/", response_model=ClassroomResponse)
def create_classroom(classroom_in: ClassroomCreate, teacher_id: str, db: Session = Depends(get_db)):
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    code = generate_join_code()
    while db.query(Classroom).filter(Classroom.join_code == code).first():
        code = generate_join_code()

    classroom = Classroom(
        name=classroom_in.name,
        subject=classroom_in.subject,
        join_code=code,
        teacher_id=teacher_id
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom

@router.get("/", response_model=List[ClassroomResponse])
def get_classrooms(user_id: str, role: str = "student", db: Session = Depends(get_db)):
    if role == "teacher":
        return db.query(Classroom).filter(Classroom.teacher_id == user_id).all()
    else:
        # Enrolled classrooms for student
        enrollments = db.query(ClassroomEnrollment).filter(ClassroomEnrollment.student_id == user_id).all()
        classroom_ids = [e.classroom_id for e in enrollments]
        return db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()

@router.post("/join", response_model=ClassroomResponse)
def join_classroom(join_in: ClassroomJoin, student_id: str, db: Session = Depends(get_db)):
    classroom = db.query(Classroom).filter(Classroom.join_code == join_in.join_code.upper().strip()).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid classroom join code")

    existing = db.query(ClassroomEnrollment).filter(
        ClassroomEnrollment.classroom_id == classroom.id,
        ClassroomEnrollment.student_id == student_id
    ).first()

    if not existing:
        enrollment = ClassroomEnrollment(
            classroom_id=classroom.id,
            student_id=student_id
        )
        db.add(enrollment)
        db.commit()

    return classroom

