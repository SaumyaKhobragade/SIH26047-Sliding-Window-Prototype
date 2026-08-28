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
    ):
        """Store a completed visit for future RAG retrieval."""
        visit_data = {
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "confirmed": confirmed,
            "edits": edits,
        }
        db.save_visit(patient_id, visit_data)
        logger.info(
            "[RAG] Stored visit for %s. Total visits: %d",
            patient_id,
            db.get_visit_count(patient_id),
        )

    def store_document(self, patient_id: str, document_data: Dict[str, Any]):
        """Store a scanned document for future retrieval."""
        doc_with_meta = {
            **document_data,
            "stored_at": datetime.now(timezone.utc).isoformat(),
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
        """
        visits = db.get_visits(patient_id)
        documents = db.get_documents(patient_id)

        if not visits and not documents:
            return {
                "found": False,
                "visit_count": 0,
                "chronic_conditions": [],
                "past_medications": [],
                "past_diagnoses": [],
                "timeline": [],
            }

        # Compile history from stored documents
        all_medications = []
        all_diagnoses = []
        timeline_entries = []

        for doc in documents:
            for med in doc.get("medications", []):
                med_str = f"{med.get('drug_name', '')} {med.get('strength', '')} {med.get('frequency', '')}"
                if med_str.strip() and med_str not in all_medications:
                    all_medications.append(med_str.strip())

            diagnosis = doc.get("diagnosis", "")
            if diagnosis and diagnosis not in all_diagnoses:
                all_diagnoses.append(diagnosis)

            timeline_entries.append({
                "date": doc.get("date", "Unknown"),
                "type": "prescription" if doc.get("medications") else "lab_report",
                "doctor": doc.get("doctor_name", "Unknown"),
                "summary": diagnosis or "Lab investigation",
                "medications": [
                    f"{m.get('drug_name', '')} {m.get('strength', '')}"
                    for m in doc.get("medications", [])
                ],
            })

        # Add visit-level timeline entries
        for visit in visits:
            timeline_entries.append({
                "date": visit.get("timestamp", "Unknown")[:10],
                "type": "visit",
                "doctor": "MediKiosk AI Intake",
                "summary": f"Clinical interview (Session: {visit.get('session_id', 'N/A')[:12]}...)",
                "medications": [],
            })

        # Sort timeline by date
        timeline_entries.sort(key=lambda x: x.get("date", ""), reverse=False)

        return {
            "found": True,
            "visit_count": len(visits),
            "chronic_conditions": all_diagnoses,
            "past_medications": all_medications,
            "past_diagnoses": all_diagnoses,
            "timeline": timeline_entries,
        }
