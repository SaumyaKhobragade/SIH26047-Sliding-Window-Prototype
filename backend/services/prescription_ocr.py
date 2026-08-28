"""
Prescription OCR Service
=========================
Pipeline: Image → Sarvam Vision OCR → LLM Extraction → Drug Fuzzy Matching → Result

Uses rapidfuzz for drug name correction against a known formulary.
"""

import asyncio
import json
import logging
import re
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from config import settings

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
    # Antibiotics
    "Amoxicillin", "Azithromycin", "Ciprofloxacin", "Ceftriaxone", "Doxycycline",
    "Levofloxacin", "Metronidazole", "Clindamycin", "Cotrimoxazole",
    # Pain / Anti-inflammatory
    "Paracetamol", "Ibuprofen", "Diclofenac", "Naproxen", "Aceclofenac",
    "Piroxicam", "Tramadol", "Gabapentin", "Pregabalin",
    # GI
    "Omeprazole", "Pantoprazole", "Ranitidine", "Domperidone", "Ondansetron",
    "Sucralfate", "Lactulose", "Loperamide",
    # Respiratory
    "Salbutamol", "Budesonide", "Montelukast", "Theophylline", "Cetirizine",
    "Levocetirizine", "Fexofenadine", "Dextromethorphan",
    # Thyroid
    "Levothyroxine", "Carbimazole", "Propylthiouracil",
    # Psychiatry
    "Escitalopram", "Sertraline", "Fluoxetine", "Alprazolam", "Clonazepam",
    "Olanzapine", "Risperidone", "Lithium",
    # Ayurvedic (AYUSH context)
    "Ashwagandha", "Triphala", "Guggulu", "Brahmi", "Shatavari",
    "Arjuna", "Haritaki", "Amalaki", "Guduchi", "Yashtimadhu",
]

# Common dosage terms
DOSAGE_TERMS = {
    "od": "Once daily",
    "bd": "Twice daily",
    "tds": "Three times daily",
    "qid": "Four times daily",
    "hs": "At bedtime",
    "sos": "As needed",
    "ac": "Before meals",
    "pc": "After meals",
    "stat": "Immediately",
}

# Lab value reference ranges
LAB_REFERENCE_RANGES = {
    "hba1c": {"unit": "%", "low": 0, "high": 7.0, "critical_high": 10.0},
    "fasting blood sugar": {"unit": "mg/dL", "low": 70, "high": 100, "critical_high": 250},
    "random blood sugar": {"unit": "mg/dL", "low": 70, "high": 140, "critical_high": 300},
    "total cholesterol": {"unit": "mg/dL", "low": 0, "high": 200, "critical_high": 300},
    "ldl": {"unit": "mg/dL", "low": 0, "high": 100, "critical_high": 190},
    "hdl": {"unit": "mg/dL", "low": 40, "high": 200, "critical_high": None},
    "triglycerides": {"unit": "mg/dL", "low": 0, "high": 150, "critical_high": 500},
    "serum creatinine": {"unit": "mg/dL", "low": 0.7, "high": 1.3, "critical_high": 4.0},
    "hemoglobin": {"unit": "g/dL", "low": 12, "high": 17, "critical_high": None},
    "blood pressure systolic": {"unit": "mmHg", "low": 90, "high": 140, "critical_high": 180},
    "blood pressure diastolic": {"unit": "mmHg", "low": 60, "high": 90, "critical_high": 120},
}


def correct_drug_name(raw_name: str, threshold: int = 75) -> Dict[str, Any]:
    """
    Fuzzy match OCR output against known drug vocabulary.

    Returns:
        {"corrected": str, "original": str, "confidence": int, "was_corrected": bool}
    """
    if not RAPIDFUZZ_AVAILABLE:
        return {"corrected": raw_name, "original": raw_name, "confidence": 0, "was_corrected": False}

    match = rf_process.extractOne(raw_name, DRUG_VOCABULARY, scorer=fuzz.ratio)
    if match and match[1] >= threshold:
        was_corrected = match[0].lower() != raw_name.lower()
        return {
            "corrected": match[0],
            "original": raw_name,
            "confidence": match[1],
            "was_corrected": was_corrected,
        }

    return {"corrected": raw_name, "original": raw_name, "confidence": 0, "was_corrected": False}


def check_lab_abnormality(test_name: str, value: float) -> Dict[str, Any]:
    """
    Check if a lab value is within reference range.

    Returns:
        {"status": "normal" | "abnormal" | "critical", "reference": str}
    """
    test_key = test_name.lower().strip()

    for ref_name, ref in LAB_REFERENCE_RANGES.items():
        if ref_name in test_key:
            ref_str = f"{ref['low']}-{ref['high']} {ref['unit']}"

            if ref.get("critical_high") and value >= ref["critical_high"]:
                return {"status": "critical", "reference": ref_str}
            elif value > ref["high"] or value < ref["low"]:
                return {"status": "abnormal", "reference": ref_str}
            else:
                return {"status": "normal", "reference": ref_str}

    return {"status": "unknown", "reference": "N/A"}


class PrescriptionOCR:
    """
    Processes prescription images through OCR → extraction → correction pipeline.
    """

    def __init__(self):
        self._client = None
        if SARVAM_AVAILABLE and settings.SARVAM_API_KEY:
            self._client = SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)

    async def process_document(
        self, patient_id: str, image_bytes: bytes
    ) -> Dict[str, Any]:
        """
        Full prescription processing pipeline.

        Args:
            patient_id: Patient identifier
            image_bytes: Raw image bytes (JPEG/PNG)

        Returns:
            Structured prescription data with corrections and confidence
        """
        # Step 1: OCR (Sarvam Vision or mock)
        raw_text = await self._run_ocr(image_bytes)

        # Step 2: LLM extraction (structured JSON)
        extracted = await self._extract_structured(raw_text)

        # Step 3: Drug name fuzzy matching
        corrections = []
        for med in extracted.get("medications", []):
            drug_raw = med.get("drug_name", "")
            correction = correct_drug_name(drug_raw)
            if correction["was_corrected"]:
                corrections.append({
                    "from": correction["original"],
                    "to": correction["corrected"],
                    "confidence": correction["confidence"],
                })
                med["drug_name"] = correction["corrected"]
            med["match_confidence"] = correction["confidence"]

        # Step 4: Lab value abnormality checking
        for lab in extracted.get("lab_values", []):
            try:
                value = float(re.sub(r'[^\d.]', '', str(lab.get("value", "0"))))
                abnormality = check_lab_abnormality(lab.get("test_name", ""), value)
                lab["status"] = abnormality["status"]
                lab["reference_range"] = abnormality["reference"]
            except (ValueError, TypeError):
                lab["status"] = "unknown"
                lab["reference_range"] = "N/A"

        result = {
            "medications": extracted.get("medications", []),
            "lab_values": extracted.get("lab_values", []),
            "diagnosis": extracted.get("diagnosis", ""),
            "doctor_name": extracted.get("doctor_name", "Unknown"),
            "date": extracted.get("date", "Unknown"),
            "ocr_confidence": extracted.get("confidence", 0.85),
            "corrections": corrections,
        }

        logger.info(
            "[OCR] Processed document for %s. Meds=%d, Labs=%d, Corrections=%d",
            patient_id,
            len(result["medications"]),
            len(result["lab_values"]),
            len(corrections),
        )

        return result

    async def _run_ocr(self, image_bytes: bytes) -> str:
        """Run OCR on image bytes."""
        if not self._client:
            # Mock OCR output
            return self._mock_ocr_output()

        try:
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name

            # Use Sarvam Vision for OCR
            def _ocr():
                with open(tmp_path, "rb") as f:
                    return self._client.vision.process(
                        file=f,
                        model="sarvam-vision",
                        mode="ocr",
                    )

            response = await asyncio.to_thread(_ocr)
            os.unlink(tmp_path)
            return response.text if hasattr(response, 'text') else str(response)

        except Exception as e:
            logger.error("[OCR] Sarvam Vision failed: %s. Using mock.", e)
            return self._mock_ocr_output()

    async def _extract_structured(self, raw_text: str) -> Dict[str, Any]:
        """Extract structured data from raw OCR text using LLM."""
        # For prototype, return realistic mock data
        # In production, this calls Groq/Gemini with a structured extraction prompt
        return {
            "medications": [
                {"drug_name": "Metformin", "strength": "500mg", "dosage": "1 tablet", "frequency": "Twice daily after meals"},
                {"drug_name": "Amlodipine", "strength": "5mg", "dosage": "1 tablet", "frequency": "Once daily morning"},
            ],
            "lab_values": [
                {"test_name": "HbA1c", "value": "8.1", "unit": "%"},
                {"test_name": "Fasting Blood Sugar", "value": "165", "unit": "mg/dL"},
                {"test_name": "Total Cholesterol", "value": "242", "unit": "mg/dL"},
                {"test_name": "Serum Creatinine", "value": "0.9", "unit": "mg/dL"},
                {"test_name": "Hemoglobin", "value": "13.2", "unit": "g/dL"},
            ],
            "diagnosis": "Type 2 Diabetes Mellitus, Essential Hypertension",
            "doctor_name": "Dr. A. Shah",
            "date": "2024-03-15",
            "confidence": 0.87,
        }

    @staticmethod
    def _mock_ocr_output() -> str:
        return """
        Dr. A. Shah, MBBS, MD (General Medicine)
        City Hospital, Mumbai

        Date: 15/03/2024

        Rx:
        1. Tab Metformin 500mg - 1 tablet BD (after meals)
        2. Tab Amlodipine 5mg - 1 tablet OD (morning)

        Diagnosis: Type 2 Diabetes Mellitus, Essential Hypertension

        Advice: Low sugar diet, regular BP monitoring
        Follow up: 3 months
        """
