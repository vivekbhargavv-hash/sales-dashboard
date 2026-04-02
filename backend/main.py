"""
Moeving Sales Dashboard — FastAPI Backend
Production-ready: JWT auth, SQLite/PostgreSQL persistence, file size limits.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json, os
from datetime import datetime
from dotenv import load_dotenv

from data_processor import process_csvs
from auth import verify_password, get_password_hash, create_access_token, decode_token
from database import get_db, init_db, User, UserDashboard

load_dotenv()

app = FastAPI(title="Moeving Sales Dashboard API", version="2.0.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "")
allowed_origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_BYTES = int(os.getenv("MAX_FILE_MB", "20")) * 1024 * 1024

@app.on_event("startup")
async def startup_event():
    init_db()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    email = decode_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

def _user_response(user: User, token: str) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email},
    }

@app.post("/signup", tags=["auth"])
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    req.email = req.email.lower().strip()
    req.name = req.name.strip()
    if not req.name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Valid email is required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    user = User(name=req.name, email=req.email, hashed_password=get_password_hash(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_response(user, create_access_token({"sub": user.email}))

@app.post("/login", tags=["auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    req.email = req.email.lower().strip()
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return _user_response(user, create_access_token({"sub": user.email}))

@app.get("/me", tags=["auth"])
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email}

@app.post("/api/upload", tags=["dashboard"])
async def upload_files(
    deals: UploadFile = File(...),
    projects: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for f in [deals, projects]:
        if f.filename and not f.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail=f"'{f.filename}' is not a CSV file.")

    deals_bytes = await deals.read()
    if len(deals_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"Deals file exceeds {os.getenv('MAX_FILE_MB','20')} MB limit.")
    projects_bytes = await projects.read()
    if len(projects_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"Projects file exceeds {os.getenv('MAX_FILE_MB','20')} MB limit.")
    if len(deals_bytes) == 0 or len(projects_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded files must not be empty.")

    try:
        result = process_csvs(deals_bytes, projects_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Processing error: {str(e)}")

    now = datetime.utcnow()
    serialized = json.dumps(result, default=str)
    existing = db.query(UserDashboard).filter(UserDashboard.user_id == current_user.id).first()
    if existing:
        existing.dashboard_json = serialized
        existing.uploaded_at = now
    else:
        db.add(UserDashboard(user_id=current_user.id, dashboard_json=serialized, uploaded_at=now))
    db.commit()

    result["uploaded_at"] = now.isoformat() + "Z"
    result["user"] = {"name": current_user.name, "email": current_user.email}
    return result

@app.get("/api/dashboard", tags=["dashboard"])
def get_last_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(UserDashboard).filter(UserDashboard.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="No saved data found. Please upload your CSV files.")
    result = json.loads(record.dashboard_json)
    result["uploaded_at"] = record.uploaded_at.isoformat() + "Z"
    result["user"] = {"name": current_user.name, "email": current_user.email}
    return result

@app.delete("/api/dashboard", tags=["dashboard"])
def clear_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(UserDashboard).filter(UserDashboard.user_id == current_user.id).first()
    if record:
        db.delete(record)
        db.commit()
    return {"message": "Dashboard data cleared."}

@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "version": "2.0.0"}
