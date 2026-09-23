import os
import sys

# Make the FastAPI backend importable from this serverless function.
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backend")
sys.path.insert(0, _BACKEND_DIR)

# Vercel functions run on a read-only filesystem except /tmp.
os.environ.setdefault("STORAGE_LOCAL_PATH", "/tmp/uploads")

from app.main import app  # noqa: E402,F401
