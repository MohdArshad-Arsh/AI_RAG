import os
from dotenv import load_dotenv

load_dotenv()

# ─── Upload directory ─────────────────────────────────────────
UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/app/uploads")

# ─── MySQL ───────────────────────────────────────────────────
MYSQL_HOST:     str = os.getenv("MYSQL_HOST",     "mysql")
MYSQL_USER:     str = os.getenv("MYSQL_USER",     "root")
MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "root")
MYSQL_DATABASE: str = os.getenv("MYSQL_DATABASE", "rag_ai")

# ─── Qdrant ──────────────────────────────────────────────────
QDRANT_URL: str = os.getenv("QDRANT_URL", "http://qdrant:6333")

# ─── Ollama ──────────────────────────────────────────────────
# OLLAMA_HOST: full base URL of the Ollama server
#   docker:      http://ollama:11434
#   local:       http://localhost:11434
OLLAMA_HOST:  str = os.getenv("OLLAMA_HOST",  "http://ollama:11434")
OLLAMA_URL:   str = os.getenv("OLLAMA_URL", OLLAMA_HOST)
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")

# ─── Allowed upload extensions ───────────────────────────────
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".xlsx", ".zip"}

# ─── Email / SMTP ─────────────────────────────────────────────
MAIL_USERNAME: str = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM:     str = os.getenv("MAIL_FROM", "")
MAIL_SERVER:   str = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT:     int = int(os.getenv("MAIL_PORT", "587"))

# Secret required when creating an admin through the signup API.
# Normal application signup does not send this, so accounts default to role='user'.
ADMIN_CREATE_KEY: str = os.getenv("ADMIN_CREATE_KEY", "")