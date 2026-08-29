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
    # NOTE: llama-3.3-70b-versatile was decommissioned — every call 404'd and
    # llm_complete() returned "", which silently collapsed the whole clinical
    # pipeline into canned templates. qwen3.8-27b is fast (~0.5s), works at
    # small token budgets, and its <think> block is stripped in llm_client.
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

    # ── Google Gemini ─────────────────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # ── Sarvam AI ─────────────────────────────────────────────────────────
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    SARVAM_STT_MODEL: str = os.getenv("SARVAM_STT_MODEL", "saaras:v3")
    SARVAM_TTS_MODEL: str = "bulbul:v3"
    SARVAM_TTS_SPEAKER: str = os.getenv("SARVAM_TTS_SPEAKER", "ishita")

    # ── Face Recognition ──────────────────────────────────────────────────
    FACE_MATCH_THRESHOLD: float = float(os.getenv("FACE_MATCH_THRESHOLD", "0.6"))
    # Lower = stricter matching. 0.6 is good for controlled kiosk environments.

    # ── Paths ─────────────────────────────────────────────────────────────
    DATA_DIR: str = os.getenv("DATA_DIR", str(Path(__file__).parent / "data"))


settings = Settings()
