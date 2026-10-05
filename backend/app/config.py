import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./learning_monitor.db")
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-learning-monitoring-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "*"
]

