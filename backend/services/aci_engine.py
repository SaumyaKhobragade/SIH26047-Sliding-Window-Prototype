"""
Adaptive Conversational Intelligence (ACI) Engine
===================================================
The core innovation of MediKiosk.

Architecture:
  PATIENT SPEECH (messy, code-mixed) → Adaptive Conversation Layer (flexible)
                                     → Clinical NLP Layer (STRICT)
                                     → Standardized Medical Record

Key design rules:
  1. Clinical questions (SOCRATES) are NEVER skipped regardless of style
  2. Red-flag detection uses pre-validated keyword matching, not free LLM generation
  3. Language style adapts based on rolling window of last 3-4 turns
  4. 3 discrete style modes: formal_hindi | hinglish_casual | english_professional
"""

import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from enum import Enum

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Style Modes ───────────────────────────────────────────────────────────────

class StyleMode(str, Enum):
    FORMAL_HINDI = "formal_hindi"
    HINGLISH_CASUAL = "hinglish_casual"
    ENGLISH_PROFESSIONAL = "english_professional"


# ── Session State ─────────────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    role: str  # "patient" or "system"
    text: str
    language_ratios: Dict[str, float] = {}
    style_mode: str = ""
    field: str = ""


class ACISession(BaseModel):
    session_id: str
    patient_id: str
    language_preference: str = "hinglish"
    turns: List[ConversationTurn] = []
    current_style: str = "hinglish_casual"
    language_ratios: Dict[str, float] = {"hindi": 33, "english": 33, "hinglish": 34}
    clinical_fields_collected: Dict[str, str] = {}
    current_question_index: int = 0
    red_flags_detected: List[str] = []
    is_complete: bool = False


# ── Clinical Question Graph (SOCRATES Framework) ─────────────────────────────
# Each question has variants in all 3 style modes + touch options

CLINICAL_QUESTIONS = [
    {
        "field": "chief_complaint",
        "formal_hindi": "Aapko kya taklif ho rahi hai? Kripya apni mukhya samasya bataiye.",
        "hinglish_casual": "Kya problem ho raha hai aapko? Batao kya hua.",
        "english_professional": "What is your main concern today? Please describe your primary symptom.",
        "touch_options": ["Chest pain", "Headache", "Stomach pain", "Fever", "Back pain", "Breathing difficulty", "Other"],
    },
    {
        "field": "onset",
        "formal_hindi": "Yeh samasya kab se hai? Kitne din ya ghante pehle shuru hui?",
        "hinglish_casual": "Yeh kab se ho raha hai? Kal se? Last week se?",
        "english_professional": "When did this start? How long have you been experiencing this?",
        "touch_options": ["Today", "Since yesterday", "2-3 days", "1 week", "More than a week", "Months"],
    },
    {
        "field": "character",
        "formal_hindi": "Yeh dard kaisa hai? Tez hai, halka hai, ya jalak jaisa?",
        "hinglish_casual": "Pain kaise hai — sharp hai, dull hai, ya burning type?",
        "english_professional": "Can you describe the nature of the pain? Is it sharp, dull, burning, or pressure-like?",
        "touch_options": ["Sharp/stabbing", "Dull/aching", "Burning", "Pressure/heaviness", "Throbbing", "Cramping"],
    },
    {
        "field": "radiation",
        "formal_hindi": "Kya yeh dard kisi aur jagah tak jaata hai? Haath, jaw, ya peeth mein?",
        "hinglish_casual": "Yeh pain kahi aur bhi jaata hai? Arm mein, jaw mein, ya back mein?",
        "english_professional": "Does the pain radiate or spread to any other area? Such as your arm, jaw, or back?",
        "touch_options": ["Left arm", "Right arm", "Jaw/neck", "Back", "Shoulder", "No spreading"],
    },
    {
        "field": "associated_symptoms",
        "formal_hindi": "Iske saath koi aur lakshan bhi hain? Bukhar, ulti, chakkar?",
        "hinglish_casual": "Aur kuch symptoms hain? Fever, vomiting, dizziness type kuch?",
        "english_professional": "Are there any associated symptoms? Such as fever, nausea, dizziness, or shortness of breath?",
        "touch_options": ["Fever", "Nausea/vomiting", "Dizziness", "Breathlessness", "Sweating", "None"],
    },
    {
        "field": "timing",
        "formal_hindi": "Yeh dard lagatar hai ya aata jaata hai?",
        "hinglish_casual": "Constant hai ya on-off hota hai?",
        "english_professional": "Is the pain constant or does it come and go?",
        "touch_options": ["Constant", "Comes and goes", "Only at certain times", "Getting worse"],
    },
    {
        "field": "exacerbating",
        "formal_hindi": "Kya karne se dard badhta hai? Aur kya karne se kam hota hai?",
        "hinglish_casual": "Kya karne pe badhta hai? Aur kya karne pe kam hota hai? Walking, eating, resting?",
        "english_professional": "What makes it worse? And what provides relief? Activity, rest, food?",
        "touch_options": ["Worse with movement", "Worse with eating", "Better with rest", "No change", "Worse at night"],
    },
    {
        "field": "severity",
        "formal_hindi": "1 se 10 ke scale pe, kitna dard hai? 1 matlab bahut kam, 10 matlab asahniya.",
        "hinglish_casual": "Scale of 1-10 pe kitna hai? 1 = mild, 10 = worst ever?",
        "english_professional": "On a scale of 1 to 10, how severe is the pain? 1 being minimal, 10 being the worst.",
        "touch_options": ["1-3 (Mild)", "4-6 (Moderate)", "7-8 (Severe)", "9-10 (Very severe)"],
    },
    {
        "field": "past_medical",
        "formal_hindi": "Kya aapko pehle se koi bimari hai? Diabetes, BP, heart, kuch bhi?",
        "hinglish_casual": "Koi purani bimari? Diabetes, BP, thyroid, kuch hai?",
        "english_professional": "Do you have any pre-existing medical conditions? Diabetes, hypertension, heart disease?",
        "touch_options": ["Diabetes", "Hypertension", "Heart disease", "Thyroid", "Asthma", "None"],
    },
    {
        "field": "medications",
        "formal_hindi": "Kya aap abhi koi dawai niyamit roop se le rahe hain?",
        "hinglish_casual": "Koi regular medicine chal rahi hai? Kya lete ho daily?",
        "english_professional": "Are you currently taking any regular medications? Please list them with dosages if possible.",
        "touch_options": ["Yes, for diabetes", "Yes, for BP", "Yes, for heart", "Multiple medications", "No regular meds"],
    },
    {
        "field": "allergies",
        "formal_hindi": "Kya aapko kisi dawai ya khaane se allergy hai?",
        "hinglish_casual": "Koi allergy hai? Medicine ya food se kuch?",
        "english_professional": "Do you have any known allergies to medications, food, or other substances?",
        "touch_options": ["No allergies", "Medicine allergy", "Food allergy", "Not sure"],
    },
    {
        "field": "family_history",
        "formal_hindi": "Kya aapke parivaar mein kisi ko heart disease, diabetes, ya cancer hai?",
        "hinglish_casual": "Family mein kisi ko heart problem, diabetes, ya kuch serious hai?",
        "english_professional": "Is there any significant family history? Heart disease, diabetes, cancer, or stroke?",
        "touch_options": ["Heart disease", "Diabetes", "Cancer", "Stroke", "No significant history"],
    },
]

# ── Red Flag Keywords ─────────────────────────────────────────────────────────
# Template-based, NOT free LLM generation — this is the safety guarantee

RED_FLAG_PATTERNS = [
    {
        "keywords": ["chest pain", "chest mein pain", "chest mein dard", "chati", "seene mein", "sine mein", "seene mein dard"],
        "keyword_pairs": [["chest", "pain"], ["chest", "dard"], ["seene", "dard"]],
        "modifiers": ["left arm", "left haath", "left side", "jaw", "jabda", "breathless", "saans", "sweating", "pasina"],
        "alert": "Chest pain with possible cardiac symptoms — recommend immediate ECG + Troponin",
        "severity": "HIGH",
    },
    {
        "keywords": ["unconscious", "behosh", "faint", "gir gaya", "chakkar"],
        "modifiers": [],
        "alert": "Loss of consciousness / syncope — immediate medical attention needed",
        "severity": "HIGH",
    },
    {
        "keywords": ["paralysis", "lakwa", "stroke", "face droop", "speech slurred"],
        "modifiers": ["sudden", "achanak", "ek taraf"],
        "alert": "Possible stroke symptoms — activate stroke protocol (FAST)",
        "severity": "CRITICAL",
    },
    {
        "keywords": ["blood", "khoon", "bleeding", "vomiting blood", "khoon ki ulti"],
        "modifiers": ["severe", "bahut", "heavy"],
        "alert": "Active bleeding / hematemesis — immediate assessment needed",
        "severity": "HIGH",
    },
    {
        "keywords": ["seizure", "daura", "fits", "convulsion", "jhatkay"],
        "modifiers": [],
        "alert": "Seizure / convulsion episode — immediate neurological assessment",
        "severity": "HIGH",
    },
    {
        "keywords": ["suicidal", "suicide", "marna chahta", "jeene ka mann nahi", "harm myself"],
        "modifiers": [],
        "alert": "Psychiatric emergency — immediate mental health assessment",
        "severity": "CRITICAL",
    },
]


# ── Language Detection ────────────────────────────────────────────────────────

# Devanagari Unicode range
DEVANAGARI_PATTERN = re.compile(r'[\u0900-\u097F]')
# Common Hindi words written in Latin script
HINDI_LATIN_WORDS = {
    "mujhe", "hai", "ho", "raha", "hoon", "kya", "kab", "kaise", "kahan",
    "nahi", "haan", "ji", "tha", "thi", "hua", "aur", "se", "mein", "ko",
    "pe", "dard", "bukhar", "pet", "sir", "dawa", "dawai", "khana", "pani",
    "subah", "shaam", "raat", "din", "kal", "aaj", "zyada", "kam", "bahut",
    "thoda", "abhi", "pehle", "baad", "accha", "theek", "bilkul", "lagta",
    "hota", "leta", "karti", "karta", "chahiye", "sakta", "wala", "taklif",
    "bimari", "allergy", "tablet", "injection",
}


def detect_language_ratios(text: str) -> Dict[str, float]:
    """
    Analyze text and return language ratios.
    Uses character-set detection (Devanagari vs Latin) + keyword matching.
    """
    words = text.lower().split()
    if not words:
        return {"hindi": 33, "english": 33, "hinglish": 34}

    devanagari_count = len(DEVANAGARI_PATTERN.findall(text))
    hindi_latin_count = sum(1 for w in words if w in HINDI_LATIN_WORDS)
    total_words = len(words)

    if devanagari_count > 0:
        # Pure Devanagari script detected
        hindi_ratio = min(80, 40 + devanagari_count * 5)
        english_ratio = max(5, 100 - hindi_ratio - 15)
        hinglish_ratio = 100 - hindi_ratio - english_ratio
    elif hindi_latin_count > 0:
        # Romanized Hindi words detected
        hindi_word_pct = (hindi_latin_count / total_words) * 100
        if hindi_word_pct > 60:
            hindi_ratio = 55
            english_ratio = 15
            hinglish_ratio = 30
        elif hindi_word_pct > 30:
            hindi_ratio = 35
            english_ratio = 25
            hinglish_ratio = 40
        else:
            hindi_ratio = 20
            english_ratio = 45
            hinglish_ratio = 35
    else:
        # Mostly English
        hindi_ratio = 10
        english_ratio = 70
        hinglish_ratio = 20

    return {
        "hindi": round(hindi_ratio),
        "english": round(english_ratio),
        "hinglish": round(hinglish_ratio),
    }


def compute_rolling_style(turns: List[ConversationTurn]) -> str:
    """
    Determine style mode based on rolling window of last 3-4 patient turns.
    Uses 3 discrete modes — no smooth blending.
    """
    patient_turns = [t for t in turns if t.role == "patient"][-4:]

    if not patient_turns:
        return StyleMode.HINGLISH_CASUAL

    avg_hindi = sum(t.language_ratios.get("hindi", 33) for t in patient_turns) / len(patient_turns)
    avg_english = sum(t.language_ratios.get("english", 33) for t in patient_turns) / len(patient_turns)

    if avg_hindi > 55:
        return StyleMode.FORMAL_HINDI
    elif avg_english > 55:
        return StyleMode.ENGLISH_PROFESSIONAL
    else:
        return StyleMode.HINGLISH_CASUAL


def detect_red_flags(text: str, accumulated_text: str = "") -> List[str]:
    """
    Template-based red flag detection.
    Uses pre-validated keyword patterns, NOT free LLM generation.
    """
    combined = f"{accumulated_text} {text}".lower()
    flags = []

    for pattern in RED_FLAG_PATTERNS:
        # Check exact phrase matches first
        primary_match = any(kw in combined for kw in pattern["keywords"])

        # Also check keyword pairs (words that appear anywhere in text)
        if not primary_match and "keyword_pairs" in pattern:
            for pair in pattern["keyword_pairs"]:
                if all(word in combined for word in pair):
                    primary_match = True
                    break

        if not primary_match:
            continue

        # If modifiers exist, at least one must also match for high-confidence flag
        if pattern["modifiers"]:
            modifier_match = any(mod in combined for mod in pattern["modifiers"])
            if modifier_match:
                flags.append(f"[{pattern['severity']}] {pattern['alert']}")
            else:
                # Still flag but at lower severity if no modifier
                flags.append(f"[MODERATE] {pattern['alert']}")
        else:
            flags.append(f"[{pattern['severity']}] {pattern['alert']}")

    return flags


# ── ACI Engine ────────────────────────────────────────────────────────────────

class ACIEngine:
    """
    Main ACI Engine. Manages sessions and processes conversation turns.
    """

    def __init__(self):
        self._sessions: Dict[str, ACISession] = {}

    def create_session(self, patient_id: str, language: str = "hinglish") -> ACISession:
        """Create a new conversation session."""
        session = ACISession(
            session_id=f"aci-{uuid.uuid4().hex[:8]}",
            patient_id=patient_id,
            language_preference=language,
            current_style=self._language_to_style(language),
        )
        self._sessions[session.session_id] = session
        logger.info("[ACI] Session created: %s for patient %s", session.session_id, patient_id)
        return session

    def get_session(self, session_id: str) -> Optional[ACISession]:
        """Get session by ID."""
        return self._sessions.get(session_id)

    def get_greeting(self, session: ACISession) -> Dict[str, Any]:
        """Get the initial greeting in the appropriate style."""
        q = CLINICAL_QUESTIONS[0]
        style = session.current_style
        text = q.get(style, q["hinglish_casual"])
        return {"text": text, "touch_options": q["touch_options"]}

    async def process_turn(
        self, session_id: str, patient_text: str
    ) -> Dict[str, Any]:
        """
        Process one patient turn:
        1. Detect language ratios
        2. Update rolling style
        3. Store patient response as field value
        4. Check red flags
        5. Get next question in matched style
        6. Return response
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # 1. Detect language
        ratios = detect_language_ratios(patient_text)

        # 2. Store patient turn
        patient_turn = ConversationTurn(
            role="patient",
            text=patient_text,
            language_ratios=ratios,
        )
        session.turns.append(patient_turn)

        # 3. Update style based on rolling window
        new_style = compute_rolling_style(session.turns)
        session.current_style = new_style
        session.language_ratios = ratios

        # 4. Store the clinical field value
        current_q_index = session.current_question_index
        if current_q_index < len(CLINICAL_QUESTIONS):
            field_name = CLINICAL_QUESTIONS[current_q_index]["field"]
            session.clinical_fields_collected[field_name] = patient_text

        # 5. Check red flags (accumulated context)
        all_patient_text = " ".join(t.text for t in session.turns if t.role == "patient")
        new_flags = detect_red_flags(patient_text, all_patient_text)
        for flag in new_flags:
            if flag not in session.red_flags_detected:
                session.red_flags_detected.append(flag)

        # 6. Advance to next question
        session.current_question_index += 1
        next_index = session.current_question_index

        if next_index >= len(CLINICAL_QUESTIONS):
            # Conversation complete
            session.is_complete = True
            completion_messages = {
                StyleMode.FORMAL_HINDI: "Dhanyavaad. Aapki poori jaankari le li gayi hai. Summary tayyar ho rahi hai.",
                StyleMode.HINGLISH_CASUAL: "Thank you! Sab information mil gayi. Summary generate ho raha hai.",
                StyleMode.ENGLISH_PROFESSIONAL: "Thank you. All clinical information has been captured. Generating your summary now.",
            }
            ai_response = completion_messages.get(new_style, completion_messages[StyleMode.HINGLISH_CASUAL])
            touch_options = []
            field_collected = "complete"
        else:
            # Get next question in current style
            next_q = CLINICAL_QUESTIONS[next_index]
            ai_response = next_q.get(new_style, next_q["hinglish_casual"])
            touch_options = next_q["touch_options"]
            field_collected = next_q["field"]

        # Store system turn
        system_turn = ConversationTurn(
            role="system",
            text=ai_response,
            style_mode=new_style,
            field=field_collected,
        )
        session.turns.append(system_turn)

        # Calculate progress
        progress = min(100, int((session.current_question_index / len(CLINICAL_QUESTIONS)) * 100))

        return {
            "ai_response": ai_response,
            "style_mode": new_style,
            "language_ratios": ratios,
            "field_collected": field_collected,
            "red_flags": session.red_flags_detected,
            "progress_pct": progress,
            "is_complete": session.is_complete,
            "touch_options": touch_options,
        }

    @staticmethod
    def _language_to_style(language: str) -> str:
        mapping = {
            "hindi": StyleMode.FORMAL_HINDI,
            "english": StyleMode.ENGLISH_PROFESSIONAL,
            "hinglish": StyleMode.HINGLISH_CASUAL,
        }
        return mapping.get(language, StyleMode.HINGLISH_CASUAL)
