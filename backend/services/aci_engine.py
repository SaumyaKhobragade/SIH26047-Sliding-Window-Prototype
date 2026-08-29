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
  5. The clinical record is ALWAYS standardized English, whatever the patient spoke

Language-detection model (rewritten)
------------------------------------
The previous version computed `hinglish = 100 - hindi - english` while hindi and
english already summed to 100, so the hinglish bar was permanently ~0 and
hinglish_casual was effectively unreachable. Worse, Hindi *function* words
("hai", "ho", "raha", "mein") dominate any code-mixed sentence, so ordinary
Hinglish read as 80%+ Hindi and the kiosk answered in formal Hindi.

Now: classify each token, derive two shares that sum to 100 (hindi_share,
english_share), then a standard code-mixing index

    mix = 2 * min(hindi_share, english_share)     # 100 at a 50/50 mix, 0 when pure

The three display ratios are `mix` plus the remainder split by dominance, so all
three modes are reachable and the numbers are monotone and explainable.
"""

import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from enum import Enum

from services.llm_client import llm_complete
from services.persistence import db

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Style Modes ───────────────────────────────────────────────────────────────

class StyleMode(str, Enum):
    FORMAL_HINDI = "formal_hindi"
    HINGLISH_CASUAL = "hinglish_casual"
    ENGLISH_PROFESSIONAL = "english_professional"


ALL_STYLES = (
    StyleMode.FORMAL_HINDI.value,
    StyleMode.HINGLISH_CASUAL.value,
    StyleMode.ENGLISH_PROFESSIONAL.value,
)


# ── Session State ─────────────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    role: str  # "patient" or "system"
    text: str
    language_ratios: Dict[str, float] = {}
    hindi_share: float = 0.0
    english_share: float = 0.0
    mix_index: float = 0.0
    style_mode: str = ""
    field: str = ""


class ACISession(BaseModel):
    session_id: str
    patient_id: str
    language_preference: str = "hinglish"
    turns: List[ConversationTurn] = []
    current_style: str = StyleMode.HINGLISH_CASUAL.value
    # Rolling-window ratios (what the UI bar shows) — NOT just the last turn.
    language_ratios: Dict[str, float] = {"hindi": 33, "english": 33, "hinglish": 34}
    clinical_fields_collected: Dict[str, str] = {}
    # Verbatim patient answers, kept for provenance/audit. The clinical record
    # above is always normalized English; this is what they actually said.
    raw_answers: Dict[str, str] = {}
    # Per-field record of how the English text was produced: "llm" | "rules" | "verbatim"
    normalization_source: Dict[str, str] = {}
    current_question_index: int = 0
    red_flags_detected: List[str] = []
    style_history: List[str] = []
    is_complete: bool = False


# ── Touch Options (style-matched) ─────────────────────────────────────────────
# Every option used to be English, so a Hindi-speaking patient tapping a button
# injected an all-English turn and flipped the kiosk into English mode. Options
# are now written in the patient's current script, and CANONICAL_OPTION maps
# every variant back to one clean English clinical phrase.

TOUCH_OPTIONS: Dict[str, Dict[str, List[str]]] = {
    "chief_complaint": {
        "formal_hindi": ["सीने में दर्द", "सिर दर्द", "पेट दर्द", "बुखार", "कमर दर्द", "सांस लेने में तकलीफ", "अन्य"],
        "hinglish_casual": ["Chest pain", "Sir dard", "Pet dard", "Bukhar", "Kamar dard", "Saans ki problem", "Kuch aur"],
        "english_professional": ["Chest pain", "Headache", "Abdominal pain", "Fever", "Back pain", "Breathing difficulty", "Other"],
    },
    "onset": {
        "formal_hindi": ["आज से", "कल से", "२-३ दिन से", "एक हफ्ते से", "एक हफ्ते से ज्यादा", "कई महीनों से"],
        "hinglish_casual": ["Aaj se", "Kal se", "2-3 din se", "1 hafte se", "1 hafte se zyada", "Kai mahine se"],
        "english_professional": ["Today", "Since yesterday", "2-3 days", "1 week", "More than a week", "Several months"],
    },
    "character": {
        "formal_hindi": ["तेज चुभने वाला", "हल्का दर्द", "जलन", "भारीपन / दबाव", "धड़कता हुआ", "ऐंठन"],
        "hinglish_casual": ["Sharp/chubhne wala", "Halka dard", "Jalan", "Bhaaripan/pressure", "Dhadakta hua", "Ainthan"],
        "english_professional": ["Sharp/stabbing", "Dull/aching", "Burning", "Pressure/heaviness", "Throbbing", "Cramping"],
    },
    "radiation": {
        "formal_hindi": ["बाएं हाथ में", "दाएं हाथ में", "जबड़े या गर्दन में", "पीठ में", "कंधे में", "कहीं नहीं फैलता"],
        "hinglish_casual": ["Left haath mein", "Right haath mein", "Jaw ya neck mein", "Peeth mein", "Kandhe mein", "Kahin nahi jaata"],
        "english_professional": ["Left arm", "Right arm", "Jaw/neck", "Back", "Shoulder", "No spreading"],
    },
    "associated_symptoms": {
        "formal_hindi": ["बुखार", "उल्टी / जी मिचलाना", "चक्कर", "सांस फूलना", "पसीना", "कुछ और नहीं"],
        "hinglish_casual": ["Bukhar", "Ulti/matli", "Chakkar", "Saans phoolna", "Pasina", "Kuch aur nahi"],
        "english_professional": ["Fever", "Nausea/vomiting", "Dizziness", "Breathlessness", "Sweating", "None"],
    },
    "timing": {
        "formal_hindi": ["लगातार रहता है", "आता जाता है", "सिर्फ कुछ समय पर", "बढ़ता जा रहा है"],
        "hinglish_casual": ["Lagataar rehta hai", "Aata jaata hai", "Sirf kuch time pe", "Badhta ja raha hai"],
        "english_professional": ["Constant", "Comes and goes", "Only at certain times", "Getting worse"],
    },
    "exacerbating": {
        "formal_hindi": ["चलने पर बढ़ता है", "खाने पर बढ़ता है", "आराम से कम होता है", "कोई फर्क नहीं", "रात में बढ़ता है"],
        "hinglish_casual": ["Chalne pe badhta hai", "Khane pe badhta hai", "Aaram se kam hota hai", "Koi farak nahi", "Raat mein badhta hai"],
        "english_professional": ["Worse with movement", "Worse with eating", "Better with rest", "No change", "Worse at night"],
    },
    "severity": {
        "formal_hindi": ["१-३ (हल्का)", "४-६ (मध्यम)", "७-८ (तेज)", "९-१० (बहुत तेज)"],
        "hinglish_casual": ["1-3 (Halka)", "4-6 (Medium)", "7-8 (Tez)", "9-10 (Bahut tez)"],
        "english_professional": ["1-3 (Mild)", "4-6 (Moderate)", "7-8 (Severe)", "9-10 (Very severe)"],
    },
    "past_medical": {
        "formal_hindi": ["मधुमेह (शुगर)", "उच्च रक्तचाप (बीपी)", "हृदय रोग", "थायरॉइड", "दमा / अस्थमा", "कोई नहीं"],
        "hinglish_casual": ["Diabetes/sugar", "BP/hypertension", "Heart problem", "Thyroid", "Asthma", "Kuch nahi"],
        "english_professional": ["Diabetes", "Hypertension", "Heart disease", "Thyroid disorder", "Asthma", "None"],
    },
    "medications": {
        "formal_hindi": ["हाँ, शुगर की दवा", "हाँ, बीपी की दवा", "हाँ, दिल की दवा", "कई दवाइयाँ", "कोई दवा नहीं"],
        "hinglish_casual": ["Haan, sugar ki dawa", "Haan, BP ki dawa", "Haan, heart ki dawa", "Kai dawaiyan", "Koi dawa nahi"],
        "english_professional": ["Yes, for diabetes", "Yes, for blood pressure", "Yes, for heart", "Multiple medications", "No regular medications"],
    },
    "allergies": {
        "formal_hindi": ["कोई एलर्जी नहीं", "दवा से एलर्जी", "खाने से एलर्जी", "पता नहीं"],
        "hinglish_casual": ["Koi allergy nahi", "Dawa se allergy", "Khane se allergy", "Pata nahi"],
        "english_professional": ["No allergies", "Drug allergy", "Food allergy", "Not sure"],
    },
    "family_history": {
        "formal_hindi": ["हृदय रोग", "मधुमेह (शुगर)", "कैंसर", "लकवा / स्ट्रोक", "कुछ खास नहीं"],
        "hinglish_casual": ["Heart problem", "Diabetes/sugar", "Cancer", "Stroke/lakwa", "Kuch khaas nahi"],
        "english_professional": ["Heart disease", "Diabetes", "Cancer", "Stroke", "No significant history"],
    },
    "personal_history": {
        "formal_hindi": ["तंबाकू या शराब नहीं", "बीड़ी / सिगरेट", "तंबाकू / गुटखा", "शराब", "नींद नहीं आती", "भूख कम है"],
        "hinglish_casual": ["Tobacco/alcohol nahi", "Smoking karta hoon", "Tobacco/gutka", "Alcohol", "Neend nahi aati", "Bhookh kam hai"],
        "english_professional": ["No tobacco or alcohol", "Smoking", "Tobacco/gutka", "Alcohol", "Poor sleep", "Poor appetite"],
    },
}

# Every touch-option label (in any script) → the exact English clinical phrase.
# This is what makes the record correct even when the LLM is unreachable.
CANONICAL_OPTION: Dict[str, str] = {
    # chief_complaint
    "सीने में दर्द": "Chest pain", "सिर दर्द": "Headache", "पेट दर्द": "Abdominal pain",
    "बुखार": "Fever", "कमर दर्द": "Back pain", "सांस लेने में तकलीफ": "Breathing difficulty",
    "अन्य": "Other complaint",
    "sir dard": "Headache", "pet dard": "Abdominal pain", "bukhar": "Fever",
    "kamar dard": "Back pain", "saans ki problem": "Breathing difficulty", "kuch aur": "Other complaint",
    # onset
    "आज से": "Started today", "कल से": "Since yesterday", "२-३ दिन से": "2-3 days",
    "एक हफ्ते से": "1 week", "एक हफ्ते से ज्यादा": "More than a week", "कई महीनों से": "Several months",
    "aaj se": "Started today", "kal se": "Since yesterday", "2-3 din se": "2-3 days",
    "1 hafte se": "1 week", "1 hafte se zyada": "More than a week", "kai mahine se": "Several months",
    "today": "Started today",
    # character
    "तेज चुभने वाला": "Sharp, stabbing", "हल्का दर्द": "Dull, aching", "जलन": "Burning",
    "भारीपन / दबाव": "Pressure, heaviness", "धड़कता हुआ": "Throbbing", "ऐंठन": "Cramping",
    "sharp/chubhne wala": "Sharp, stabbing", "halka dard": "Dull, aching", "jalan": "Burning",
    "bhaaripan/pressure": "Pressure, heaviness", "dhadakta hua": "Throbbing", "ainthan": "Cramping",
    "sharp/stabbing": "Sharp, stabbing", "dull/aching": "Dull, aching",
    "pressure/heaviness": "Pressure, heaviness",
    # radiation
    "बाएं हाथ में": "Radiates to left arm", "दाएं हाथ में": "Radiates to right arm",
    "जबड़े या गर्दन में": "Radiates to jaw and neck", "पीठ में": "Radiates to back",
    "कंधे में": "Radiates to shoulder", "कहीं नहीं फैलता": "No radiation",
    "left haath mein": "Radiates to left arm", "right haath mein": "Radiates to right arm",
    "jaw ya neck mein": "Radiates to jaw and neck", "peeth mein": "Radiates to back",
    "kandhe mein": "Radiates to shoulder", "kahin nahi jaata": "No radiation",
    "left arm": "Radiates to left arm", "right arm": "Radiates to right arm",
    "jaw/neck": "Radiates to jaw and neck", "back": "Radiates to back",
    "shoulder": "Radiates to shoulder", "no spreading": "No radiation",
    # associated symptoms
    "उल्टी / जी मिचलाना": "Nausea and vomiting", "चक्कर": "Dizziness",
    "सांस फूलना": "Breathlessness", "पसीना": "Sweating", "कुछ और नहीं": "None reported",
    "ulti/matli": "Nausea and vomiting", "chakkar": "Dizziness", "saans phoolna": "Breathlessness",
    "pasina": "Sweating", "kuch aur nahi": "None reported",
    "nausea/vomiting": "Nausea and vomiting", "none": "None reported",
    # timing
    "लगातार रहता है": "Constant", "आता जाता है": "Intermittent, comes and goes",
    "सिर्फ कुछ समय पर": "Only at certain times", "बढ़ता जा रहा है": "Progressively worsening",
    "lagataar rehta hai": "Constant", "aata jaata hai": "Intermittent, comes and goes",
    "sirf kuch time pe": "Only at certain times", "badhta ja raha hai": "Progressively worsening",
    "comes and goes": "Intermittent, comes and goes", "getting worse": "Progressively worsening",
    # exacerbating
    "चलने पर बढ़ता है": "Worse with movement", "खाने पर बढ़ता है": "Worse with eating",
    "आराम से कम होता है": "Relieved by rest", "कोई फर्क नहीं": "No aggravating or relieving factors",
    "रात में बढ़ता है": "Worse at night",
    "chalne pe badhta hai": "Worse with movement", "khane pe badhta hai": "Worse with eating",
    "aaram se kam hota hai": "Relieved by rest", "koi farak nahi": "No aggravating or relieving factors",
    "raat mein badhta hai": "Worse at night",
    "better with rest": "Relieved by rest", "no change": "No aggravating or relieving factors",
    # severity
    "१-३ (हल्का)": "2/10 (mild)", "४-६ (मध्यम)": "5/10 (moderate)",
    "७-८ (तेज)": "7/10 (severe)", "९-१० (बहुत तेज)": "9/10 (very severe)",
    "1-3 (halka)": "2/10 (mild)", "4-6 (medium)": "5/10 (moderate)",
    "7-8 (tez)": "7/10 (severe)", "9-10 (bahut tez)": "9/10 (very severe)",
    "1-3 (mild)": "2/10 (mild)", "4-6 (moderate)": "5/10 (moderate)",
    "7-8 (severe)": "7/10 (severe)", "9-10 (very severe)": "9/10 (very severe)",
    # past medical
    "मधुमेह (शुगर)": "Diabetes mellitus", "उच्च रक्तचाप (बीपी)": "Hypertension",
    "हृदय रोग": "Heart disease", "थायरॉइड": "Thyroid disorder", "दमा / अस्थमा": "Asthma",
    "कोई नहीं": "None reported",
    "diabetes/sugar": "Diabetes mellitus", "bp/hypertension": "Hypertension",
    "heart problem": "Heart disease", "thyroid": "Thyroid disorder", "asthma": "Asthma",
    "kuch nahi": "None reported",
    "diabetes": "Diabetes mellitus", "hypertension": "Hypertension",
    "heart disease": "Heart disease", "thyroid disorder": "Thyroid disorder",
    # medications
    "हाँ, शुगर की दवा": "Anti-diabetic medication (name not specified)",
    "हाँ, बीपी की दवा": "Antihypertensive medication (name not specified)",
    "हाँ, दिल की दवा": "Cardiac medication (name not specified)",
    "कई दवाइयाँ": "Multiple medications (names not specified)",
    "कोई दवा नहीं": "No regular medications",
    "haan, sugar ki dawa": "Anti-diabetic medication (name not specified)",
    "haan, bp ki dawa": "Antihypertensive medication (name not specified)",
    "haan, heart ki dawa": "Cardiac medication (name not specified)",
    "kai dawaiyan": "Multiple medications (names not specified)",
    "koi dawa nahi": "No regular medications",
    "yes, for diabetes": "Anti-diabetic medication (name not specified)",
    "yes, for blood pressure": "Antihypertensive medication (name not specified)",
    "yes, for heart": "Cardiac medication (name not specified)",
    "multiple medications": "Multiple medications (names not specified)",
    "no regular medications": "No regular medications", "no regular meds": "No regular medications",
    # allergies
    "कोई एलर्जी नहीं": "No known allergies", "दवा से एलर्जी": "Drug allergy reported",
    "खाने से एलर्जी": "Food allergy reported", "पता नहीं": "Patient unsure",
    "koi allergy nahi": "No known allergies", "dawa se allergy": "Drug allergy reported",
    "khane se allergy": "Food allergy reported", "pata nahi": "Patient unsure",
    "no allergies": "No known allergies", "drug allergy": "Drug allergy reported",
    "medicine allergy": "Drug allergy reported", "food allergy": "Food allergy reported",
    "not sure": "Patient unsure",
    # family history
    "कैंसर": "Cancer", "लकवा / स्ट्रोक": "Stroke", "कुछ खास नहीं": "None reported",
    "stroke/lakwa": "Stroke", "kuch khaas nahi": "None reported",
    "cancer": "Cancer", "stroke": "Stroke", "no significant history": "None reported",
    # personal history
    "तंबाकू या शराब नहीं": "No tobacco or alcohol use",
    "बीड़ी / सिगरेट": "Smoker (bidi/cigarette)", "तंबाकू / गुटखा": "Smokeless tobacco (gutka) use",
    "शराब": "Alcohol use", "नींद नहीं आती": "Disturbed sleep", "भूख कम है": "Reduced appetite",
    "tobacco/alcohol nahi": "No tobacco or alcohol use",
    "smoking karta hoon": "Smoker (bidi/cigarette)", "tobacco/gutka": "Smokeless tobacco (gutka) use",
    "alcohol": "Alcohol use", "neend nahi aati": "Disturbed sleep", "bhookh kam hai": "Reduced appetite",
    "no tobacco or alcohol": "No tobacco or alcohol use", "smoking": "Smoker (bidi/cigarette)",
    "poor sleep": "Disturbed sleep", "poor appetite": "Reduced appetite",
}


# ── Clinical Question Graph (SOCRATES Framework) ─────────────────────────────
# Each question has variants in all 3 style modes. Touch options come from
# TOUCH_OPTIONS via touch_options_for().

CLINICAL_QUESTIONS = [
    {
        "field": "chief_complaint",
        "formal_hindi": "Aapko kya taklif ho rahi hai? Kripya apni mukhya samasya bataiye.",
        "hinglish_casual": "Kya problem ho raha hai aapko? Batao kya hua.",
        "english_professional": "What is your main concern today? Please describe your primary symptom.",
    },
    {
        "field": "onset",
        "formal_hindi": "Yeh samasya kab se hai? Kitne din ya ghante pehle shuru hui?",
        "hinglish_casual": "Yeh kab se ho raha hai? Kal se? Last week se?",
        "english_professional": "When did this start? How long have you been experiencing this?",
    },
    {
        "field": "character",
        "formal_hindi": "Yeh dard kaisa hai? Tez hai, halka hai, ya jalan jaisa?",
        "hinglish_casual": "Pain kaise hai — sharp hai, dull hai, ya burning type?",
        "english_professional": "Can you describe the nature of the pain? Is it sharp, dull, burning, or pressure-like?",
    },
    {
        "field": "radiation",
        "formal_hindi": "Kya yeh dard kisi aur jagah tak jaata hai? Haath, jaw, ya peeth mein?",
        "hinglish_casual": "Yeh pain kahi aur bhi jaata hai? Arm mein, jaw mein, ya back mein?",
        "english_professional": "Does the pain radiate or spread to any other area? Such as your arm, jaw, or back?",
    },
    {
        "field": "associated_symptoms",
        "formal_hindi": "Iske saath koi aur lakshan bhi hain? Bukhar, ulti, chakkar?",
        "hinglish_casual": "Aur kuch symptoms hain? Fever, vomiting, dizziness type kuch?",
        "english_professional": "Are there any associated symptoms? Such as fever, nausea, dizziness, or shortness of breath?",
    },
    {
        "field": "timing",
        "formal_hindi": "Yeh dard lagatar hai ya aata jaata hai?",
        "hinglish_casual": "Constant hai ya on-off hota hai?",
        "english_professional": "Is the pain constant or does it come and go?",
    },
    {
        "field": "exacerbating",
        "formal_hindi": "Kya karne se dard badhta hai? Aur kya karne se kam hota hai?",
        "hinglish_casual": "Kya karne pe badhta hai? Aur kya karne pe kam hota hai? Walking, eating, resting?",
        "english_professional": "What makes it worse? And what provides relief? Activity, rest, food?",
    },
    {
        "field": "severity",
        "formal_hindi": "1 se 10 ke scale pe, kitna dard hai? 1 matlab bahut kam, 10 matlab asahniya.",
        "hinglish_casual": "Scale of 1-10 pe kitna hai? 1 = mild, 10 = worst ever?",
        "english_professional": "On a scale of 1 to 10, how severe is the pain? 1 being minimal, 10 being the worst.",
    },
    {
        "field": "past_medical",
        "formal_hindi": "Kya aapko pehle se koi bimari hai? Diabetes, BP, heart, kuch bhi?",
        "hinglish_casual": "Koi purani bimari? Diabetes, BP, thyroid, kuch hai?",
        "english_professional": "Do you have any pre-existing medical conditions? Diabetes, hypertension, heart disease?",
    },
    {
        "field": "medications",
        "formal_hindi": "Kya aap abhi koi dawai niyamit roop se le rahe hain?",
        "hinglish_casual": "Koi regular medicine chal rahi hai? Kya lete ho daily?",
        "english_professional": "Are you currently taking any regular medications? Please list them with dosages if possible.",
    },
    {
        "field": "allergies",
        "formal_hindi": "Kya aapko kisi dawai ya khaane se allergy hai?",
        "hinglish_casual": "Koi allergy hai? Medicine ya food se kuch?",
        "english_professional": "Do you have any known allergies to medications, food, or other substances?",
    },
    {
        "field": "family_history",
        "formal_hindi": "Kya aapke parivaar mein kisi ko heart disease, diabetes, ya cancer hai?",
        "hinglish_casual": "Family mein kisi ko heart problem, diabetes, ya kuch serious hai?",
        "english_professional": "Is there any significant family history? Heart disease, diabetes, cancer, or stroke?",
    },
    {
        # Personal history was in the summary schema but no question ever asked
        # it, so the doctor's report always said "Not assessed".
        "field": "personal_history",
        "formal_hindi": "Kya aap tambaku, gutka, ya sharab ka sevan karte hain? Aur aapki neend kaisi hai?",
        "hinglish_casual": "Smoking, tobacco ya alcohol ki habit hai? Neend aur bhookh theek hai?",
        "english_professional": "Do you use tobacco, gutka, or alcohol? And how are your sleep and appetite?",
    },
]

TOTAL_QUESTIONS = len(CLINICAL_QUESTIONS)


def _seed_canonical_from_options() -> None:
    """
    Every english_professional option is ALREADY a clean clinical phrase, so it
    is its own canonical form. Auto-seeding them keeps the table from silently
    drifting when a new option is added: with no entry, an English tap fell
    through to an LLM round-trip to "normalize" text that needed no change, and
    if the LLM was unreachable it was logged as unverified.
    """
    for styles in TOUCH_OPTIONS.values():
        for options in styles.values():
            for option in options:
                if option.isascii() and option not in CANONICAL_OPTION:
                    CANONICAL_OPTION[option] = (
                        "Other complaint" if option == "Other" else option
                    )


_seed_canonical_from_options()

# Case-insensitive lookup built once. Keys in CANONICAL_OPTION are a mix of
# lowercase romanisation and as-written Devanagari/Title Case.
_CANON_LOOKUP: Dict[str, str] = {
    key.strip().lower(): value for key, value in CANONICAL_OPTION.items()
}


def touch_options_for(field: str, style: str) -> List[str]:
    """Touch options for a field in the patient's current style."""
    per_field = TOUCH_OPTIONS.get(field)
    if not per_field:
        return []
    style = style if style in per_field else StyleMode.HINGLISH_CASUAL.value
    return list(per_field[style])


def canonical_for_option(text: str) -> Optional[str]:
    """English clinical phrase for a known touch-option label, else None."""
    return _CANON_LOOKUP.get((text or "").strip().lower())


# ── Red Flag Keywords ─────────────────────────────────────────────────────────
# Template-based, NOT free LLM generation — this is the safety guarantee

RED_FLAG_PATTERNS = [
    {
        "keywords": [
            "chest pain", "chest mein pain", "chest mein dard", "chati", "chhati",
            "seene mein", "sine mein", "seene mein dard", "सीने में दर्द", "छाती",
        ],
        "keyword_pairs": [["chest", "pain"], ["chest", "dard"], ["seene", "dard"], ["सीने", "दर्द"]],
        "modifiers": [
            "left arm", "left haath", "baye haath", "left side", "jaw", "jabda", "jabde",
            "breathless", "saans", "sans", "sweating", "pasina", "radiat", "shoulder",
            "बाएं हाथ", "जबड़े", "पसीना", "सांस",
        ],
        "alert": "Chest pain with possible cardiac symptoms — recommend immediate ECG + Troponin",
        "severity": "HIGH",
    },
    {
        "keywords": ["unconscious", "behosh", "faint", "gir gaya", "gir gayi", "बेहोश", "चक्कर आकर गिर"],
        "modifiers": [],
        "alert": "Loss of consciousness / syncope — immediate medical attention needed",
        "severity": "HIGH",
    },
    {
        "keywords": ["paralysis", "lakwa", "lakva", "stroke", "face droop", "speech slurred", "लकवा"],
        "modifiers": ["sudden", "achanak", "ek taraf", "one side", "अचानक", "एक तरफ"],
        "alert": "Possible stroke symptoms — activate stroke protocol (FAST)",
        "severity": "CRITICAL",
    },
    {
        "keywords": ["blood", "khoon", "bleeding", "vomiting blood", "khoon ki ulti", "खून"],
        "modifiers": ["severe", "bahut", "heavy", "ulti", "vomit", "stool", "बहुत", "उल्टी"],
        "alert": "Active bleeding / hematemesis — immediate assessment needed",
        "severity": "HIGH",
    },
    {
        "keywords": ["seizure", "daura", "fits", "convulsion", "jhatkay", "jhatke", "मिर्गी", "दौरा"],
        "modifiers": [],
        "alert": "Seizure / convulsion episode — immediate neurological assessment",
        "severity": "HIGH",
    },
    {
        "keywords": [
            "suicidal", "suicide", "marna chahta", "marna chahti", "jeene ka mann nahi",
            "harm myself", "khudkhushi", "आत्महत्या",
        ],
        "modifiers": [],
        "alert": "Psychiatric emergency — immediate mental health assessment",
        "severity": "CRITICAL",
    },
]


# ── Language Detection ────────────────────────────────────────────────────────

DEVANAGARI_PATTERN = re.compile(r'[ऀ-ॿ]')
_WORD_SPLIT = re.compile(r"[^\wऀ-ॿ]+", re.UNICODE)
_NUMERIC = re.compile(r"^[\d०-९]+([./-][\d०-९]+)*$")

# Romanised Hindi lexicon. Deliberately explicit and auditable — the previous
# prefix heuristic ("startswith('le')", "startswith('ho')") classified English
# words like "left", "leg", "less", "home", "hot", "how", "hour" as Hindi, which
# is what dragged every utterance toward formal Hindi.
HINDI_LATIN_WORDS = {
    # pronouns / determiners
    "mai", "mein", "hum", "ham", "hamko", "hamein", "tum", "tu", "aap", "aapko",
    "aapka", "aapki", "aapke", "mera", "meri", "mere", "mujhe", "mujhko", "muje",
    "tera", "teri", "tere", "tumhe", "tumhara", "uska", "uski", "uske", "unka",
    "unki", "iska", "iski", "iske", "apna", "apni", "apne", "wo", "woh", "ye",
    "yeh", "kaun", "kaunsa", "kya", "kyu", "kyun", "kyunki", "kab", "kaise",
    "kaisa", "kaisi", "kahan", "kahaan", "kitna", "kitni", "kitne", "kis",
    "jab", "jo", "jise", "jiske", "koi", "kuch", "kuchh", "sab", "sabhi", "har",
    "dono", "sabse",
    # postpositions / particles / conjunctions
    "ka", "ki", "ke", "ko", "se", "par", "pe", "tak", "bhi", "nahi", "nahin",
    "nai", "aur", "ya", "lekin", "magar", "phir", "fir", "abhi", "ab", "agar",
    "warna", "waise", "aise", "aisa", "aisi", "jaisa", "jaise", "wala", "wali",
    "wale", "liye", "saath", "sath", "bina", "andar", "bahar", "upar", "neeche",
    "aage", "peeche", "paas", "samne", "beech", "matlab", "bilkul", "zaroor",
    "zarur", "shayad", "khaas", "farak", "farq",
    # verbs
    "hai", "hain", "ho", "hoon", "hu", "hun", "hota", "hoti", "hote", "hua",
    "hui", "tha", "thi", "raha", "rahi", "rahe", "rha", "rhi", "rehta", "rehti",
    "karna", "karta", "karti", "karte", "karo", "kiya", "kiye", "kar", "karu",
    "karunga", "karungi", "karenge", "lagta", "lagti", "lagte", "laga", "lagi",
    "lage", "lag", "jaata", "jata", "jaati", "jati", "jaate", "jate", "gaya",
    "gayi", "gaye", "jaana", "jana", "jao", "aata", "aati", "aate", "aaya",
    "aayi", "aaye", "aana", "aao", "dena", "deta", "deti", "dete", "diya",
    "lena", "leta", "leti", "lete", "liya", "lo", "le", "khana", "khata",
    "khati", "khate", "khaya", "kha", "peena", "pina", "pita", "piya", "bolna",
    "bolta", "bataiye", "bataye", "batao", "bata", "bataya", "samajh", "samjha",
    "sunna", "sunta", "dekhna", "dekhta", "dekha", "milta", "milti", "mila",
    "mili", "sakta", "sakti", "sakte", "chahiye", "chahta", "chahti", "padta",
    "padti", "pada", "badhta", "badhti", "badha", "badh", "ghatta", "sona",
    "sota", "soti", "soya", "uthna", "uthta", "utha", "baithna", "baitha",
    "chalna", "chalta", "chalti", "chal", "rukna", "ruka", "hoga", "hogi",
    "honge", "shuru", "khatam", "phoolna", "sevan",
    # symptoms / anatomy
    "dard", "sardard", "sirdard", "bukhar", "jukam", "khansi", "khasi", "ulti",
    "ultee", "matli", "chakkar", "kamzori", "kamjori", "thakan", "saans", "sans",
    "pasina", "khoon", "pet", "sar", "seena", "seene", "chhati", "chati",
    "chaati", "kamar", "peeth", "pith", "gala", "aankh", "aankhein", "kaan",
    "naak", "muh", "munh", "daant", "haath", "hath", "pair", "paon", "ghutna",
    "ungli", "kandha", "kandhe", "jabda", "jabde", "jod", "jodon", "haddi",
    "nas", "dil", "kaleja", "gurda", "jigar", "pathri", "sujan", "sooj",
    "jalan", "jalna", "ghav", "chot", "phoda", "khujli", "kharish", "dast",
    "kabz", "tez", "halka", "halki", "bhaari", "bhaaripan", "ainthan",
    "chubhne", "dhadakta", "lakshan", "behosh", "lakwa", "lakva", "daura",
    "jhatke", "jhatkay", "khudkhushi",
    # care / medicines
    "dawa", "dawai", "dawaiyan", "goli", "goliyan", "sui", "ilaj", "ilaaj",
    "jaanch", "janch", "aspatal", "bimari", "bimaari", "rog", "aaram", "aram",
    "taklif", "takleef", "pareshani", "samasya", "chinta", "neend", "bhukh",
    "bhookh", "pyaas", "pyas", "tambaku", "sharab", "gutka", "beedi", "niyamit",
    # time
    "aaj", "kal", "parso", "subah", "savere", "dopahar", "shaam", "sham",
    "raat", "din", "dino", "dinon", "hafta", "hafte", "haftey", "mahina",
    "mahine", "saal", "sal", "ghanta", "ghante", "ghanton", "samay", "waqt",
    "roz", "rozana", "hamesha", "kabhi", "pehle", "pahle", "baad", "turant",
    "jaldi", "dheere", "lagataar", "lagatar", "purani", "purana",
    # quantity / answers
    "bahut", "bhut", "bohot", "boht", "zyada", "jyada", "adhik", "kam", "thoda",
    "thodi", "thora", "kafi", "kaafi", "itna", "utna", "poora", "pura", "poori",
    "aadha", "adha", "sirf", "bas", "sara", "saara", "haan", "han", "hanji",
    "ji", "theek", "thik", "sahi", "galat", "accha", "achha", "achcha",
    "badhiya", "dhanyavaad", "namaste", "shukriya", "kripya",
    # family
    "maa", "mata", "pita", "papa", "mummy", "ammi", "abba", "bhai", "behen",
    "bahan", "beta", "beti", "patni", "pati", "dadi", "nani", "chacha", "chachi",
    "mami", "bua", "ghar", "parivar", "pariwar", "khandaan",
}

# Tokens that are real words in BOTH languages. Counting them either way skews
# the ratio, so they are excluded from the denominator entirely.
AMBIGUOUS_WORDS = {
    "is", "in", "us", "me", "main", "do", "hi", "tab", "hue", "mat", "sir",
    "to", "the", "gas", "ok", "okay", "hmm", "haa", "no", "so", "or", "at",
    "on", "of", "it", "am", "a", "an", "as", "be", "he", "up",
}

# English words that the phonotactic fallback below would otherwise mislabel.
ENGLISH_VETO = {
    "khaki", "abhor", "adhere", "adhesive", "aardvark", "bazaar", "salaam",
    "jharkhand", "bhutan", "naan", "withhold", "handheld", "childhood",
    "khan", "bhutto", "aaa",
}

# Digraphs that are common in romanised Hindi and vanishingly rare in English.
# Catches unlisted Hindi content words ("khujli", "bhaari", "jhatka", "aaram")
# without touching clinical English ("chest", "pain", "fever", "breathing").
_HINDI_PHONOTACTICS = ("jh", "chh", "bh", "kh", "aa", "dh")


def _classify_word(w: str) -> str:
    """Return 'hindi', 'english' or 'skip' for a single token."""
    if DEVANAGARI_PATTERN.search(w):
        return "hindi"
    if _NUMERIC.match(w) or len(w) <= 1:
        return "skip"
    if w in AMBIGUOUS_WORDS:
        return "skip"
    if w in HINDI_LATIN_WORDS:
        return "hindi"
    if w in ENGLISH_VETO:
        return "english"
    if any(d in w for d in _HINDI_PHONOTACTICS):
        return "hindi"
    return "english"


def analyze_language(text: str) -> Dict[str, float]:
    """
    Token-level language analysis.

    Returns hindi_share / english_share (summing to 100 over language-bearing
    tokens), the code-mixing index, and the three display ratios.
    """
    words = [w for w in _WORD_SPLIT.split(text.lower()) if w]
    hindi = english = 0
    for w in words:
        kind = _classify_word(w)
        if kind == "hindi":
            hindi += 1
        elif kind == "english":
            english += 1

    signal = hindi + english
    if signal == 0:
        # Nothing to go on (empty, digits only, or all ambiguous tokens).
        return {
            "hindi_share": 0.0, "english_share": 0.0, "mix_index": 0.0,
            "ratios": {"hindi": 33, "english": 33, "hinglish": 34},
            "tokens": len(words), "signal_tokens": 0,
        }

    hindi_share = hindi / signal * 100
    english_share = english / signal * 100

    # Code-mixing index: 100 for a perfect 50/50 mix, 0 for a pure utterance.
    mix = 2 * min(hindi_share, english_share)

    # Display ratios: the mix takes its share, the remainder splits by dominance.
    remainder = 100 - mix
    ratios = {
        "hindi": round(remainder * hindi_share / 100),
        "english": round(remainder * english_share / 100),
        "hinglish": round(mix),
    }
    # Absorb rounding drift into the largest bucket so the bars sum to 100.
    drift = 100 - sum(ratios.values())
    if drift:
        ratios[max(ratios, key=ratios.get)] += drift

    return {
        "hindi_share": round(hindi_share, 1),
        "english_share": round(english_share, 1),
        "mix_index": round(mix, 1),
        "ratios": ratios,
        "tokens": len(words),
        "signal_tokens": signal,
    }


def detect_language_ratios(text: str) -> Dict[str, float]:
    """Backwards-compatible wrapper returning just the three display ratios."""
    return analyze_language(text)["ratios"]


# Schmitt trigger on the code-mixing index: enter Hinglish at 30, leave below
# 22. Without the gap the mode flapped between Hindi and Hinglish turn to turn.
MIX_ENTER = 30.0
MIX_EXIT = 22.0
# Recency weights over the last WINDOW patient turns.
WINDOW = 4


def _rolling_window(turns: List[ConversationTurn]) -> List[ConversationTurn]:
    return [t for t in turns if t.role == "patient"][-WINDOW:]


def rolling_language(turns: List[ConversationTurn]) -> Dict[str, float]:
    """Recency-weighted aggregate of the window — this is what the UI bar shows."""
    window = _rolling_window(turns)
    if not window:
        return {
            "hindi_share": 0.0, "english_share": 0.0, "mix_index": 0.0,
            "ratios": {"hindi": 33, "english": 33, "hinglish": 34},
        }

    n = len(window)
    weights = [0.4 + 0.6 * (i / max(1, n - 1)) for i in range(n)]
    total = sum(weights)

    h = sum(t.hindi_share * w for t, w in zip(window, weights)) / total
    e = sum(t.english_share * w for t, w in zip(window, weights)) / total
    mix = sum(t.mix_index * w for t, w in zip(window, weights)) / total

    remainder = 100 - mix
    denom = (h + e) or 1.0
    ratios = {
        "hindi": round(remainder * h / denom),
        "english": round(remainder * e / denom),
        "hinglish": round(mix),
    }
    drift = 100 - sum(ratios.values())
    if drift:
        ratios[max(ratios, key=ratios.get)] += drift

    return {
        "hindi_share": round(h, 1),
        "english_share": round(e, 1),
        "mix_index": round(mix, 1),
        "ratios": ratios,
    }


def compute_rolling_style(
    turns: List[ConversationTurn], current_style: Optional[str] = None
) -> str:
    """
    Pick one of 3 discrete style modes from a recency-weighted window of the
    last few patient turns.

    Decision rule (auditable, monotone):
      * substantial code-mixing        → hinglish_casual
      * otherwise the dominant script  → formal_hindi / english_professional

    Because mix = 2*min(h, e), a mix below 30 means one language holds >= 85% of
    the utterance, so the dominance comparison is never a coin flip.
    """
    window = _rolling_window(turns)
    if not window:
        return current_style or StyleMode.HINGLISH_CASUAL.value

    agg = rolling_language(turns)
    mix, h, e = agg["mix_index"], agg["hindi_share"], agg["english_share"]

    in_hinglish = current_style == StyleMode.HINGLISH_CASUAL.value
    threshold = MIX_EXIT if in_hinglish else MIX_ENTER

    if mix >= threshold:
        return StyleMode.HINGLISH_CASUAL.value
    if h > e:
        return StyleMode.FORMAL_HINDI.value
    if e > h:
        return StyleMode.ENGLISH_PROFESSIONAL.value
    return current_style or StyleMode.HINGLISH_CASUAL.value


def detect_red_flags(text: str, accumulated_text: str = "") -> List[str]:
    """
    Template-based red flag detection.
    Uses pre-validated keyword patterns, NOT free LLM generation.

    Design rules:
      - Patterns WITH modifiers: primary keyword must appear in the CURRENT turn
        AND at least one modifier must appear in current OR accumulated text.
        Without a modifier match → do NOT flag. Prevents false positives from
        incidental words like "blood" in past medical history.
      - Patterns WITHOUT modifiers (seizure, syncope, suicide): match on either
        current or accumulated text and fire immediately at full severity.
    """
    current = text.lower()
    combined = f"{accumulated_text} {text}".lower()
    flags = []

    for pattern in RED_FLAG_PATTERNS:
        has_modifiers = bool(pattern["modifiers"])

        if has_modifiers:
            # For modifier-gated patterns: keyword MUST appear in the CURRENT turn
            primary_match = any(kw in current for kw in pattern["keywords"])

            # Check keyword pairs against current turn only
            if not primary_match and "keyword_pairs" in pattern:
                for pair in pattern["keyword_pairs"]:
                    if all(word in current for word in pair):
                        primary_match = True
                        break

            if not primary_match:
                continue

            # Modifier must appear somewhere in current OR accumulated context
            if any(mod in combined for mod in pattern["modifiers"]):
                flags.append(f"[{pattern['severity']}] {pattern['alert']}")
            # else: bare keyword (e.g. "blood") is not enough → do NOT flag.

        else:
            if any(kw in combined for kw in pattern["keywords"]):
                flags.append(f"[{pattern['severity']}] {pattern['alert']}")

    return flags


# ── ACI Engine ────────────────────────────────────────────────────────────────

COMPLETION_MESSAGES = {
    StyleMode.FORMAL_HINDI.value: "Dhanyavaad. Aapki poori jaankari le li gayi hai. Summary tayyar ho rahi hai.",
    StyleMode.HINGLISH_CASUAL.value: "Thank you! Sab information mil gayi. Summary generate ho raha hai.",
    StyleMode.ENGLISH_PROFESSIONAL.value: "Thank you. All clinical information has been captured. Generating your summary now.",
}

REASK_MESSAGES = {
    StyleMode.FORMAL_HINDI.value: "Maaf kijiye, main samajh nahi paaya. Kripya dobara bataiye.",
    StyleMode.HINGLISH_CASUAL.value: "Sorry, samajh nahi aaya. Ek baar phir se bataiye?",
    StyleMode.ENGLISH_PROFESSIONAL.value: "Sorry, I did not catch that. Could you please repeat?",
}


class ACIEngine:
    """
    Main ACI Engine. Manages sessions and processes conversation turns.

    Sessions are cached in memory AND written to disk after every turn. They used
    to be memory-only, so a uvicorn --reload restart mid-interview made
    /summary/generate return 404 "Session not found" and no report was ever
    produced — the headline symptom of "it doesn't generate the report".
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
        session.style_history.append(session.current_style)
        self._sessions[session.session_id] = session
        self._persist(session)
        logger.info(
            "[ACI] Session created: %s for patient %s (style=%s)",
            session.session_id, patient_id, session.current_style,
        )
        return session

    def get_session(self, session_id: str) -> Optional[ACISession]:
        """Get session by ID, rehydrating from disk if it is not in memory."""
        session = self._sessions.get(session_id)
        if session:
            return session

        raw = db.get_session(session_id)
        if not raw:
            return None
        try:
            session = ACISession(**raw)
        except Exception as e:
            logger.error("[ACI] Could not rehydrate session %s: %s", session_id, e)
            return None
        self._sessions[session_id] = session
        logger.info("[ACI] Session %s restored from disk", session_id)
        return session

    def _persist(self, session: ACISession) -> None:
        try:
            db.save_session(session.session_id, session.model_dump())
        except Exception as e:
            # Never fail a live interview because the disk write failed.
            logger.error("[ACI] Failed to persist session %s: %s", session.session_id, e)

    def get_greeting(self, session: ACISession) -> Dict[str, Any]:
        """Get the initial greeting in the appropriate style."""
        q = CLINICAL_QUESTIONS[0]
        style = session.current_style
        return {
            "text": q.get(style, q[StyleMode.HINGLISH_CASUAL.value]),
            "touch_options": touch_options_for(q["field"], style),
        }

    async def process_turn(self, session_id: str, patient_text: str) -> Dict[str, Any]:
        """
        Process one patient turn:
        1. Detect language (token-level + code-mixing index)
        2. Update rolling style
        3. Normalize the answer into the STRICT English clinical record
        4. Check red flags
        5. Ask the next question in the matched style
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        patient_text = (patient_text or "").strip()

        # Already finished — replay the completion state instead of running off
        # the end of the question list.
        if session.is_complete:
            return self._response(
                session,
                ai_response=COMPLETION_MESSAGES.get(
                    session.current_style, COMPLETION_MESSAGES[StyleMode.HINGLISH_CASUAL.value]
                ),
                touch_options=[],
                field_collected="complete",
                field_stored="",
                turn_ratios=session.language_ratios,
            )

        current_index = min(session.current_question_index, TOTAL_QUESTIONS - 1)
        current_field = CLINICAL_QUESTIONS[current_index]["field"]

        # Blank/unintelligible input must NOT consume a clinical question —
        # SOCRATES is never skipped. Re-ask the same one.
        if not patient_text:
            q = CLINICAL_QUESTIONS[current_index]
            reask = REASK_MESSAGES.get(
                session.current_style, REASK_MESSAGES[StyleMode.HINGLISH_CASUAL.value]
            )
            question = q.get(session.current_style, q[StyleMode.HINGLISH_CASUAL.value])
            self._persist(session)
            return self._response(
                session,
                ai_response=f"{reask} {question}",
                touch_options=touch_options_for(current_field, session.current_style),
                field_collected=current_field,
                field_stored="",
                turn_ratios=session.language_ratios,
            )

        # 1. Language analysis for this turn
        analysis = analyze_language(patient_text)

        # 2. Record the patient turn
        session.turns.append(ConversationTurn(
            role="patient",
            text=patient_text,
            language_ratios=analysis["ratios"],
            hindi_share=analysis["hindi_share"],
            english_share=analysis["english_share"],
            mix_index=analysis["mix_index"],
            field=current_field,
        ))

        # 3. Rolling style + rolling ratios (the window, not just this turn)
        previous_style = session.current_style
        new_style = compute_rolling_style(session.turns, previous_style)
        session.current_style = new_style
        session.style_history.append(new_style)
        rolling = rolling_language(session.turns)
        session.language_ratios = rolling["ratios"]

        if new_style != previous_style:
            logger.info(
                "[ACI] %s style %s → %s (mix=%.0f hindi=%.0f english=%.0f)",
                session_id, previous_style, new_style,
                rolling["mix_index"], rolling["hindi_share"], rolling["english_share"],
            )

        # 4. STRICT clinical layer: store standardized English, keep the verbatim
        normalized, source = await normalize_field(current_field, patient_text)
        session.clinical_fields_collected[current_field] = normalized
        session.raw_answers[current_field] = patient_text
        session.normalization_source[current_field] = source

        # 5. Red flags — checked against the verbatim text (patterns cover both
        #    scripts), accumulated across the interview.
        all_patient_text = " ".join(t.text for t in session.turns if t.role == "patient")
        for flag in detect_red_flags(patient_text, all_patient_text):
            if flag not in session.red_flags_detected:
                session.red_flags_detected.append(flag)
                logger.warning("[ACI] RED FLAG for %s: %s", session.patient_id, flag)

        # 6. Advance
        session.current_question_index = current_index + 1
        next_index = session.current_question_index

        if next_index >= TOTAL_QUESTIONS:
            session.is_complete = True
            ai_response = COMPLETION_MESSAGES.get(
                new_style, COMPLETION_MESSAGES[StyleMode.HINGLISH_CASUAL.value]
            )
            touch_options: List[str] = []
            next_field = "complete"
        else:
            next_q = CLINICAL_QUESTIONS[next_index]
            ai_response = next_q.get(new_style, next_q[StyleMode.HINGLISH_CASUAL.value])
            next_field = next_q["field"]
            touch_options = touch_options_for(next_field, new_style)

        session.turns.append(ConversationTurn(
            role="system", text=ai_response, style_mode=new_style, field=next_field,
        ))
        self._persist(session)

        return self._response(
            session,
            ai_response=ai_response,
            touch_options=touch_options,
            field_collected=next_field,
            field_stored=current_field,
            turn_ratios=analysis["ratios"],
        )

    @staticmethod
    def _response(
        session: ACISession,
        ai_response: str,
        touch_options: List[str],
        field_collected: str,
        field_stored: str,
        turn_ratios: Dict[str, float],
    ) -> Dict[str, Any]:
        answered = len(session.clinical_fields_collected)
        return {
            "ai_response": ai_response,
            "style_mode": session.current_style,
            # Rolling window — matches what the UI labels "detected language".
            "language_ratios": session.language_ratios,
            # This single turn, for debugging / the demo overlay.
            "turn_ratios": turn_ratios,
            # The field the NEXT question will collect.
            "field_collected": field_collected,
            # The field this turn just recorded (frontends were off by one).
            "field_stored": field_stored,
            "normalized_value": session.clinical_fields_collected.get(field_stored, ""),
            "red_flags": list(session.red_flags_detected),
            "progress_pct": min(100, int(answered / TOTAL_QUESTIONS * 100)),
            "questions_answered": answered,
            "total_questions": TOTAL_QUESTIONS,
            "is_complete": session.is_complete,
            "touch_options": touch_options,
        }

    @staticmethod
    def _language_to_style(language: str) -> str:
        mapping = {
            "hindi": StyleMode.FORMAL_HINDI.value,
            "english": StyleMode.ENGLISH_PROFESSIONAL.value,
            "hinglish": StyleMode.HINGLISH_CASUAL.value,
        }
        return mapping.get((language or "").lower(), StyleMode.HINGLISH_CASUAL.value)


# ── Field Normalization (the STRICT clinical layer) ───────────────────────────

_FIELD_DESCRIPTIONS = {
    "chief_complaint": "chief medical complaint (e.g. 'Headache', 'Chest pain')",
    "onset": "symptom onset duration (e.g. '5 days ago', '2 weeks')",
    "character": "pain character (e.g. 'dull aching', 'sharp throbbing', 'burning')",
    "radiation": "radiation or spreading of pain (e.g. 'radiates to left arm', 'no radiation')",
    "associated_symptoms": "associated symptoms (e.g. 'nausea, vomiting, dizziness')",
    "timing": "pain timing pattern (e.g. 'constant', 'intermittent', 'worse at night')",
    "exacerbating": "exacerbating and relieving factors (e.g. 'worse with movement, better with rest')",
    "severity": "pain severity on 0-10 scale (e.g. '7/10')",
    "past_medical": "past medical history (e.g. 'Type 2 Diabetes, Hypertension')",
    "medications": "current medications (e.g. 'Metformin 500mg BD, Amlodipine 5mg OD')",
    "allergies": "drug or food allergies (e.g. 'No known allergies' or 'Penicillin - rash')",
    "family_history": "family medical history (e.g. 'Father: hypertension, Mother: diabetes')",
    "personal_history": "personal/social history — tobacco, alcohol, sleep, appetite "
                        "(e.g. 'Smoker, 10 bidis/day; no alcohol; disturbed sleep')",
}

_NORMALIZE_SYSTEM = (
    "You are a clinical scribe assistant. "
    "Your ONLY job is to convert messy patient speech (may be Hinglish, Hindi in "
    "Devanagari, Hindi-English mix, or broken English) into a single clean, concise "
    "ENGLISH clinical phrase suitable for a doctor's record. "
    "Rules: (1) Output ONLY the normalized English phrase — no explanations, no "
    "preamble, no quotes. (2) Output must be in English script only. "
    "(3) Keep it factual — do not infer or add information not present. "
    "(4) If the patient said 'no' / 'nahi' / 'none', output 'None reported'. "
    "(5) Keep numeric values exact. (6) Max 15 words."
)

# Deterministic fallback used when the LLM is unreachable. Keeps the promise that
# the clinical record is English instead of dumping raw Hinglish into the report.
_RULE_MAP = [
    # negations first — they short-circuit
    (r"\b(kuch\s*(bhi)?\s*nahi|koi\s*nahi|kuchh\s*nahi|nahi\s*hai|no\s+none|none|nothing)\b", "None reported"),
    (r"(कुछ\s*नहीं|कोई\s*नहीं|नहीं\s*है)", "None reported"),
    # symptoms
    (r"(seene?|sine|chhati|chati|chest)\s*(mein|me|men)?\s*(dard|pain)", "Chest pain"),
    (r"(सीने|छाती)\s*में\s*दर्द", "Chest pain"),
    (r"\b(sar|sir)\s*(dard|dard)|sardard|sirdard|headache", "Headache"),
    (r"सिर\s*दर्द", "Headache"),
    (r"\bpet\s*(mein|me)?\s*(dard|pain)", "Abdominal pain"),
    (r"पेट\s*दर्द", "Abdominal pain"),
    (r"\b(kamar|peeth|pith)\s*(mein|me)?\s*(dard|pain)", "Back pain"),
    (r"कमर\s*दर्द", "Back pain"),
    (r"\b(bukhar|fever)\b", "Fever"),
    (r"बुखार", "Fever"),
    (r"\b(khansi|khasi|cough)\b", "Cough"),
    (r"\b(ulti|ultee|vomit|matli|nausea)", "Nausea and vomiting"),
    (r"(उल्टी|जी\s*मिचला)", "Nausea and vomiting"),
    (r"\b(chakkar|dizzy|dizziness)", "Dizziness"),
    (r"चक्कर", "Dizziness"),
    (r"\b(saans|sans)\s*(phool|lene|ki)|breathless|shortness of breath", "Breathlessness"),
    (r"सांस", "Breathlessness"),
    (r"\b(pasina|sweat)", "Sweating"),
    (r"\b(kamzori|kamjori|weak)", "Generalised weakness"),
    (r"\b(jalan|burning)", "Burning sensation"),
    # duration
    (r"\b(kal\s*se|since yesterday)", "Since yesterday"),
    (r"\b(aaj\s*se|today)", "Started today"),
    (r"\b(\d+)\s*(din|days?)\s*se", r"\1 days"),
    (r"\b(\d+)\s*(hafte|haftey|weeks?)\s*se", r"\1 weeks"),
    (r"\b(\d+)\s*(mahine|mahina|months?)\s*se", r"\1 months"),
    # conditions
    (r"\b(sugar|diabetes|madhumeh)", "Diabetes mellitus"),
    (r"(शुगर|मधुमेह)", "Diabetes mellitus"),
    (r"\b(bp|blood pressure|hypertension)", "Hypertension"),
    (r"(बीपी|रक्तचाप)", "Hypertension"),
    (r"\b(thyroid)", "Thyroid disorder"),
    (r"\b(asthma|dama)", "Asthma"),
    (r"\b(heart|dil|hriday)", "Heart disease"),
    # severity like "7", "7/10", "saat"
    (r"\b(\d{1,2})\s*(/\s*10|out of 10|pe|par)?\b", r"\1/10"),
]


def _rule_normalize(field_name: str, raw: str) -> Optional[str]:
    """
    Best-effort deterministic Hinglish/Devanagari → English mapping.
    Returns None when nothing matched, so the caller can fall back to verbatim.
    """
    text = raw.strip().lower()
    hits: List[str] = []
    for pattern, replacement in _RULE_MAP:
        # The numeric severity rule is only meaningful for the severity field.
        if replacement == r"\1/10" and field_name != "severity":
            continue
        m = re.search(pattern, text)
        if not m:
            continue
        value = re.sub(pattern, replacement, m.group(0)) if "\\1" in replacement else replacement
        if value == "None reported":
            return "None reported"
        if value not in hits:
            hits.append(value)
    if not hits:
        return None
    return ", ".join(hits[:3])


async def normalize_field(field_name: str, raw_text: str) -> tuple[str, str]:
    """
    Convert a raw patient answer into clean English clinical text.

    Returns (english_text, source) where source is:
      "canonical" — an exact touch-option label, mapped with zero ambiguity
      "llm"       — the LLM normalized it
      "rules"     — deterministic keyword mapping (LLM unavailable)
      "verbatim"  — nothing matched; the raw text is kept and flagged as such
    """
    raw_text = (raw_text or "").strip()
    if not raw_text:
        return "", "verbatim"

    # A tapped touch option needs no model at all.
    canonical = canonical_for_option(raw_text)
    if canonical:
        return canonical, "canonical"

    description = _FIELD_DESCRIPTIONS.get(field_name, "clinical information")
    prompt = (
        f"Field: {description}\n"
        f"Patient said: \"{raw_text}\"\n"
        f"Normalized English clinical phrase:"
    )
    # 40 tokens returned EMPTY on every reasoning model — the budget was spent on
    # hidden reasoning before any content was emitted.
    result = await llm_complete(prompt, system=_NORMALIZE_SYSTEM, max_tokens=256)
    cleaned = result.strip().strip('"').strip("'").strip()
    # Guard against the model echoing the prompt or replying in Devanagari.
    if cleaned and len(cleaned) >= 2 and not DEVANAGARI_PATTERN.search(cleaned):
        cleaned = cleaned.split("\n")[0].strip()
        if len(cleaned) <= 160:
            logger.debug("[ACI] Normalized '%s' → '%s'", raw_text[:40], cleaned)
            return cleaned, "llm"

    ruled = _rule_normalize(field_name, raw_text)
    if ruled:
        logger.info(
            "[ACI] LLM unavailable — rule-normalized %s: '%s' → '%s'",
            field_name, raw_text[:40], ruled,
        )
        return ruled, "rules"

    logger.warning(
        "[ACI] Could not normalize %s to English; keeping verbatim: '%s'",
        field_name, raw_text[:60],
    )
    return raw_text, "verbatim"


async def _normalize_field(field_name: str, raw_text: str) -> str:
    """Legacy single-value wrapper."""
    value, _ = await normalize_field(field_name, raw_text)
    return value
