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
"""

import logging
import io
import numpy as np
from typing import Dict, List, Optional, Any

from services.persistence import db

logger = logging.getLogger(__name__)

# Try importing face_recognition. If not available, fall back to mock mode.
try:
    import face_recognition
    FACE_LIB_AVAILABLE = True
    logger.info("[FACE] face_recognition library loaded successfully")
except ImportError:
    FACE_LIB_AVAILABLE = False
    logger.warning(
        "[FACE] face_recognition library not installed. "
        "Running in MOCK mode. Install with: pip install face_recognition"
    )


class FaceService:
    """
    In-memory face embedding store + recognition service.
    For production, embeddings would go to Supabase/PostgreSQL with pgvector.
    """

    def __init__(self):
        # Load persisted embeddings from disk
        self._embeddings: Dict[str, np.ndarray] = {}
        self._patients: Dict[str, Dict[str, Any]] = db.get_all_patients()
        self._threshold = 0.6

        # Restore face embeddings from disk
        stored = db.get_all_embeddings()
        for pid, emb_list in stored.items():
            self._embeddings[pid] = np.array(emb_list)
        logger.info("[FACE] Loaded %d patients, %d face embeddings from disk", len(self._patients), len(self._embeddings))

    def is_ready(self) -> bool:
        return FACE_LIB_AVAILABLE

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

    async def register_face(self, patient_id: str, image_bytes: bytes) -> bool:
        """
        Extract 128-d face embedding from image and store linked to patient_id.

        Args:
            patient_id: Unique patient identifier
            image_bytes: Raw image bytes (JPEG/PNG)

        Returns:
            True if face was detected and embedding stored, False otherwise
        """
        if not FACE_LIB_AVAILABLE:
            # Mock: generate random embedding for demo
            self._embeddings[patient_id] = np.random.randn(128).astype(np.float64)
            db.save_embedding(patient_id, self._embeddings[patient_id].tolist())
            logger.info("[FACE:MOCK] Generated mock embedding for %s", patient_id)
            return True

        try:
            # Load image from bytes
            image = face_recognition.load_image_file(io.BytesIO(image_bytes))

            # Detect face locations
            face_locations = face_recognition.face_locations(image, model="hog")
            if not face_locations:
                logger.warning("[FACE] No face detected in image for %s", patient_id)
                return False

            if len(face_locations) > 1:
                logger.warning(
                    "[FACE] Multiple faces detected for %s. Using the first one.",
                    patient_id,
                )

            # Generate 128-d embedding
            encodings = face_recognition.face_encodings(image, face_locations)
            if not encodings:
                logger.warning("[FACE] Could not generate encoding for %s", patient_id)
                return False

            # Store the first face's embedding
            self._embeddings[patient_id] = encodings[0]
            db.save_embedding(patient_id, encodings[0].tolist())
            logger.info(
                "[FACE] Registered face for %s. Embedding shape: %s",
                patient_id,
                encodings[0].shape,
            )
            return True

        except Exception as e:
            logger.error("[FACE] Registration failed for %s: %s", patient_id, e)
            return False

    async def identify_face(
        self, image_bytes: bytes
    ) -> Optional[Dict[str, Any]]:
        """
        Compare captured face against all stored embeddings.

        Args:
            image_bytes: Raw image bytes from kiosk camera

        Returns:
            {"patient_id": str, "confidence": float} if match found, None otherwise
        """
        if not self._embeddings:
            logger.info("[FACE] No stored embeddings to compare against")
            return None

        if not FACE_LIB_AVAILABLE:
            # Mock: return a random match 40% of the time
            import random
            if random.random() > 0.6 and self._embeddings:
                pid = random.choice(list(self._embeddings.keys()))
                return {"patient_id": pid, "confidence": round(random.uniform(0.85, 0.98), 2)}
            return None

        try:
            # Load and encode the input face
            image = face_recognition.load_image_file(io.BytesIO(image_bytes))
            face_locations = face_recognition.face_locations(image, model="hog")

            if not face_locations:
                logger.info("[FACE] No face detected in identification image")
                return None

            input_encoding = face_recognition.face_encodings(image, face_locations)
            if not input_encoding:
                return None

            input_enc = input_encoding[0]

            # Compare against all stored embeddings
            best_match = None
            best_distance = float("inf")

            for patient_id, stored_enc in self._embeddings.items():
                # Euclidean distance (lower = more similar)
                distance = np.linalg.norm(input_enc - stored_enc)

                if distance < best_distance:
                    best_distance = distance
                    best_match = patient_id

            if best_match and best_distance <= self._threshold:
                # Convert distance to confidence (0-1, higher = more confident)
                confidence = max(0, 1.0 - best_distance)
                logger.info(
                    "[FACE] Match found: %s (distance=%.4f, confidence=%.2f)",
                    best_match,
                    best_distance,
                    confidence,
                )
                return {
                    "patient_id": best_match,
                    "confidence": round(confidence, 2),
                }

            logger.info(
                "[FACE] No match found. Best distance=%.4f (threshold=%.2f)",
                best_distance,
                self._threshold,
            )
            return None

        except Exception as e:
            logger.error("[FACE] Identification failed: %s", e)
            return None

    def get_embedding_count(self) -> int:
        """Number of face embeddings stored."""
        return len(self._embeddings)
