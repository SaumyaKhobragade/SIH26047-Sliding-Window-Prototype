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
import tempfile
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
                raw = path.read_text(encoding="utf-8").strip()
                if not raw:
                    # A 0-byte file is what an interrupted non-atomic write left
                    # behind. Treat it as "empty", not "corrupt".
                    logger.warning("[DB] Empty file %s, treating as empty record", path)
                else:
                    return json.loads(raw)
            except json.JSONDecodeError as e:
                # Never silently discard data — quarantine it so it can be
                # recovered, then continue with the default.
                backup = path.with_suffix(path.suffix + ".corrupt")
                try:
                    path.replace(backup)
                    logger.error(
                        "[DB] Corrupted JSON in %s (%s). Moved to %s", path, e, backup.name
                    )
                except OSError:
                    logger.error("[DB] Corrupted JSON in %s (%s)", path, e)
            except OSError as e:
                logger.error("[DB] Could not read %s: %s", path, e)
        return default if default is not None else {}

    def _save_json(self, path: Path, data):
        """
        Atomic write: serialise to a temp file in the same directory, fsync, then
        os.replace(). A crash mid-write can no longer leave a truncated or
        0-byte JSON file behind (which is how patients.json got wiped).
        """
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(data, indent=2, ensure_ascii=False, default=str)
        tmp_fd, tmp_name = tempfile.mkstemp(
            dir=str(path.parent), prefix=path.name + ".", suffix=".tmp"
        )
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                f.write(payload)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_name, path)  # atomic on both POSIX and Windows
        except Exception:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise

    # ── Patient Registry ──────────────────────────────────────────────────

    @staticmethod
    def _next_numbered_path(directory: Path, prefix: str) -> Path:
        """
        Next free `<prefix>_NNN.json` in `directory`.

        Counting the existing files was wrong: deleting visit_002 made the next
        save reuse visit_003's slot and clobber it. Take max(index) + 1 and
        still verify the name is free.
        """
        directory.mkdir(parents=True, exist_ok=True)
        highest = 0
        for f in directory.glob(f"{prefix}_*.json"):
            stem = f.stem[len(prefix) + 1:]
            if stem.isdigit():
                highest = max(highest, int(stem))
        n = highest + 1
        while (directory / f"{prefix}_{n:03d}.json").exists():
            n += 1
        return directory / f"{prefix}_{n:03d}.json"

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
        """
        Save a completed visit, keyed by session.

        The doctor's report offers three separate confirm buttons ("Send to
        Doctor", "Confirm & Save", and the readback's "Haan, sahi hai"), and each
        POSTs /summary/confirm. Appending unconditionally meant one consultation
        could be stored as three visits, so the next time that patient walked in
        the kiosk told the doctor they had three prior encounters. A repeat
        confirmation of the SAME session now overwrites its own record.
        """
        visit_dir = DATA_DIR / "visits" / patient_id
        session_id = visit_data.get("session_id")
        path = None
        if session_id and visit_dir.exists():
            for f in sorted(visit_dir.glob("visit_*.json")):
                existing = self._load_json(f)
                if existing and existing.get("session_id") == session_id:
                    path = f
                    break
        if path is None:
            path = self._next_numbered_path(visit_dir, "visit")
            logger.info("[DB] Visit saved for %s -> %s", patient_id, path.name)
        else:
            logger.info(
                "[DB] Visit %s re-confirmed for %s -> %s (no new visit record)",
                session_id, patient_id, path.name,
            )
        self._save_json(path, visit_data)

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
        path = self._next_numbered_path(doc_dir, "doc")
        self._save_json(path, doc_data)
        logger.info("[DB] Document saved for %s -> %s", patient_id, path.name)

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
