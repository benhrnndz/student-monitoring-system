from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student" # "student" or "teacher"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# --- Classroom Schemas ---
class ClassroomCreate(BaseModel):
    name: str
    subject: Optional[str] = None

class ClassroomJoin(BaseModel):
    join_code: str

class ClassroomResponse(BaseModel):
    id: str
    name: str
    subject: Optional[str]
    join_code: str
    teacher_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Session Schemas ---
class SessionCreate(BaseModel):
    classroom_id: str
    title: str

class SessionResponse(BaseModel):
    id: str
    classroom_id: str
    title: str
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

# --- WebSocket Message Schemas ---
class WSMessage(BaseModel):
    event: str
    sessionId: str
    timestamp: int
    payload: Dict[str, Any]

