"""
Face Recognition Service
=========================
Uses the `face_recognition` library (dlib-based, 128-d embeddings).

Flow:
  1. register_face(patient_id, image) → extract 128-d embedding → store
  2. identify_face(image) → extract embedding → compare against all stored → return match

Why face_recognition library:
  - 99.38% accuracy on LFW benchmark
  - Works on CPU (no GPU needed)
  - Simple API: face_locations(), face_encodings(), compare_faces()
  - Perfect for controlled kiosk environment (consistent lighting, front-facing)

Perceptual-hash fallback
------------------------
dlib is a heavy build and is often not installed on a laptop. There is no mock
identification here: an earlier version returned a RANDOM stored patient 40% of
the time, which silently attached one patient's history to another patient's
report. The fallback is derived entirely from the photo the patient just gave —
an average-hash of THAT image turned into a 128-d vector and compared with the
same distance logic as the dlib path. The same photo always matches; a different
photo does not. `mode()` reports which reader produced a match so the doctor's
view can say how the patient was recognised.
"""

import hashlib
import io
import logging
from typing import Any, Dict, Optional

import numpy as np

from config import settings
from services.persistence import db

logger = logging.getLogger(__name__)

# Try importing face_recognition. If absent, use the perceptual-hash fallback.
try:
    import face_recognition
    FACE_LIB_AVAILABLE = True
    logger.info("[FACE] face_recognition library loaded successfully")
except ImportError:
    FACE_LIB_AVAILABLE = False
    logger.warning(
        "[FACE] face_recognition library not installed. Matching on a "
        "deterministic perceptual hash of the captured photo instead — weaker "
        "than dlib, but derived from the patient's own image. "
        "Install with: pip install face_recognition"
    )

# Perceptual-hash vectors live on a different scale from dlib embeddings, so they
# need their own threshold. 0.28 ≈ 10 differing bits out of 128.
PHASH_MATCH_THRESHOLD = 0.28
_PHASH_SIDE = (16, 8)  # 16x8 = 128 pixels = 128 dimensions


class FaceService:
    """
    In-memory face embedding store + recognition service.
    For production, embeddings would go to Supabase/PostgreSQL with pgvector.
    """

    def __init__(self):
        # Load persisted embeddings from disk
        self._embeddings: Dict[str, np.ndarray] = {}
        self._patients: Dict[str, Dict[str, Any]] = db.get_all_patients()
        # Was hardcoded to 0.6, so FACE_MATCH_THRESHOLD in .env did nothing.
        self._threshold = (
            float(settings.FACE_MATCH_THRESHOLD) if FACE_LIB_AVAILABLE
            else PHASH_MATCH_THRESHOLD
        )

        # Restore face embeddings from disk
        stored = db.get_all_embeddings()
        for pid, emb_list in stored.items():
            try:
                self._embeddings[pid] = np.array(emb_list, dtype=np.float64)
            except (TypeError, ValueError) as e:
                logger.error("[FACE] Ignoring malformed embedding for %s: %s", pid, e)
        logger.info(
            "[FACE] Loaded %d patients, %d face embeddings from disk (mode=%s, threshold=%.2f)",
            len(self._patients), len(self._embeddings),
            self.mode(), self._threshold,
        )

    def is_ready(self) -> bool:
        return FACE_LIB_AVAILABLE

    def mode(self) -> str:
        return "face_recognition" if FACE_LIB_AVAILABLE else "perceptual_hash"

    def store_patient(self, patient_id: str, data: Dict[str, Any]):
        """Store patient data in memory + disk."""
        self._patients[patient_id] = data
        db.save_patient(patient_id, data)

    def get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve patient data."""
        return self._patients.get(patient_id)

    def get_all_patients(self) -> Dict[str, Dict[str, Any]]:
        """Get all registered patients."""
        return self._patients

    # ── Perceptual-hash embedding (deterministic) ──────────────────────────

    @staticmethod
    def _phash_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
        """
        Average-hash the image into a 128-d 0/1 vector, scaled so that the
        Euclidean distance between two vectors is sqrt(hamming / 128) — i.e. in
        [0, 1]. Deterministic: the same image always produces the same vector.
        """
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(image_bytes)).convert("L").resize(
                _PHASH_SIDE, Image.Resampling.LANCZOS
            )
            pixels = np.asarray(img, dtype=np.float64).flatten()
            if pixels.size != 128:
                return None
            bits = (pixels > pixels.mean()).astype(np.float64)
            return bits / np.sqrt(128.0)
        except Exception as e:
            logger.error("[FACE:PHASH] Could not hash image (%s): %s", type(e).__name__, e)
            return None

    # ── Registration ───────────────────────────────────────────────────────

    async def register_face(self, patient_id: str, image_bytes: bytes) -> bool:
        """
        Extract 128-d face embedding from image and store linked to patient_id.

        Returns True if an embedding was stored, False otherwise.
        """
        if not FACE_LIB_AVAILABLE:
            embedding = self._phash_embedding(image_bytes)
            if embedding is None:
                logger.warning(
                    "[FACE:PHASH] Could not derive an embedding for %s — "
                    "face identification will not work for this patient.", patient_id
                )
                return False
            self._embeddings[patient_id] = embedding
            db.save_embedding(patient_id, embedding.tolist())
            logger.info(
                "[FACE:PHASH] Stored deterministic perceptual hash for %s (sha=%s)",
                patient_id, hashlib.sha256(image_bytes).hexdigest()[:8],
            )
            return True

        try:
            image = face_recognition.load_image_file(io.BytesIO(image_bytes))

            face_locations = face_recognition.face_locations(image, model="hog")
            if not face_locations:
                logger.warning("[FACE] No face detected in image for %s", patient_id)
                return False

            if len(face_locations) > 1:
                logger.warning(
                    "[FACE] Multiple faces detected for %s. Using the first one.",
                    patient_id,
                )

            encodings = face_recognition.face_encodings(image, face_locations)
            if not encodings:
                logger.warning("[FACE] Could not generate encoding for %s", patient_id)
                return False

            self._embeddings[patient_id] = encodings[0]
            db.save_embedding(patient_id, encodings[0].tolist())
            logger.info(
                "[FACE] Registered face for %s. Embedding shape: %s",
                patient_id, encodings[0].shape,
            )
            return True

        except Exception as e:
            logger.error("[FACE] Registration failed for %s: %s", patient_id, e)
            return False

    # ── Identification ─────────────────────────────────────────────────────

    async def identify_face(self, image_bytes: bytes) -> Optional[Dict[str, Any]]:
        """
        Compare captured face against all stored embeddings.

        Returns {"patient_id", "confidence", "distance", "method"} on a match,
        None otherwise. Never guesses.
        """
        if not self._embeddings:
            logger.info("[FACE] No stored embeddings to compare against")
            return None

        if FACE_LIB_AVAILABLE:
            probe = self._encode_probe(image_bytes)
        else:
            probe = self._phash_embedding(image_bytes)

        if probe is None:
            return None

        best_match, best_distance = None, float("inf")
        for patient_id, stored in self._embeddings.items():
            if getattr(stored, "shape", None) != probe.shape:
                # A stored vector from the other mode (or a corrupt file) must
                # not be compared — np would broadcast or raise.
                logger.debug(
                    "[FACE] Skipping %s: embedding shape %s != probe %s",
                    patient_id, getattr(stored, "shape", None), probe.shape,
                )
                continue
            distance = float(np.linalg.norm(probe - stored))
            if distance < best_distance:
                best_distance, best_match = distance, patient_id

        if best_match is None:
            logger.info("[FACE] No comparable embeddings found")
            return None

        if best_distance <= self._threshold:
            confidence = max(0.0, 1.0 - best_distance / max(self._threshold * 2, 1e-6))
            confidence = min(0.99, max(0.5, confidence))
            logger.info(
                "[FACE] Match: %s (distance=%.4f, threshold=%.2f, confidence=%.2f, mode=%s)",
                best_match, best_distance, self._threshold, confidence, self.mode(),
            )
            return {
                "patient_id": best_match,
                "confidence": round(confidence, 2),
                "distance": round(best_distance, 4),
                "method": self.mode(),
            }

        logger.info(
            "[FACE] No match. Best distance=%.4f (threshold=%.2f, mode=%s)",
            best_distance, self._threshold, self.mode(),
        )
        return None

    @staticmethod
    def _encode_probe(image_bytes: bytes) -> Optional[np.ndarray]:
        """Real dlib encoding of the probe image."""
        try:
            image = face_recognition.load_image_file(io.BytesIO(image_bytes))
            face_locations = face_recognition.face_locations(image, model="hog")
            if not face_locations:
                logger.info("[FACE] No face detected in identification image")
                return None
            encodings = face_recognition.face_encodings(image, face_locations)
            return encodings[0] if encodings else None
        except Exception as e:
            logger.error("[FACE] Identification failed: %s", e)
            return None

    def get_embedding_count(self) -> int:
        """Number of face embeddings stored."""
        return len(self._embeddings)
