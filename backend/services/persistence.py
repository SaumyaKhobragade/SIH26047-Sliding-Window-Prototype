"""
Persistence Layer — JSON File Storage
=======================================
Simple file-based persistence for the prototype.
Stores all data as JSON files in a 'data/' directory.

Why JSON files instead of a real DB for prototype:
  - Zero setup (no PostgreSQL, no MongoDB, no Docker)
  - Human-readable (judges can inspect the data)
  - Survives server restarts
  - Easy to demo "returning patient" flow

In production, this would be replaced by:
  - Supabase (PostgreSQL) for patient records
  - ChromaDB for vector embeddings (RAG)
  - MongoDB for audit logs
"""

import json
import os
import logging
from typing import Any, Dict, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"


class PersistenceLayer:
    """
    File-based JSON persistence. Each patient gets a folder.
    Structure:
      data/
        patients.json          — master patient registry
        embeddings/
          PT-XXXX.json         — face embedding (as list of floats)
        visits/
          PT-XXXX/
            visit_001.json     — visit record + clinical fields
            visit_002.json     — next visit
        documents/
          PT-XXXX/
            doc_001.json       — scanned prescription/lab data
        sessions/
          SESS-XXXX.json       — ACI session state (for resume)
    """

    def __init__(self):
        self._ensure_dirs()
        self._patients = self._load_json(DATA_DIR / "patients.json", {})
        logger.info(
            "[DB] Persistence loaded. %d patients in registry.",
            len(self._patients),
        )

    def _ensure_dirs(self):
        for subdir in ["embeddings", "visits", "documents", "sessions"]:
            (DATA_DIR / subdir).mkdir(parents=True, exist_ok=True)

    def _load_json(self, path: Path, default=None):
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                logger.warning("[DB] Corrupted file %s, using default", path)
        return default if default is not None else {}

    def _save_json(self, path: Path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)

    # ── Patient Registry ──────────────────────────────────────────────────

    def save_patient(self, patient_id: str, data: Dict[str, Any]):
        """Save patient to registry."""
        self._patients[patient_id] = data
        self._save_json(DATA_DIR / "patients.json", self._patients)
        logger.info("[DB] Patient %s saved.", patient_id)

    def get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Get patient by ID."""
        return self._patients.get(patient_id)

    def get_all_patients(self) -> Dict[str, Dict[str, Any]]:
        """Get all patients."""
        return self._patients

    def find_patient_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Search patient by name (case-insensitive)."""
        for pid, pdata in self._patients.items():
            if pdata.get("name", "").lower() == name.lower():
                return {**pdata, "patient_id": pid}
        return None

    # ── Face Embeddings ───────────────────────────────────────────────────

    def save_embedding(self, patient_id: str, embedding: list):
        """Save face embedding as JSON list of floats."""
        self._save_json(
            DATA_DIR / "embeddings" / f"{patient_id}.json",
            {"patient_id": patient_id, "embedding": embedding},
        )
        logger.info("[DB] Face embedding saved for %s (%d dims)", patient_id, len(embedding))

    def get_embedding(self, patient_id: str) -> Optional[list]:
        """Load face embedding for a patient."""
        data = self._load_json(DATA_DIR / "embeddings" / f"{patient_id}.json")
        return data.get("embedding") if data else None

    def get_all_embeddings(self) -> Dict[str, list]:
        """Load all stored embeddings. Used for face matching."""
        result = {}
        emb_dir = DATA_DIR / "embeddings"
        if emb_dir.exists():
            for f in emb_dir.glob("*.json"):
                data = self._load_json(f)
                if data and "embedding" in data:
                    result[data["patient_id"]] = data["embedding"]
        return result

    # ── Visit History ─────────────────────────────────────────────────────

    def save_visit(self, patient_id: str, visit_data: Dict[str, Any]):
        """Save a completed visit."""
        visit_dir = DATA_DIR / "visits" / patient_id
        visit_dir.mkdir(parents=True, exist_ok=True)

        existing = list(visit_dir.glob("visit_*.json"))
        visit_num = len(existing) + 1
        filename = f"visit_{visit_num:03d}.json"

        self._save_json(visit_dir / filename, visit_data)
        logger.info("[DB] Visit %d saved for %s", visit_num, patient_id)

    def get_visits(self, patient_id: str) -> List[Dict[str, Any]]:
        """Get all visits for a patient, sorted by date."""
        visit_dir = DATA_DIR / "visits" / patient_id
        if not visit_dir.exists():
            return []

        visits = []
        for f in sorted(visit_dir.glob("visit_*.json")):
            data = self._load_json(f)
            if data:
                visits.append(data)
        return visits

    def get_visit_count(self, patient_id: str) -> int:
        """Get number of past visits."""
        visit_dir = DATA_DIR / "visits" / patient_id
        if not visit_dir.exists():
            return 0
        return len(list(visit_dir.glob("visit_*.json")))

    # ── Scanned Documents ─────────────────────────────────────────────────

    def save_document(self, patient_id: str, doc_data: Dict[str, Any]):
        """Save a scanned document (prescription/lab report)."""
        doc_dir = DATA_DIR / "documents" / patient_id
        doc_dir.mkdir(parents=True, exist_ok=True)

        existing = list(doc_dir.glob("doc_*.json"))
        doc_num = len(existing) + 1
        filename = f"doc_{doc_num:03d}.json"

        self._save_json(doc_dir / filename, doc_data)
        logger.info("[DB] Document %d saved for %s", doc_num, patient_id)

    def get_documents(self, patient_id: str) -> List[Dict[str, Any]]:
        """Get all scanned documents for a patient."""
        doc_dir = DATA_DIR / "documents" / patient_id
        if not doc_dir.exists():
            return []

        docs = []
        for f in sorted(doc_dir.glob("doc_*.json")):
            data = self._load_json(f)
            if data:
                docs.append(data)
        return docs

    # ── ACI Sessions ──────────────────────────────────────────────────────

    def save_session(self, session_id: str, session_data: Dict[str, Any]):
        """Save ACI session state (for resume if server restarts)."""
        self._save_json(DATA_DIR / "sessions" / f"{session_id}.json", session_data)

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Load a saved session."""
        return self._load_json(DATA_DIR / "sessions" / f"{session_id}.json")


# Singleton instance
db = PersistenceLayer()
