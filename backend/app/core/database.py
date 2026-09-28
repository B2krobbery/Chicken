import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# On Vercel serverless each warm instance holds pool connections open, which
# exhausts the Supavisor session-mode pool (free tier cap). NullPool opens and
# closes a connection per request — the correct pattern for serverless + pooler.
if os.getenv("VERCEL"):
    engine = create_engine(
        db_url,
        poolclass=NullPool,
    )
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=int(os.getenv("DB_POOL_SIZE", "20")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
        pool_recycle=300
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
