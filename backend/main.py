"""
Moeving Sales Dashboard — FastAPI Backend
Production-ready: JWT auth, SQLite/PostgreSQL persistence, file size limits,
password reset via Resend email.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json, os, secrets
from datetime import datetime, timedelta
from dotenv import load_dotenv

from data_processor import process_csvs
from auth import verify_password, get_password_hash, create_access_token, decode_token
from database import get_db, init_db, User, UserDashboard, PasswordResetToken, MonthlyTarget

load_dotenv()

app = FastAPI(title="Moeving Sales Dashboard API", version="2.1.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM    = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
RESET_EXPIRY_MINUTES = 30
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "vivek@moeving.com").lower().strip()

allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
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


# ── Auth helpers ───────────────────────────────────────────────────────────────

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


def is_admin(user: User) -> bool:
    return (user.email or "").lower().strip() == ADMIN_EMAIL


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


def _user_response(user: User, token: str) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id":       user.id,
            "name":     user.name,
            "email":    user.email,
            "is_admin": is_admin(user),
        },
    }


def _send_reset_email(to_email: str, name: str, reset_url: str):
    """Send password-reset email via Resend. Falls back to console log if no API key."""
    if not RESEND_API_KEY:
        # Local dev: print the link so you can test without an email provider
        print(f"\n{'='*60}")
        print(f"[DEV] Password reset link for {to_email}:")
        print(f"  {reset_url}")
        print(f"{'='*60}\n")
        return

    try:
        import resend
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": RESEND_FROM,
            "to": to_email,
            "subject": "Reset your Moeving password",
            "html": f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f4f4f5;margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;
              padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="background:#16a34a;display:inline-block;padding:10px 24px;
                  border-radius:8px;color:#fff;font-weight:700;font-size:18px;
                  letter-spacing:1px;">MOEVING</div>
    </div>
    <h2 style="color:#111827;margin:0 0 8px;">Reset your password</h2>
    <p style="color:#6b7280;margin:0 0 24px;">
      Hi {name},<br><br>
      We received a request to reset the password for your Moeving account.
      Click the button below — this link expires in {RESET_EXPIRY_MINUTES} minutes.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="{reset_url}"
         style="background:#16a34a;color:#fff;text-decoration:none;
                padding:14px 32px;border-radius:8px;font-weight:600;
                font-size:15px;display:inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;text-align:center;">
      If you didn't request this, you can safely ignore this email.<br>
      Your password won't change until you click the button above.
    </p>
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">
    <p style="color:#d1d5db;font-size:11px;text-align:center;margin:0;">
      Moeving Sales Intelligence · Secured with JWT
    </p>
  </div>
</body>
</html>""",
        })
    except Exception as e:
        # Don't expose email errors to the client
        print(f"[EMAIL ERROR] {e}")


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class TargetItem(BaseModel):
    year: int
    month: int                     # 1-12
    target_vehicles: float

class TargetsUpsert(BaseModel):
    targets: list[TargetItem]


# ── Auth endpoints ─────────────────────────────────────────────────────────────

@app.post("/signup", tags=["auth"])
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    req.email = req.email.lower().strip()
    req.name  = req.name.strip()
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
    return {
        "id":       current_user.id,
        "name":     current_user.name,
        "email":    current_user.email,
        "is_admin": is_admin(current_user),
    }


@app.post("/forgot-password", tags=["auth"])
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Generate a single-use reset token and email it.
    Always returns 200 to prevent email enumeration.
    """
    email = req.email.lower().strip()
    user  = db.query(User).filter(User.email == email).first()

    if user:
        # Invalidate any existing unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
        ).update({"used": True})
        db.commit()

        token      = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=RESET_EXPIRY_MINUTES)
        db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
        db.commit()

        reset_url = f"{FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        _send_reset_email(user.email, user.name, reset_url)

    return {"message": "If an account with that email exists, a reset link has been sent."}


@app.post("/reset-password", tags=["auth"])
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verify the token and update the user's password."""
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == req.token,
        PasswordResetToken.used  == False,
    ).first()

    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found.")

    user.hashed_password = get_password_hash(req.new_password)
    record.used = True
    db.commit()

    return {"message": "Password updated successfully. You can now sign in."}


# ── Dashboard endpoints ────────────────────────────────────────────────────────

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
        existing.uploaded_at    = now
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


# ── Targets (admin-managed monthly deployment targets) ────────────────────────

@app.get("/api/targets", tags=["targets"])
def list_targets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all stored monthly targets. Any authenticated user can read."""
    rows = db.query(MonthlyTarget).order_by(MonthlyTarget.year, MonthlyTarget.month).all()
    return {
        "is_admin": is_admin(current_user),
        "targets": [
            {"year": r.year, "month": r.month, "target_vehicles": r.target_vehicles}
            for r in rows
        ],
    }


@app.put("/api/targets", tags=["targets"])
def upsert_targets(req: TargetsUpsert, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Admin-only: upsert a batch of monthly targets."""
    count = 0
    for t in req.targets:
        if not (1 <= t.month <= 12) or t.year < 2000 or t.year > 2100:
            continue
        if t.target_vehicles < 0:
            continue
        existing = db.query(MonthlyTarget).filter_by(year=t.year, month=t.month).first()
        if existing:
            existing.target_vehicles = t.target_vehicles
            existing.updated_by      = admin.email
        else:
            db.add(MonthlyTarget(
                year=t.year, month=t.month,
                target_vehicles=t.target_vehicles,
                updated_by=admin.email,
            ))
        count += 1
    db.commit()
    return {"message": f"Updated {count} targets.", "count": count}


# ── System ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "version": "2.1.0"}
