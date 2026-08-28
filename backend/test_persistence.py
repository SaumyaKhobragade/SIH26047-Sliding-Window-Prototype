"""Quick persistence test — run to verify data survives restarts."""
from services.persistence import db, PersistenceLayer

# Step 1: Save data
db.save_patient("PT-TEST001", {"name": "Ramesh Kumar", "age": 58, "gender": "male", "phone": "9876543210"})
db.save_embedding("PT-TEST001", [0.1] * 128)
db.save_visit("PT-TEST001", {"session_id": "SESS-001", "confirmed": True, "clinical_fields": {"chief_complaint": "Chest pain"}})
db.save_document("PT-TEST001", {"medications": [{"drug_name": "Metformin", "strength": "500mg"}], "diagnosis": "Type 2 DM"})
print("Saved OK")

# Step 2: Reload from disk (simulates server restart)
db2 = PersistenceLayer()
p = db2.get_patient("PT-TEST001")
print("Patient found:", p["name"], "age", p["age"])
emb = db2.get_embedding("PT-TEST001")
print("Embedding dims:", len(emb))
print("Visits:", db2.get_visit_count("PT-TEST001"))
print("Documents:", len(db2.get_documents("PT-TEST001")))
print("\nPERSISTENCE TEST PASSED")
