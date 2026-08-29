"""
Voice Service — Sarvam AI STT/TTS Integration
================================================
Handles speech-to-text and text-to-speech via Sarvam AI APIs.

There is no mock transcript any more. When STT is not configured or fails, this
service raises STTUnavailable instead of returning text. It used to return the
fixed string "[Mock] Mujhe kal se chest mein pain ho raha hai..." — and on an API
error, "[STT Error] <exception>" — both of which the ACI engine then normalized
and stored as the patient's own answer to whatever clinical question was open.

TTS still degrades to None (no audio); silence is honest, invented speech is not.
"""

import asyncio
import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from sarvamai import SarvamAI
    SARVAM_AVAILABLE = True
except ImportError:
    SARVAM_AVAILABLE = False
    logger.warning("[VOICE] sarvamai SDK not installed — STT/TTS unavailable.")

from config import settings


class STTUnavailable(RuntimeError):
    """Raised when speech could not be transcribed. Never substitute text."""


# Language code mapping for Sarvam
STYLE_TO_LANG = {
    "formal_hindi": "hi-IN",
    "hinglish_casual": "hi-IN",  # Sarvam handles code-mixed under hi-IN
    "english_professional": "en-IN",
    # Direct language codes (from /tts endpoint)
    "hi-IN": "hi-IN",
    "en-IN": "en-IN",
    "hindi": "hi-IN",
    "hinglish": "hi-IN",
    "english": "en-IN",
}


class VoiceService:
    """Speech-to-Text and Text-to-Speech via Sarvam AI."""

    def __init__(self):
        self._client = None
        if SARVAM_AVAILABLE and settings.SARVAM_API_KEY:
            self._client = SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)
            logger.info("[VOICE] Sarvam AI client initialized")
        else:
            logger.warning(
                "[VOICE] No Sarvam API key — server-side STT/TTS is disabled. "
                "The kiosk falls back to browser speech recognition."
            )

    async def speech_to_text(self, audio_bytes: bytes, language: str = "hi-IN") -> str:
        """
        Convert speech audio to text using Sarvam Saaras V3.

        Args:
            audio_bytes: Raw audio bytes (WAV/MP3/OGG)
            language: Language code (hi-IN for Hindi/Hinglish, en-IN for English)

        Returns:
            The transcript of THIS audio.

        Raises:
            STTUnavailable if the audio could not be transcribed.
        """
        if not audio_bytes:
            raise STTUnavailable("No audio was received.")

        if not self._client:
            reason = (
                "the sarvamai SDK is not installed"
                if not SARVAM_AVAILABLE else "SARVAM_API_KEY is not configured"
            )
            raise STTUnavailable(
                f"Speech recognition is not available on this kiosk ({reason})."
            )

        import os
        import tempfile

        tmp_path = None
        try:
            # Write audio to temp file (Sarvam SDK needs a file)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            def _transcribe():
                with open(tmp_path, "rb") as f:
                    return self._client.speech_to_text.transcribe(
                        file=f,
                        model=settings.SARVAM_STT_MODEL,
                        mode="transcribe",
                        language_code=language,
                    )

            response = await asyncio.to_thread(_transcribe)

        except Exception as e:
            logger.error("[VOICE] STT failed (%s): %s", type(e).__name__, e)
            raise STTUnavailable(
                f"Could not transcribe the recording ({type(e).__name__})."
            ) from e
        finally:
            # The temp file used to leak on every failure — only the success path
            # reached os.unlink.
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        transcript = (getattr(response, "transcript", "") or "").strip()
        if not transcript:
            logger.warning("[VOICE] Empty transcript received")
            raise STTUnavailable(
                "Nothing could be heard in that recording. Please speak again."
            )

        logger.info("[VOICE] STT complete. Length=%d chars", len(transcript))
        return transcript

    async def text_to_speech(
        self, text: str, style_mode: str = "hinglish_casual"
    ) -> Optional[str]:
        """
        Convert text to speech audio using Sarvam Bulbul V2.

        Args:
            text: Text to convert to speech
            style_mode: ACI style mode (determines language/voice)

        Returns:
            Base64-encoded audio string, or None if TTS fails
        """
        if not self._client:
            logger.info("[VOICE] TTS unavailable (no Sarvam client) — no audio returned")
            return None

        lang_code = STYLE_TO_LANG.get(style_mode, "hi-IN")

        try:
            def _synthesize():
                return self._client.text_to_speech.convert(
                    text=text,
                    model=settings.SARVAM_TTS_MODEL,
                    language_code=lang_code,
                    speaker=settings.SARVAM_TTS_SPEAKER,  # Female voice
                    pace=1.0,
                )

            response = await asyncio.to_thread(_synthesize)

            # V3 returns base64 in 'audios' list
            if hasattr(response, 'audios') and response.audios:
                audio_data = response.audios[0]
                if isinstance(audio_data, str):
                    # Already base64-encoded
                    logger.info("[VOICE] TTS complete (V3 audios). Audio generated.")
                    return audio_data
                else:
                    audio_b64 = base64.b64encode(audio_data).decode('utf-8')
                    logger.info("[VOICE] TTS complete (V3 audios bytes). Audio generated.")
                    return audio_b64

            # V2 fallback: raw bytes in 'audio'
            if hasattr(response, 'audio') and response.audio:
                if isinstance(response.audio, str):
                    logger.info("[VOICE] TTS complete (audio str). Audio generated.")
                    return response.audio
                audio_b64 = base64.b64encode(response.audio).decode('utf-8')
                logger.info("[VOICE] TTS complete. Audio generated.")
                return audio_b64

            # Try dict-like access
            if hasattr(response, '__getitem__'):
                for key in ('audios', 'audio', 'audio_string'):
                    try:
                        val = response[key]
                        if val:
                            if isinstance(val, list):
                                val = val[0]
                            if isinstance(val, str):
                                return val
                            return base64.b64encode(val).decode('utf-8')
                    except (KeyError, TypeError):
                        continue

            logger.warning("[VOICE] TTS returned empty audio. Response: %s", str(response)[:500])
            return None

        except Exception as e:
            logger.error("[VOICE] TTS failed: %s", e)
            return None
