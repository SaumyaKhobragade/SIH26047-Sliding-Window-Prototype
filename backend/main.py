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
from services.aci_engine import ACIEngine
from services.summary_generator import SummaryGenerator
from services.prescription_ocr import PrescriptionOCR
from services.rag_service import RAGService
from services.voice_service import VoiceService

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
    language_ratios: Dict[str, float]
    field_collected: str
    red_flags: List[str]
    progress_pct: int
    is_complete: bool
    touch_options: List[str]


class SessionStartResponse(BaseModel):
    session_id: str
    patient_id: str
    greeting: str
    touch_options: List[str]
    style_mode: str


class PrescriptionResult(BaseModel):
    medications: List[Dict[str, Any]]
    lab_values: List[Dict[str, Any]]
    diagnosis: str
    doctor_name: str
    date: str
    ocr_confidence: float
    corrections: List[Dict[str, str]]


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


class ReadbackResponse(BaseModel):
    text: str
    language: str
    audio_base64: Optional[str] = None


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "sarvam_configured": bool(settings.SARVAM_API_KEY),
        "llm_provider": settings.LLM_PROVIDER,
        "face_service": face_service.is_ready(),
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
    )


@app.post("/aci/converse", response_model=ConversationResponse)
async def converse(req: ConversationRequest):
    """
    Main conversation endpoint. Takes patient text (from STT) and returns
    AI response with adaptive language matching.
    """
    result = await aci_engine.process_turn(req.session_id, req.patient_text)

    return ConversationResponse(
        session_id=req.session_id,
        ai_response=result["ai_response"],
        style_mode=result["style_mode"],
        language_ratios=result["language_ratios"],
        field_collected=result["field_collected"],
        red_flags=result["red_flags"],
        progress_pct=result["progress_pct"],
        is_complete=result["is_complete"],
        touch_options=result["touch_options"],
    )


@app.post("/aci/converse-voice")
async def converse_voice(session_id: str = Form(...), audio: UploadFile = File(...)):
    """
    Voice-in, voice-out conversation. Full pipeline:
    Audio → Sarvam STT → ACI Engine → Response Text → Sarvam TTS → Audio out
    """
    audio_bytes = await audio.read()

    # 1. STT
    patient_text = await voice_service.speech_to_text(audio_bytes)

    # 2. ACI Engine
    result = await aci_engine.process_turn(session_id, patient_text)

    # 3. TTS
    response_audio = await voice_service.text_to_speech(
        result["ai_response"],
        result["style_mode"],
    )

    return {
        "patient_transcript": patient_text,
        "ai_response": result["ai_response"],
        "ai_audio_base64": response_audio,
        "style_mode": result["style_mode"],
        "language_ratios": result["language_ratios"],
        "field_collected": result["field_collected"],
        "red_flags": result["red_flags"],
        "progress_pct": result["progress_pct"],
        "is_complete": result["is_complete"],
        "touch_options": result["touch_options"],
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
    Image → Sarvam Vision OCR → LLM Extraction → Drug Fuzzy Matching → Result
    """
    image_bytes = await document.read()
    result = await prescription_ocr.process_document(patient_id, image_bytes)

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

    # Get past history (RAG retrieval — this is where face match pays off)
    past_history = rag_service.retrieve_past_history(patient_id)

    # Generate structured summary
    summary = await summary_generator.generate(
        patient_id=patient_id,
        clinical_fields=session.clinical_fields_collected,
        red_flags=session.red_flags_detected,
        scanned_documents=documents,
        past_history=past_history,
    )

    return ClinicalSummary(**summary)


@app.post("/summary/confirm")
async def confirm_summary(patient_id: str, session_id: str, edits: Optional[str] = None):
    """Doctor confirms/edits the summary. Human-in-the-loop gate."""
    # Get session data to store alongside the visit
    session = aci_engine.get_session(session_id)
    clinical_fields = session.clinical_fields_collected if session else {}

    # Store confirmed visit with clinical data
    rag_service.store_visit(patient_id, session_id, confirmed=True, edits=edits)

    # Also persist the clinical fields as part of visit record
    from services.persistence import db
    db.save_visit(patient_id, {
        "session_id": session_id,
        "type": "confirmed_summary",
        "clinical_fields": clinical_fields,
        "edits": edits,
        "confirmed": True,
    })

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

@app.post("/tts")
async def text_to_speech_endpoint(text: str, language: str = "hi-IN"):
    """
    Convert text to speech using Sarvam AI.
    Used by the frontend for kiosk voice prompts.
    Returns base64-encoded audio.
    """
    # Map simple language names to Sarvam codes
    lang_map = {
        "hindi": "hi-IN", "hinglish": "hi-IN", "english": "en-IN",
        "hi-IN": "hi-IN", "en-IN": "en-IN",
    }
    lang_code = lang_map.get(language, "hi-IN")

    audio_b64 = await voice_service.text_to_speech(text, lang_code)

    return {
        "audio_base64": audio_b64,
        "text": text,
        "language": lang_code,
    }


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
