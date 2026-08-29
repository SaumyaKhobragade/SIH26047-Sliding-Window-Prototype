"""
Configuration for MediKiosk Prototype Backend
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)


class Settings:
    # ── Server ────────────────────────────────────────────────────────────
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8080"))

    # ── LLM Provider ──────────────────────────────────────────────────────
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")  # "groq" or "gemini"

    # ── Groq ──────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # ── Google Gemini ─────────────────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # ── Sarvam AI ─────────────────────────────────────────────────────────
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    SARVAM_STT_MODEL: str = "saaras:v3"
    SARVAM_TTS_MODEL: str = "bulbul:v3"

    # ── Face Recognition ──────────────────────────────────────────────────
    FACE_MATCH_THRESHOLD: float = float(os.getenv("FACE_MATCH_THRESHOLD", "0.6"))
    # Lower = stricter matching. 0.6 is good for controlled kiosk environments.

    # ── Paths ─────────────────────────────────────────────────────────────
    DATA_DIR: str = os.getenv("DATA_DIR", str(Path(__file__).parent / "data"))


settings = Settings()
