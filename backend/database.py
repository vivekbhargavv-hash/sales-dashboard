"""
Database setup using SQLAlchemy.
Supports SQLite (local dev) and PostgreSQL (production via DATABASE_URL).
"""
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

# Render PostgreSQL uses postgres:// — SQLAlchemy requires postgresql://
_DB_URL = os.getenv("DATABASE_URL", "sqlite:///./moeving.db")
if _DB_URL.startswith("postgres://"):
    _DB_URL = _DB_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL does not
_connect_args = {"check_same_thread": False} if "sqlite" in _DB_URL else {}

engine = create_engine(_DB_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(120), nullable=False)
    email           = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)


class UserDashboard(Base):
    """Stores the last processed dashboard JSON per user."""
    __tablename__ = "user_dashboards"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, nullable=False, index=True)
    dashboard_json = Column(Text, nullable=False)   # full JSON blob
    uploaded_at    = Column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    """Single-use tokens for password reset emails. Expire after 30 min."""
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, nullable=False, index=True)
    token      = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_db():
    """FastAPI dependency: yields a DB session and closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist (idempotent)."""
    Base.metadata.create_all(bind=engine)
