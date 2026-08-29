"""
Prescription OCR Service
=========================
Pipeline: Image → Sarvam Doc-AI OCR → LLM Extraction → Drug Fuzzy Matching → Result

Uses rapidfuzz for drug name correction against a known formulary.

Everything returned by this service comes from the image the patient uploaded.
There is no mock/sample output any more: the service used to fall back to a
hardcoded Dr. A. Shah prescription (Metformin 500 BD, Amlodipine 5 OD, HbA1c
8.1%, five lab values) whenever the Sarvam key was missing or the OCR call
failed, so a patient who scanned a blank page — or scanned anything at all with
no API key configured — was handed to the doctor with two drugs and a diabetes
diagnosis nobody had ever given them. When OCR cannot run or reads nothing, the
service now raises OCRUnavailable and the kiosk says so.

Two earlier bugs fixed here
---------------------------
1. `self._client.vision.process(...)` — the Sarvam SDK has no `.vision`
   attribute, so every real scan raised AttributeError. The correct entry point
   is the asynchronous `doc_ai.digitise` job: submit → poll → get_results.
2. `_extract_structured(raw_text)` ignored `raw_text` entirely and returned the
   same two hardcoded medicines for every document. It now runs an LLM
   extraction over the real OCR text, with a deterministic regex parser as
   fallback.
"""

import asyncio
import json
import logging
import math
import os
import re
import tempfile
from typing import Any, Dict, List, Optional

from config import settings
from services.llm_client import llm_complete

logger = logging.getLogger(__name__)

try:
    from rapidfuzz import fuzz, process as rf_process
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False
    logger.warning("[OCR] rapidfuzz not installed. Drug name correction disabled.")

try:
    from sarvamai import SarvamAI
    SARVAM_AVAILABLE = True
except ImportError:
    SARVAM_AVAILABLE = False

# Doc-AI is a job API. Bound the wait so a kiosk scan can never hang forever.
# A single-page printed prescription measured ~26s end to end, so the old 45s
# ceiling left almost no headroom: a slightly denser page or a busy queue would
# time out and tell the patient their photo was unreadable when it was fine.
OCR_POLL_INTERVAL = 1.5
OCR_MAX_WAIT = 90.0


class OCRUnavailable(RuntimeError):
    """
    Raised when the uploaded document could not be read.

    The caller must surface this to the patient. It must never be swallowed and
    replaced with example data — a prescription in the doctor's report is acted
    on clinically, so "we could not read your document" is the only safe answer
    when OCR did not run.
    """


# ── Indian Drug Formulary (Common Names) ──────────────────────────────────────
# Expand this list for production — should contain 500+ common drugs

DRUG_VOCABULARY = [
    # Diabetes
    "Metformin", "Glimepiride", "Glipizide", "Gliclazide", "Sitagliptin",
    "Vildagliptin", "Empagliflozin", "Dapagliflozin", "Pioglitazone", "Insulin",
    # Cardiovascular
    "Amlodipine", "Atenolol", "Metoprolol", "Losartan", "Telmisartan",
    "Ramipril", "Enalapril", "Atorvastatin", "Rosuvastatin", "Clopidogrel",
    "Aspirin", "Warfarin", "Rivaroxaban", "Furosemide", "Hydrochlorothiazide",
    "Nitroglycerin", "Isosorbide", "Bisoprolol", "Digoxin", "Nebivolol",
    # Antibiotics
    "Amoxicillin", "Azithromycin", "Ciprofloxacin", "Ceftriaxone", "Doxycycline",
    "Levofloxacin", "Metronidazole", "Clindamycin", "Cotrimoxazole", "Cefixime",
    # Pain / Anti-inflammatory
    "Paracetamol", "Ibuprofen", "Diclofenac", "Naproxen", "Aceclofenac",
    "Piroxicam", "Tramadol", "Gabapentin", "Pregabalin", "Etoricoxib",
    # GI
    "Omeprazole", "Pantoprazole", "Rabeprazole", "Ranitidine", "Domperidone",
    "Ondansetron", "Sucralfate", "Lactulose", "Loperamide", "Esomeprazole",
    # Respiratory
    "Salbutamol", "Budesonide", "Montelukast", "Theophylline", "Cetirizine",
    "Levocetirizine", "Fexofenadine", "Dextromethorphan", "Formoterol",
    # Thyroid
    "Levothyroxine", "Carbimazole", "Propylthiouracil",
    # Psychiatry / Neuro
    "Escitalopram", "Sertraline", "Fluoxetine", "Alprazolam", "Clonazepam",
    "Olanzapine", "Risperidone", "Lithium", "Amitriptyline", "Nortriptyline",
    "Levetiracetam", "Valproate", "Phenytoin", "Carbamazepine",
    # Supplements. The generic names sit alongside what is actually printed on
    # an Indian prescription — "Cap. Vitamin D3 60000 IU" is written far more
    # often than "Cholecalciferol", and with only the latter in the vocabulary
    # the drug came through unmatched at 0% confidence.
    "Cholecalciferol", "Methylcobalamin", "Ferrous", "Calcium", "Folic",
    "Vitamin D3", "Vitamin D", "Vitamin B12", "Vitamin C", "Zinc",
    # Ayurvedic (AYUSH context)
    "Ashwagandha", "Triphala", "Guggulu", "Brahmi", "Shatavari",
    "Arjuna", "Haritaki", "Amalaki", "Guduchi", "Yashtimadhu",
]

# Words that appear next to a drug name on a prescription but are not drugs.
# Without this, "Tab" fuzzy-matched to "Atenolol"-class entries at low scores.
_NON_DRUG_TOKENS = {
    "tab", "tabs", "tablet", "tablets", "cap", "caps", "capsule", "capsules",
    "syp", "syrup", "inj", "injection", "rx", "mg", "ml", "gm", "od", "bd",
    "tds", "qid", "hs", "sos", "ac", "pc", "stat", "daily", "twice", "once",
    "morning", "night", "after", "before", "meals", "food", "days", "day",
    "weeks", "week", "month", "months", "dose", "doses", "advice", "diagnosis",
    "date", "follow", "up", "dr", "mbbs", "md", "hospital", "clinic",
}

# Common dosage terms
DOSAGE_TERMS = {
    "od": "Once daily",
    "bd": "Twice daily",
    "bid": "Twice daily",
    "tds": "Three times daily",
    "tid": "Three times daily",
    "qid": "Four times daily",
    "hs": "At bedtime",
    "sos": "As needed",
    "ac": "Before meals",
    "pc": "After meals",
    "stat": "Immediately",
    "prn": "As needed",
    "qw": "Once weekly",
}

# Lab value reference ranges. Standard adult ranges — a status is only ever
# asserted for a test that appears here; anything else is reported "unknown"
# rather than guessed at (see check_lab_abnormality).
LAB_REFERENCE_RANGES = {
    "hba1c": {"unit": "%", "low": 0, "high": 7.0, "critical_high": 10.0},
    "fasting blood sugar": {"unit": "mg/dL", "low": 70, "high": 100, "critical_high": 250},
    # Labs print the same test under several names. "Fasting Glucose" matched
    # none of the keys below and a diabetic's 148 mg/dL was handed to the doctor
    # as "unknown — N/A", unflagged, next to correctly-flagged HbA1c and LDL.
    "fasting glucose": {"unit": "mg/dL", "low": 70, "high": 100, "critical_high": 250},
    "fasting plasma glucose": {"unit": "mg/dL", "low": 70, "high": 100, "critical_high": 250},
    "fbs": {"unit": "mg/dL", "low": 70, "high": 100, "critical_high": 250},
    "random blood sugar": {"unit": "mg/dL", "low": 70, "high": 140, "critical_high": 300},
    "random glucose": {"unit": "mg/dL", "low": 70, "high": 140, "critical_high": 300},
    # A bare "Glucose 148" is deliberately absent: without knowing whether it was
    # taken fasting or after a meal, the two ranges disagree, so no status is
    # honest. Better "unknown" than a wrong flag either way.
    "postprandial": {"unit": "mg/dL", "low": 70, "high": 140, "critical_high": 300},
    "total cholesterol": {"unit": "mg/dL", "low": 0, "high": 200, "critical_high": 300},
    "ldl": {"unit": "mg/dL", "low": 0, "high": 100, "critical_high": 190},
    "hdl": {"unit": "mg/dL", "low": 40, "high": 200, "critical_high": None},
    "triglycerides": {"unit": "mg/dL", "low": 0, "high": 150, "critical_high": 500},
    "serum creatinine": {"unit": "mg/dL", "low": 0.7, "high": 1.3, "critical_high": 4.0},
    "creatinine": {"unit": "mg/dL", "low": 0.7, "high": 1.3, "critical_high": 4.0},
    "urea": {"unit": "mg/dL", "low": 15, "high": 45, "critical_high": 100},
    "hemoglobin": {"unit": "g/dL", "low": 12, "high": 17, "critical_high": None},
    "haemoglobin": {"unit": "g/dL", "low": 12, "high": 17, "critical_high": None},
    "tsh": {"unit": "mIU/L", "low": 0.4, "high": 4.0, "critical_high": 20.0},
    "platelet": {"unit": "10^3/uL", "low": 150, "high": 450, "critical_high": None},
    "wbc": {"unit": "10^3/uL", "low": 4.0, "high": 11.0, "critical_high": 30.0},
    "blood pressure systolic": {"unit": "mmHg", "low": 90, "high": 140, "critical_high": 180},
    "blood pressure diastolic": {"unit": "mmHg", "low": 60, "high": 90, "critical_high": 120},
}


# Dosage form written in front of the drug: "Tab. Metformin", "Cap. Vitamin D3",
# "Syp Ascoril", "Inj. Insulin". Stripped before matching, and deliberately NOT
# reported as an OCR correction — nothing was misread, the form was simply not
# part of the drug name. Previously "Tab. Metformin → Metformin" was shown to the
# patient as a 90%-confidence fuzzy correction, while "Cap. Vitamin D3" (no
# vocabulary hit with the prefix attached) reached the doctor's report verbatim.
_DOSAGE_FORM_PREFIX = re.compile(
    r"^\s*(?:\d+\s*[.)]\s*)?"
    r"(?:tabs?|tablets?|caps?|capsules?|syp|syrup|susp|suspension|inj|injection|"
    r"oint|ointment|cream|drops?|sachet|powder|lotion|gel|spray|inhaler)"
    r"\s*\.?\s+",
    re.IGNORECASE,
)


def correct_drug_name(raw_name: str, threshold: int = 82) -> Dict[str, Any]:
    """
    Fuzzy match OCR output against the known drug vocabulary.

    Returns {"corrected", "original", "confidence", "was_corrected"}.
    Threshold raised from 75 → 82 and short/non-drug tokens are skipped: at 75,
    OCR noise like "Tab" or "Advice" was being "corrected" into real drug names.
    """
    name = _DOSAGE_FORM_PREFIX.sub("", (raw_name or "").strip()).strip(" .:-")
    if not RAPIDFUZZ_AVAILABLE or len(name) < 4 or name.lower() in _NON_DRUG_TOKENS:
        return {"corrected": name, "original": name, "confidence": 0, "was_corrected": False}

    match = rf_process.extractOne(name, DRUG_VOCABULARY, scorer=fuzz.WRatio)
    if match and match[1] >= threshold:
        was_corrected = match[0].lower() != name.lower()
        return {
            "corrected": match[0],
            "original": name,
            "confidence": int(match[1]),
            "was_corrected": was_corrected,
        }

    return {"corrected": name, "original": name, "confidence": 0, "was_corrected": False}


def check_lab_abnormality(
    test_name: str, value: float, printed_reference: str = ""
) -> Dict[str, Any]:
    """
    Check if a lab value is within reference range.
    Returns {"status", "reference", "reference_source"} where status is
    normal|abnormal|critical|unknown.

    A status is only asserted from LAB_REFERENCE_RANGES. When the test is not
    one we hold a range for, the range the document itself printed is shown for
    the doctor's context but the status stays "unknown" — an OCR-read range
    could have a misread digit, and a wrong "normal" is worse than no verdict.
    Before this, an unrecognised test lost the document's own printed range too
    and was reported as a bare "N/A".
    """
    printed = (printed_reference or "").strip()
    test_key = (test_name or "").lower().strip()
    unknown = {
        "status": "unknown",
        "reference": printed or "N/A",
        "reference_source": "document" if printed else "none",
    }
    if not test_key:
        return unknown

    # Longest key first so "serum creatinine" wins over "creatinine".
    for ref_name in sorted(LAB_REFERENCE_RANGES, key=len, reverse=True):
        if ref_name in test_key:
            ref = LAB_REFERENCE_RANGES[ref_name]
            ref_str = f"{ref['low']}-{ref['high']} {ref['unit']}"
            if ref.get("critical_high") and value >= ref["critical_high"]:
                status = "critical"
            elif value > ref["high"] or value < ref["low"]:
                status = "abnormal"
            else:
                status = "normal"
            return {"status": status, "reference": ref_str, "reference_source": "validated"}

    return unknown


# ── LLM extraction ────────────────────────────────────────────────────────────

_EXTRACT_SYSTEM = (
    "You extract structured data from Indian medical prescriptions and lab reports. "
    "Return ONLY a single JSON object, no prose, no markdown fences. Schema:\n"
    '{"medications":[{"drug_name":str,"strength":str,"dosage":str,"frequency":str,'
    '"duration":str}],'
    '"lab_values":[{"test_name":str,"value":str,"unit":str,"reference_range":str}],'
    '"diagnosis":str,"doctor_name":str,"date":"YYYY-MM-DD"}\n'
    "Field meanings — keep these strictly separate:\n"
    "  drug_name: the medicine only, without the dosage form (write Metformin, "
    "not 'Tab. Metformin').\n"
    "  strength: amount per unit, e.g. '500 mg', '60000 IU'.\n"
    "  dosage: how much is taken per dose, e.g. '1 tablet', '10 ml'.\n"
    "  frequency: how often it is taken — NEVER how long for.\n"
    "  duration: how long the course runs, e.g. '30 days', '8 weeks'.\n"
    "Indian prescriptions write frequency as a morning-afternoon-night triple: "
    "1-0-1 = Morning and night, 1-0-0 = Morning only, 0-0-1 = Night only, "
    "1-1-1 = Morning, afternoon and night, 1/2-0-1/2 = Half morning and half night. "
    "Translate the triple into words in `frequency`, and keep any timing note "
    "(after food, before food, at bedtime) with it. Also expand letter codes: "
    "OD=Once daily, BD=Twice daily, TDS=Three times daily, QID=Four times daily, "
    "HS=At bedtime, SOS=As needed, PC=After meals, AC=Before meals, "
    "QW=Once weekly.\n"
    "For lab_values, copy the reference range exactly as printed on the document "
    "into reference_range (e.g. '70 - 100'), or leave it an empty string if none "
    "is printed.\n"
    "Rules: copy values exactly as written; do NOT invent medicines, tests or "
    "dates that are not in the text. Use an empty string or empty list when "
    "something is absent."
)

_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")

# "1. Tab Metformin 500mg - 1 tablet BD (after meals)"
_MED_LINE = re.compile(
    r"^\s*(?:\d+[.)]\s*)?"
    r"(?:tab|tabs|tablet|cap|caps|capsule|syp|syrup|inj|injection)?\.?\s*"
    r"(?P<name>[A-Za-z][A-Za-z\-\s]{2,30}?)\s*"
    r"(?P<strength>\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|iu|units?|%))"
    r"(?P<rest>.*)$",
    re.IGNORECASE,
)
# "HbA1c: 8.1 %" / "Fasting Blood Sugar 165 mg/dL" / "HbA1c 8.1 % (ref 4.0 - 5.6)"
# The trailing reference group is not optional decoration: with the pattern
# anchored at $ straight after the unit, every line that printed its own range —
# i.e. most lines on a real lab report — failed to match and the value was
# dropped entirely by the regex parser.
_LAB_LINE = re.compile(
    r"^\s*(?P<test>[A-Za-z][A-Za-z0-9()\-/\s]{2,40}?)\s*[:\-–]?\s*"
    r"(?P<value>\d+(?:\.\d+)?)\s*"
    r"(?P<unit>%|mg/dl|mg/dL|g/dl|g/dL|mmol/l|miu/l|mIU/L|mmHg|ng/ml|iu/l|10\^3/ul)?\s*"
    r"(?P<ref>\([^)]*\)|(?:ref|reference)[.:\s][^\n]*)?\s*$",
    re.IGNORECASE,
)
# "(ref 4.0 - 5.6)" / "reference: 70 - 100" → "4.0 - 5.6" / "70 - 100"
_REF_CLEAN = re.compile(r"^[\s(]*(?:ref(?:erence)?(?:\s*range)?)?[.:\s]*|[\s)]*$", re.IGNORECASE)
# "x 30 days" / "for 8 weeks" / "– 5 days"
_DURATION = re.compile(
    r"(?:\bx\b|\bfor\b|[-–])?\s*(?P<n>\d+)\s*(?P<unit>days?|weeks?|months?)\b",
    re.IGNORECASE,
)
# Indian morning-afternoon-night dosing triple: "1-0-1", "1/2-0-1/2", "1-1-1".
_DOSE_TRIPLE = re.compile(r"\b(1/2|½|[01])\s*-\s*(1/2|½|[01])\s*-\s*(1/2|½|[01])\b")
_TIME_OF_DAY = re.compile(
    r"\b(?:at\s+)?(?P<w>morning|afternoon|evening|night|bedtime)\b", re.IGNORECASE
)
_TIME_SYNONYMS = {"bedtime": "night"}
_DATE_PATTERNS = [
    (re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"), (1, 2, 3)),
    (re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b"), (3, 2, 1)),
]
_DOCTOR = re.compile(r"\bDr\.?\s+([A-Z][A-Za-z.\s]{2,40})", re.UNICODE)
_DIAGNOSIS = re.compile(
    r"(?:diagnosis|impression|provisional diagnosis)\s*[:\-]\s*(.+)", re.IGNORECASE
)


class PrescriptionOCR:
    """
    Processes prescription images through OCR → extraction → correction pipeline.
    """

    def __init__(self):
        self._client = None
        if SARVAM_AVAILABLE and settings.SARVAM_API_KEY:
            try:
                self._client = SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)
            except Exception as e:
                logger.error("[OCR] Could not construct Sarvam client: %s", e)

    async def process_document(
        self, patient_id: str, image_bytes: bytes
    ) -> Dict[str, Any]:
        """
        Full prescription processing pipeline.
        Returns structured prescription data with corrections and confidence.

        Raises OCRUnavailable if the image could not be read at all. Everything
        in the returned dict is derived from THIS image.
        """
        # Step 1: OCR
        raw_text, ocr_source = await self._run_ocr(image_bytes)

        # Step 2: Structured extraction from the ACTUAL text
        extracted = await self._extract_structured(raw_text)

        # Step 3: Drug name fuzzy matching
        corrections: List[Dict[str, Any]] = []
        clean_meds: List[Dict[str, Any]] = []
        for med in extracted.get("medications", []):
            drug_raw = (med.get("drug_name") or "").strip()
            if not drug_raw or drug_raw.lower() in _NON_DRUG_TOKENS:
                continue
            correction = correct_drug_name(drug_raw)
            # Always take the normalized name back, not just when the fuzzy
            # matcher changed something: correct_drug_name also strips the dosage
            # form, and assigning only inside the `was_corrected` branch threw
            # that away — "Tab. Metformin" normalized to "Metformin", matched the
            # vocabulary exactly, reported was_corrected=False, and so reached the
            # doctor's report still spelled "Tab. Metformin".
            # Re-check against the non-drug list afterwards: the raw "Tab." is not
            # in it (the full stop), but the stripped "Tab" is, and without this a
            # stray dosage-form line became a medicine named "Tab".
            clean_name = correction["corrected"]
            if not clean_name or clean_name.lower() in _NON_DRUG_TOKENS:
                continue
            med["drug_name"] = clean_name
            if correction["was_corrected"]:
                corrections.append({
                    "from": correction["original"],
                    "to": correction["corrected"],
                    "confidence": str(correction["confidence"]),
                })
            med["match_confidence"] = correction["confidence"]
            # Frontends render `name`; the pipeline speaks `drug_name`. Emit both
            # so neither side has to guess (the report used to show blank names).
            med["name"] = med["drug_name"]
            med.setdefault("strength", "")
            med.setdefault("dosage", "")
            med.setdefault("frequency", "")
            med.setdefault("duration", "")
            med["confidence"] = correction["confidence"] or 0
            clean_meds.append(med)

        # Step 4: Lab value abnormality checking
        clean_labs: List[Dict[str, Any]] = []
        for lab in extracted.get("lab_values", []):
            test_name = (lab.get("test_name") or lab.get("test") or "").strip()
            raw_value = str(lab.get("value", "")).strip()
            printed_ref = str(lab.get("reference_range") or "").strip()
            lab["test_name"] = test_name
            lab["test"] = test_name  # frontend key
            try:
                numeric = float(re.sub(r"[^\d.\-]", "", raw_value) or "nan")
            except (ValueError, TypeError):
                numeric = float("nan")
            if math.isfinite(numeric):
                abnormality = check_lab_abnormality(test_name, numeric, printed_ref)
            else:
                # float("nan") does not raise, and every comparison against nan is
                # False — so an unreadable value on a test we DO hold a range for
                # ("HbA1c: pending", a smudged figure) fell through to "normal".
                # A value we could not parse has no status.
                abnormality = check_lab_abnormality("", 0.0, printed_ref)
            lab["status"] = abnormality["status"]
            lab["reference_range"] = abnormality["reference"]
            lab["reference"] = abnormality["reference"]  # frontend key
            # Whether the range was validated here or just read off the document.
            lab["reference_source"] = abnormality["reference_source"]
            if lab.get("unit") and lab["unit"] not in raw_value:
                lab["value"] = f"{raw_value} {lab['unit']}".strip()
            else:
                lab["value"] = raw_value
            clean_labs.append(lab)

        result = {
            "medications": clean_meds,
            "lab_values": clean_labs,
            "diagnosis": extracted.get("diagnosis", ""),
            "doctor_name": extracted.get("doctor_name") or "Unknown",
            "date": extracted.get("date") or "Unknown",
            "ocr_confidence": float(extracted.get("confidence", 0.85)),
            "corrections": corrections,
            "ocr_source": ocr_source,
            "extraction_source": extracted.get("extraction_source", "unknown"),
            "raw_text": raw_text[:4000],
        }

        logger.info(
            "[OCR] Processed document for %s. Meds=%d, Labs=%d, Corrections=%d, "
            "ocr=%s, extraction=%s",
            patient_id, len(clean_meds), len(clean_labs), len(corrections),
            ocr_source, result["extraction_source"],
        )

        return result

    # ── OCR ────────────────────────────────────────────────────────────────

    async def _run_ocr(self, image_bytes: bytes) -> tuple[str, str]:
        """
        Run OCR on the uploaded image. Returns (text, "sarvam_doc_ai").

        Raises OCRUnavailable rather than substituting example text, so a failed
        scan can never reach the doctor's report as if it had been read off the
        patient's own document.
        """
        if not image_bytes:
            raise OCRUnavailable("The uploaded file was empty.")

        if not self._client:
            reason = (
                "the sarvamai SDK is not installed"
                if not SARVAM_AVAILABLE else "SARVAM_API_KEY is not configured"
            )
            logger.error("[OCR] Cannot run OCR — %s.", reason)
            raise OCRUnavailable(
                f"Document scanning is not available on this kiosk ({reason}). "
                "Nothing was added to the patient record."
            )

        try:
            text = await asyncio.to_thread(self._sarvam_digitise, image_bytes)
        except Exception as e:
            logger.error("[OCR] Sarvam Doc-AI failed (%s): %s", type(e).__name__, e)
            raise OCRUnavailable(
                f"Could not read the document ({type(e).__name__}). "
                "Please retake the photo in better light."
            ) from e

        if not (text and text.strip()):
            logger.warning("[OCR] Sarvam Doc-AI returned no text for this image.")
            raise OCRUnavailable(
                "No text could be read from this image. Please retake the photo "
                "with the whole page in frame."
            )

        logger.info("[OCR] Sarvam Doc-AI returned %d chars", len(text))
        return text, "sarvam_doc_ai"

    def _sarvam_digitise(self, image_bytes: bytes) -> str:
        """
        Submit the image to Sarvam Doc-AI and poll until the job finishes.
        Blocking — always call via asyncio.to_thread.
        """
        import time

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name

            with open(tmp_path, "rb") as f:
                job = self._client.doc_ai.digitise(
                    file=[f],
                    output_format="md",
                    content_type="mixed",
                    language="hi-IN",
                )

            job_id = getattr(job, "job_id", None)
            if not job_id:
                raise RuntimeError(f"Doc-AI returned no job_id: {job!r}")

            deadline = time.monotonic() + OCR_MAX_WAIT
            status = getattr(job, "status", "") or ""
            while time.monotonic() < deadline:
                if status.lower() in ("completed", "succeeded", "success", "done"):
                    break
                if status.lower() in ("failed", "error", "cancelled"):
                    raise RuntimeError(f"Doc-AI job {job_id} ended as {status}")
                time.sleep(OCR_POLL_INTERVAL)
                status = getattr(self._client.doc_ai.get_status(job_id), "status", "") or ""
            else:
                raise TimeoutError(
                    f"Doc-AI job {job_id} still {status!r} after {OCR_MAX_WAIT:.0f}s"
                )

            results = self._client.doc_ai.get_results(job_id)
            return self._results_to_text(results)

        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    @staticmethod
    def _results_to_text(results: Any) -> str:
        """
        Pull the page text out of a Doc-AI digitise result.

        Traverses dicts, not model attributes, because the SDK's declared shape
        and the API's actual payload disagree: `DocAiDigitiseResultsDocumentsItemPagesItem`
        declares `page_number` and `content`, but a real completed job returns
        both as null and carries the text in undeclared extra fields —
        `page["blocks"][i]["text"]`, alongside `page_num`. Reading only `content`
        found nothing on a page Sarvam had in fact transcribed perfectly, and the
        patient was told to retake a photo that was never the problem.
        Both spellings are accepted so this keeps working whichever one the API
        settles on.
        """
        if hasattr(results, "model_dump"):
            payload = results.model_dump()
        elif isinstance(results, dict):
            payload = results
        else:
            payload = {"documents": getattr(results, "documents", []) or []}

        pages_text: List[str] = []
        for doc in payload.get("documents") or []:
            if not isinstance(doc, dict):
                doc = getattr(doc, "model_dump", lambda: {})()
            for page in doc.get("pages") or []:
                if not isinstance(page, dict):
                    page = getattr(page, "model_dump", lambda: {})()

                content = (page.get("content") or "").strip()
                if not content:
                    # Blocks carry reading_order; sort by it so a multi-column
                    # prescription is not interleaved into nonsense.
                    blocks = [b for b in (page.get("blocks") or []) if isinstance(b, dict)]
                    blocks.sort(key=lambda b: b.get("reading_order") or 0)
                    content = "\n\n".join(
                        (b.get("text") or "").strip() for b in blocks
                        if (b.get("text") or "").strip()
                    ).strip()

                if content:
                    pages_text.append(content)

        return "\n\n".join(pages_text)

    # ── Structured extraction ──────────────────────────────────────────────

    async def _extract_structured(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract structured data from raw OCR text.

        LLM first (handles free-form handwriting transcripts), deterministic
        regex parser as fallback. This function used to ignore `raw_text` and
        return the same two hardcoded medicines for every document.
        """
        raw_text = (raw_text or "").strip()
        if not raw_text:
            return {
                "medications": [], "lab_values": [], "diagnosis": "",
                "doctor_name": "", "date": "", "confidence": 0.0,
                "extraction_source": "empty",
            }

        prompt = f"Prescription / report text:\n---\n{raw_text[:6000]}\n---\nJSON:"
        reply = await llm_complete(prompt, system=_EXTRACT_SYSTEM, max_tokens=900)

        parsed = self._parse_json(reply)
        if parsed is not None:
            parsed.setdefault("medications", [])
            parsed.setdefault("lab_values", [])
            parsed.setdefault("diagnosis", "")
            parsed.setdefault("doctor_name", "")
            parsed.setdefault("date", "")
            parsed["confidence"] = 0.88
            parsed["extraction_source"] = "llm"
            if parsed["medications"] or parsed["lab_values"]:
                return parsed
            logger.info("[OCR] LLM found nothing — trying the regex parser.")

        fallback = self._regex_extract(raw_text)
        fallback["extraction_source"] = "regex"
        logger.info(
            "[OCR] Regex extraction: %d meds, %d labs",
            len(fallback["medications"]), len(fallback["lab_values"]),
        )
        return fallback

    @staticmethod
    def _parse_json(reply: str) -> Optional[Dict[str, Any]]:
        """Pull a JSON object out of an LLM reply that may be fenced or chatty."""
        if not reply:
            return None
        text = reply.strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text).strip()
        match = _JSON_BLOCK.search(text)
        if not match:
            return None
        try:
            data = json.loads(match.group())
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError as e:
            logger.warning("[OCR] LLM returned unparseable JSON: %s", e)
            return None

    @staticmethod
    def _regex_extract(raw_text: str) -> Dict[str, Any]:
        """Deterministic parser — used when the LLM is unavailable."""
        meds: List[Dict[str, str]] = []
        labs: List[Dict[str, str]] = []
        diagnosis, doctor, date = "", "", ""

        for line in raw_text.splitlines():
            line = line.strip().strip("|").strip()
            if not line or len(line) < 3:
                continue

            if not diagnosis:
                m = _DIAGNOSIS.search(line)
                if m:
                    diagnosis = m.group(1).strip(" .;")
                    continue

            if not doctor:
                m = _DOCTOR.search(line)
                if m:
                    doctor = f"Dr. {m.group(1).strip(' .,')}"

            if not date:
                for pattern, order in _DATE_PATTERNS:
                    m = pattern.search(line)
                    if m:
                        y, mo, d = (m.group(i) for i in order)
                        try:
                            date = f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
                        except ValueError:
                            pass
                        break

            m = _MED_LINE.match(line)
            if m:
                name = " ".join(m.group("name").split()).strip(" -")
                if name and name.lower() not in _NON_DRUG_TOKENS and len(name) >= 4:
                    rest = (m.group("rest") or "").strip(" -–:")
                    schedule, duration = PrescriptionOCR._split_duration(rest)
                    meds.append({
                        "drug_name": name,
                        "strength": " ".join(m.group("strength").split()),
                        "dosage": rest,
                        "frequency": PrescriptionOCR._expand_dosage(schedule),
                        "duration": duration,
                    })
                    continue

            m = _LAB_LINE.match(line)
            if m:
                test = " ".join(m.group("test").split()).strip(" -:")
                if test and test.lower() not in _NON_DRUG_TOKENS and len(test) >= 3:
                    labs.append({
                        "test_name": test,
                        "value": m.group("value"),
                        "unit": (m.group("unit") or "").strip(),
                        "reference_range": _REF_CLEAN.sub("", m.group("ref") or "").strip(),
                    })

        return {
            "medications": meds,
            "lab_values": labs,
            "diagnosis": diagnosis,
            "doctor_name": doctor,
            "date": date,
            "confidence": 0.7 if (meds or labs) else 0.3,
        }

    @staticmethod
    def _split_duration(text: str) -> tuple[str, str]:
        """
        Separate "1-0-1 after food x 30 days" into the dosing schedule and the
        course length. They were previously merged into `frequency`, so the
        doctor's report showed Metformin's frequency as "x 30 days" — the one
        thing it is not — and lost the 1-0-1 entirely.
        """
        if not text:
            return "", ""
        m = _DURATION.search(text)
        if not m:
            return text.strip(" -–:x"), ""
        duration = f"{m.group('n')} {m.group('unit').lower()}"
        schedule = (text[:m.start()] + " " + text[m.end():]).strip()
        return " ".join(schedule.split()).strip(" -–:x"), duration

    @staticmethod
    def _expand_dosage(text: str) -> str:
        """Turn 'BD (after meals)' into 'Twice daily (after meals)', and the
        Indian '1-0-1' triple into 'Morning and night'."""
        if not text:
            return ""
        out = _DOSE_TRIPLE.sub(lambda m: PrescriptionOCR._expand_triple(m), text)

        # The triple already names the times of day, and prescriptions usually
        # repeat one of them in words right after it ("1-0-0 morning",
        # "0-0-1 at bedtime"), which came out as "Morning only morning". Keep the
        # first mention of each time of day and drop the echoes.
        seen: set = set()

        def _drop_echo(m):
            word = _TIME_SYNONYMS.get(m.group("w").lower(), m.group("w").lower())
            if word in seen:
                return ""
            seen.add(word)
            return m.group(0)

        out = _TIME_OF_DAY.sub(_drop_echo, out)
        # Dropping an echo can leave its conjunction behind ("1-0-1 morning and
        # night" → "Morning and night and"). Tidy the joins.
        out = re.sub(r"\s+(?:and|,)\s*(?=(?:and|,)\b)", " ", out)
        out = re.sub(r"^\s*(?:and|,)\s+|\s+(?:and|,)\s*$", " ", out)

        for code, meaning in DOSAGE_TERMS.items():
            out = re.sub(rf"\b{code}\b", meaning, out, flags=re.IGNORECASE)
        return " ".join(out.split()).strip(" -–:")

    @staticmethod
    def _expand_triple(match: "re.Match[str]") -> str:
        """'1-0-1' → 'Morning and night'. '1/2-0-1/2' → 'Half morning and half night'."""
        slots = []
        for qty, when in zip(match.groups(), ("morning", "afternoon", "night")):
            if qty == "0":
                continue
            slots.append(when if qty == "1" else f"half {when}")
        if not slots:
            return match.group()
        if len(slots) == 1:
            phrase = f"{slots[0]} only"
        else:
            phrase = ", ".join(slots[:-1]) + f" and {slots[-1]}"
        return phrase[0].upper() + phrase[1:]
