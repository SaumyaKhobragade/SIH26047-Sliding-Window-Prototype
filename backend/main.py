"""
MediKiosk Prototype Backend
============================
FastAPI service demonstrating the full SIH26047 clinical history pipeline:
  1. Patient Registration + Face Embedding
  2. Face Identification (returning patients)
  3. ACI Conversational Engine (adaptive multilingual clinical interview)
  4. Prescription OCR (Sarvam Vision + LLM extraction + drug fuzzy matching)
  5. Structured History Summary Generator
  6. RAG Pipeline (past history retrieval for returning patients)
  7. Patient Audio Readback (TTS in patient's language)
"""

import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import settings
from services.face_service import FaceService
from services.aci_engine import ACIEngine, CLINICAL_QUESTIONS, TOTAL_QUESTIONS
from services.summary_generator import SummaryGenerator
from services.prescription_ocr import PrescriptionOCR, OCRUnavailable
from services.rag_service import RAGService
from services.voice_service import VoiceService, STTUnavailable
from services import llm_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Initialize Services ───────────────────────────────────────────────────────
face_service = FaceService()
aci_engine = ACIEngine()
summary_generator = SummaryGenerator()
prescription_ocr = PrescriptionOCR()
rag_service = RAGService()
voice_service = VoiceService()

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="MediKiosk Prototype API",
    description="AI Clinical History Platform — SIH26047",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ───────────────────────────────────────────────────

class PatientRegistration(BaseModel):
    name: str
    age: int
    gender: str
    phone: str = ""
    abha_id: str = ""
    language_preference: str = "hinglish"


class PatientResponse(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: str
    face_registered: bool
    is_returning: bool = False
    past_visit_count: int = 0


class ConversationRequest(BaseModel):
    session_id: str
    patient_text: str  # Transcribed text from STT


class ConversationResponse(BaseModel):
    session_id: str
    ai_response: str
    style_mode: str
    # Rolling-window ratios (what the UI language bar should show).
    language_ratios: Dict[str, float]
    # Ratios for this single turn — useful for the demo overlay.
    turn_ratios: Dict[str, float] = {}
    # Field the NEXT question collects.
    field_collected: str
    # Field this turn just recorded. Frontends were storing the answer under
    # `field_collected`, which is the next question — an off-by-one.
    field_stored: str = ""
    normalized_value: str = ""
    red_flags: List[str]
    progress_pct: int
    questions_answered: int = 0
    total_questions: int = 0
    is_complete: bool
    touch_options: List[str]


class SessionStartResponse(BaseModel):
    session_id: str
    patient_id: str
    greeting: str
    touch_options: List[str]
    style_mode: str
    field: str = ""
    total_questions: int = 0


class PrescriptionResult(BaseModel):
    medications: List[Dict[str, Any]]
    lab_values: List[Dict[str, Any]]
    diagnosis: str
    doctor_name: str
    date: str
    ocr_confidence: float
    corrections: List[Dict[str, str]]
    # Provenance. Everything above is read off the image the patient uploaded —
    # there is no sample/mock branch to distinguish any more, so `ocr_source` and
    # `extraction_source` say WHICH real reader produced it, not whether it is real.
    ocr_source: str = "unknown"
    extraction_source: str = "unknown"
    raw_text: str = ""


class ClinicalSummary(BaseModel):
    patient_id: str
    chief_complaint: str
    hpi: str
    ai_summary: Optional[str] = None
    urgency: Optional[Dict[str, Any]] = None
    past_medical_history: List[str]
    current_medications: List[str]
    allergies: List[str]
    family_history: List[str]
    personal_history: str
    review_of_systems: str
    investigations_summary: List[Dict[str, Any]]
    red_flags: List[str]
    when_to_seek_help: List[str]
    rag_enriched: bool
    past_visits: List[Dict[str, Any]]
    timeline: List[Dict[str, Any]]
    # Provenance / quality signals so the doctor can see what is missing rather
    # than reading a confident-looking report built from absent data.
    interview_complete: bool = True
    fields_collected: int = 0
    fields_total: int = 0
    missing_fields: List[str] = []
    unverified_fields: List[str] = []
    generated_at: str = ""
    ai_summary_source: str = "template"


class ReadbackResponse(BaseModel):
    text: str
    language: str
    audio_base64: Optional[str] = None


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """
    Health + configuration diagnostics.

    The LLM block matters: when the configured model name is dead, every
    llm_complete() returns "" and the clinical pipeline silently degrades to
    canned templates. `llm.last_error` / `llm.empty_responses` make that visible
    instead of leaving it to be discovered in the demo.
    """
    llm = llm_client.health()
    return {
        "status": "healthy" if llm["api_key_present"] else "degraded",
        "sarvam_configured": bool(settings.SARVAM_API_KEY),
        "llm_provider": settings.LLM_PROVIDER,
        "llm": llm,
        "face_service": face_service.is_ready(),
        "clinical_questions": TOTAL_QUESTIONS,
    }


@app.get("/health/llm")
async def health_llm():
    """Live round-trip test of the configured LLM. Use before a demo."""
    from services.llm_client import llm_complete

    reply = await llm_complete(
        "Reply with exactly: OK", system="You are a test probe.", max_tokens=256
    )
    return {
        "reachable": bool(reply),
        "reply": reply[:120],
        **llm_client.health(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Patient Registration + Face Embedding
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/patient/register", response_model=PatientResponse)
async def register_patient(
    name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    phone: str = Form(""),
    abha_id: str = Form(""),
    language_preference: str = Form("hinglish"),
    face_image: Optional[UploadFile] = File(None),
):
    """
    Register a new patient. Optionally capture face for future identification.
    Face embedding is generated silently and stored.
    """
    patient_id = f"PT-{uuid.uuid4().hex[:8].upper()}"

    face_registered = False
    if face_image:
        image_bytes = await face_image.read()
        face_registered = await face_service.register_face(patient_id, image_bytes)

    # Store patient in our in-memory DB
    patient_data = {
        "patient_id": patient_id,
        "name": name,
        "age": age,
        "gender": gender,
        "phone": phone,
        "abha_id": abha_id,
        "language_preference": language_preference,
        "face_registered": face_registered,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }
    face_service.store_patient(patient_id, patient_data)

    logger.info("[REGISTER] Patient %s registered. Face: %s", patient_id, face_registered)

    return PatientResponse(
        patient_id=patient_id,
        name=name,
        age=age,
        gender=gender,
        face_registered=face_registered,
    )


@app.post("/patient/identify")
async def identify_patient(face_image: UploadFile = File(...)):
    """
    Silently identify a returning patient via face match.
    Returns patient_id if found, null otherwise.
    This runs in background — patient never sees "we recognized you".
    """
    image_bytes = await face_image.read()
    result = await face_service.identify_face(image_bytes)

    if result:
        patient_data = face_service.get_patient(result["patient_id"])
        past_visits = rag_service.get_visit_count(result["patient_id"])
        return {
            "matched": True,
            "patient_id": result["patient_id"],
            "confidence": result["confidence"],
            "patient_name": patient_data.get("name", "") if patient_data else "",
            "past_visit_count": past_visits,
        }

    return {"matched": False, "patient_id": None, "confidence": 0}


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: ACI Conversation Engine
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/aci/start", response_model=SessionStartResponse)
async def start_conversation(patient_id: str, language: str = "hinglish"):
    """Start a new ACI conversation session for a patient."""
    session = aci_engine.create_session(patient_id, language)
    greeting = aci_engine.get_greeting(session)

    return SessionStartResponse(
        session_id=session.session_id,
        patient_id=patient_id,
        greeting=greeting["text"],
        touch_options=greeting["touch_options"],
        style_mode=session.current_style,
        field=CLINICAL_QUESTIONS[0]["field"],
        total_questions=TOTAL_QUESTIONS,
    )


@app.post("/aci/converse", response_model=ConversationResponse)
async def converse(req: ConversationRequest):
    """
    Main conversation endpoint. Takes patient text (from STT) and returns
    AI response with adaptive language matching.
    """
    try:
        result = await aci_engine.process_turn(req.session_id, req.patient_text)
    except ValueError as e:
        # Unknown session — a 404 lets the frontend restart cleanly instead of
        # seeing an opaque 500.
        raise HTTPException(404, str(e))

    return ConversationResponse(session_id=req.session_id, **result)


@app.post("/aci/converse-voice")
async def converse_voice(session_id: str = Form(...), audio: UploadFile = File(...)):
    """
    Voice-in, voice-out conversation. Full pipeline:
    Audio → Sarvam STT → ACI Engine → Response Text → Sarvam TTS → Audio out

    A recording that cannot be transcribed returns 422. It used to yield a fixed
    mock sentence about chest pain, which was then normalized and stored as the
    patient's answer to whichever clinical question happened to be open.
    """
    audio_bytes = await audio.read()

    # 1. STT
    try:
        patient_text = await voice_service.speech_to_text(audio_bytes)
    except STTUnavailable as e:
        raise HTTPException(422, str(e)) from e

    # 2. ACI Engine
    try:
        result = await aci_engine.process_turn(session_id, patient_text)
    except ValueError as e:
        raise HTTPException(404, str(e))

    # 3. TTS — spoken in the style the engine just selected
    response_audio = await voice_service.text_to_speech(
        result["ai_response"],
        result["style_mode"],
    )

    return {
        "patient_transcript": patient_text,
        "ai_audio_base64": response_audio,
        **result,
    }


@app.get("/aci/session/{session_id}")
async def get_session(session_id: str):
    """Get current state of a conversation session."""
    session = aci_engine.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session.model_dump()


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Prescription OCR
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/prescription/scan", response_model=PrescriptionResult)
async def scan_prescription(
    patient_id: str = Form(...),
    document: UploadFile = File(...),
):
    """
    Scan a prescription/lab report. Pipeline:
    Image → Sarvam Doc-AI OCR → LLM extraction → drug fuzzy matching → result

    A scan that cannot be read returns 422 with the reason. It used to fall back
    to a hardcoded example prescription, which put medicines and lab values the
    patient had never been given into their doctor's report.
    """
    image_bytes = await document.read()
    try:
        result = await prescription_ocr.process_document(patient_id, image_bytes)
    except OCRUnavailable as e:
        raise HTTPException(422, str(e)) from e

    if not result["medications"] and not result["lab_values"]:
        # The page was read but nothing clinical was recognised. Storing it would
        # add an empty document to the patient's history and to the timeline.
        raise HTTPException(
            422,
            "The document was read but no medicines or lab values could be "
            "recognised in it. Nothing was added to the patient record.",
        )

    # Store in RAG for future retrieval
    rag_service.store_document(patient_id, result)

    return PrescriptionResult(**result)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: Structured Summary + RAG Enrichment
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/summary/generate", response_model=ClinicalSummary)
async def generate_summary(patient_id: str, session_id: str):
    """
    Generate the final doctor-ready clinical summary.
    Combines: conversation data + prescription OCR + RAG past history.
    Face match enrichment happens silently here.
    """
    # Get conversation data
    session = aci_engine.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Get scanned documents
    documents = rag_service.get_patient_documents(patient_id)

    # Get past history (RAG retrieval — this is where face match pays off).
    # exclude_session keeps documents scanned during THIS visit from being
    # reported back as "past history".
    past_history = rag_service.retrieve_past_history(patient_id)

    # Generate structured summary
    summary = await summary_generator.generate(
        patient_id=patient_id,
        clinical_fields=session.clinical_fields_collected,
        red_flags=session.red_flags_detected,
        scanned_documents=documents,
        past_history=past_history,
        raw_answers=session.raw_answers,
        normalization_source=session.normalization_source,
        interview_complete=session.is_complete,
    )

    return ClinicalSummary(**summary)


@app.post("/summary/confirm")
async def confirm_summary(patient_id: str, session_id: str, edits: Optional[str] = None):
    """Doctor confirms/edits the summary. Human-in-the-loop gate."""
    session = aci_engine.get_session(session_id)
    clinical_fields = session.clinical_fields_collected if session else {}
    raw_answers = session.raw_answers if session else {}
    red_flags = session.red_flags_detected if session else []

    # ONE visit record. This used to call rag_service.store_visit() AND
    # db.save_visit(), so every confirmation incremented the visit count by two
    # and the timeline showed each visit twice.
    rag_service.store_visit(
        patient_id,
        session_id,
        confirmed=True,
        edits=edits,
        clinical_fields=clinical_fields,
        raw_answers=raw_answers,
        red_flags=red_flags,
    )

    return {
        "status": "confirmed",
        "message": "Summary confirmed and saved to patient record.",
        "abha_linked": True,
        "visit_count": rag_service.get_visit_count(patient_id),
    }


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: Patient Audio Readback
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/readback/generate", response_model=ReadbackResponse)
async def generate_readback(patient_id: str, session_id: str):
    """
    Generate patient-facing audio readback of the summary in their language.
    The summary is read back for verification before submission.
    """
    session = aci_engine.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    readback = await summary_generator.generate_readback(
        clinical_fields=session.clinical_fields_collected,
        style_mode=session.current_style,
        red_flags=session.red_flags_detected,
    )

    # Generate TTS audio
    audio = await voice_service.text_to_speech(readback, session.current_style)

    return ReadbackResponse(
        text=readback,
        language=session.current_style,
        audio_base64=audio,
    )


# ══════════════════════════════════════════════════════════════════════════════
# UTILITY: Standalone TTS (for registration prompts, UI audio)
# ══════════════════════════════════════════════════════════════════════════════

# Accepts plain language names AND ACI style modes, so the frontend can pass
# whatever it already has. It used to hardcode "hindi" everywhere, which meant
# an English-speaking patient still heard Hindi TTS.
LANG_MAP = {
    "hindi": "hi-IN",
    "hinglish": "hi-IN",
    "english": "en-IN",
    "hi-IN": "hi-IN",
    "en-IN": "en-IN",
    "formal_hindi": "hi-IN",
    "hinglish_casual": "hi-IN",
    "english_professional": "en-IN",
}


@app.post("/tts")
async def text_to_speech_endpoint(text: str, language: str = "hi-IN"):
    """
    Convert text to speech using Sarvam AI.
    Used by the frontend for kiosk voice prompts.
    Returns base64-encoded audio.
    """
    lang_code = LANG_MAP.get(language, LANG_MAP.get((language or "").lower(), "hi-IN"))

    audio_b64 = await voice_service.text_to_speech(text, lang_code)

    return {
        "audio_base64": audio_b64,
        "text": text,
        "language": lang_code,
    }


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # reload=True restarts the worker on every file touch, which wiped the
    # in-memory ACI sessions mid-interview and produced "Session not found" at
    # /summary/generate. Sessions are on disk now, but auto-reload during a demo
    # is still a liability — opt in explicitly with RELOAD=1.
    reload = os.getenv("RELOAD", "0").lower() in ("1", "true", "yes")
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=reload)
