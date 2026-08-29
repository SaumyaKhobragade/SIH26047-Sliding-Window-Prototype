"""
RAG Service — Patient History Retrieval
========================================
Persistent version: stores and retrieves patient visit history from disk.
Uses the persistence layer so data survives server restarts.

In the real system, this uses:
  - ChromaDB for vector storage
  - sentence-transformers (all-MiniLM-L6-v2) for embeddings
  - Semantic search over past visit notes
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from services.persistence import db

logger = logging.getLogger(__name__)

UNKNOWN_DATE = "Unknown"
# Sorts after every real ISO date, so undated entries land at the end instead of
# raising TypeError when compared against a str.
_SORT_SENTINEL = "9999-12-31"


def _sort_key(entry: Dict[str, Any]) -> str:
    """
    Date sort key that tolerates None, missing keys and non-strings.
    `x.get("date", "")` returned None when the key existed with a null value,
    and `None < str` raises TypeError — that crashed /summary/generate with a
    500 for any patient whose document had no date.
    """
    value = entry.get("date")
    if not isinstance(value, str) or not value.strip():
        return _SORT_SENTINEL
    return value.strip()


class RAGService:
    """
    Persistent RAG service backed by JSON files.
    Stores visit history and scanned documents per patient.
    """

    def store_visit(
        self,
        patient_id: str,
        session_id: str,
        confirmed: bool = False,
        edits: Optional[str] = None,
        clinical_fields: Optional[Dict[str, str]] = None,
        raw_answers: Optional[Dict[str, str]] = None,
        red_flags: Optional[List[str]] = None,
    ):
        """
        Store a completed visit for future RAG retrieval.

        This is the ONLY place a visit record is written. main.py used to call
        this AND db.save_visit() with a second record, so each confirmation
        counted as two visits.
        """
        now = datetime.now(timezone.utc)
        visit_data = {
            "session_id": session_id,
            "timestamp": now.isoformat(),
            # Pre-sliced ISO date so timeline sorting never has to parse.
            "date": now.date().isoformat(),
            "confirmed": confirmed,
            "edits": edits,
            "clinical_fields": clinical_fields or {},
            "raw_answers": raw_answers or {},
            "red_flags": red_flags or [],
        }
        db.save_visit(patient_id, visit_data)
        logger.info(
            "[RAG] Stored visit for %s. Total visits: %d",
            patient_id,
            db.get_visit_count(patient_id),
        )

    def store_document(self, patient_id: str, document_data: Dict[str, Any]):
        """Store a scanned document for future retrieval."""
        now = datetime.now(timezone.utc)
        doc_with_meta = {
            **document_data,
            "stored_at": now.isoformat(),
            # Which visit produced this scan. retrieve_past_history() uses it to
            # exclude documents scanned during the CURRENT visit.
            "scanned_on": now.date().isoformat(),
        }
        db.save_document(patient_id, doc_with_meta)
        logger.info(
            "[RAG] Stored document for %s. Total docs: %d",
            patient_id,
            len(db.get_documents(patient_id)),
        )

    def get_visit_count(self, patient_id: str) -> int:
        """Get number of past visits for a patient."""
        return db.get_visit_count(patient_id)

    def get_patient_documents(self, patient_id: str) -> List[Dict[str, Any]]:
        """Get all scanned documents for a patient."""
        return db.get_documents(patient_id)

    def retrieve_past_history(self, patient_id: str) -> Dict[str, Any]:
        """
        Retrieve past history for a patient.
        In production, this would do vector similarity search against ChromaDB.
        For prototype, reads from persisted JSON files.

        `found` is True only when there is at least one CONFIRMED PAST VISIT.
        It used to be True whenever any document existed — including the
        prescription the patient had just scanned seconds earlier — so every
        first-time patient's report claimed "RAG-enriched from past visits".
        """
        visits = db.get_visits(patient_id)
        documents = db.get_documents(patient_id)

        # A prior visit is what makes someone a returning patient. Documents
        # scanned in the current session do not count.
        past_visits = [v for v in visits if v.get("confirmed")]
        is_returning = len(past_visits) > 0

        empty = {
            "found": False,
            "is_returning": False,
            "visit_count": 0,
            "chronic_conditions": [],
            "past_medications": [],
            "past_diagnoses": [],
            "timeline": [],
        }

        if not is_returning and not documents:
            return empty

        # Compile history from stored documents
        all_medications: List[str] = []
        all_diagnoses: List[str] = []
        timeline_entries: List[Dict[str, Any]] = []

        for doc in documents:
            for med in doc.get("medications", []):
                med_str = " ".join(
                    str(med.get(k, "") or "").strip()
                    for k in ("drug_name", "strength", "frequency")
                ).strip()
                med_str = " ".join(med_str.split())
                if med_str and med_str not in all_medications:
                    all_medications.append(med_str)

            diagnosis = (doc.get("diagnosis") or "").strip()
            if diagnosis and diagnosis not in all_diagnoses:
                all_diagnoses.append(diagnosis)

            doc_date = doc.get("date") or doc.get("scanned_on") or UNKNOWN_DATE
            timeline_entries.append({
                "date": doc_date,
                "type": "prescription" if doc.get("medications") else "lab_report",
                "doctor": doc.get("doctor_name") or "Unknown",
                "summary": diagnosis or "Lab investigation",
                "medications": [
                    " ".join(
                        str(m.get(k, "") or "").strip() for k in ("drug_name", "strength")
                    ).strip()
                    for m in doc.get("medications", [])
                ],
                "source": "scanned_document",
                "ocr_confidence": doc.get("ocr_confidence"),
            })

        # Add visit-level timeline entries (confirmed visits only)
        for visit in past_visits:
            timestamp = visit.get("timestamp") or ""
            date = visit.get("date") or (timestamp[:10] if timestamp else UNKNOWN_DATE)
            cc = (visit.get("clinical_fields") or {}).get("chief_complaint", "")
            session_ref = str(visit.get("session_id") or "N/A")[:12]
            timeline_entries.append({
                "date": date or UNKNOWN_DATE,
                "type": "visit",
                "doctor": "MediKiosk AI Intake",
                "summary": cc or f"Clinical interview (session {session_ref})",
                "medications": [],
                "source": "kiosk_visit",
                "red_flags": visit.get("red_flags", []),
            })

        timeline_entries.sort(key=_sort_key)

        return {
            "found": is_returning,
            "is_returning": is_returning,
            "visit_count": len(past_visits),
            "chronic_conditions": all_diagnoses,
            "past_medications": all_medications,
            "past_diagnoses": all_diagnoses,
            "timeline": timeline_entries,
        }
