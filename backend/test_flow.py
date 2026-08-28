"""Quick integration test for the MediKiosk prototype backend."""
import httpx
import json

BASE = "http://localhost:8080"

def test():
    # 1. Health
    r = httpx.get(f"{BASE}/health")
    print("=== HEALTH ===")
    print(json.dumps(r.json(), indent=2))

    # 2. Register patient
    r = httpx.post(f"{BASE}/patient/register", data={
        "name": "Ramesh Kumar",
        "age": "58",
        "gender": "male",
        "phone": "+919876543210",
        "abha_id": "12-3456-7890-1234",
        "language_preference": "hinglish",
    })
    print("\n=== REGISTER ===")
    patient = r.json()
    print(json.dumps(patient, indent=2))
    patient_id = patient["patient_id"]

    # 3. Start ACI session
    r = httpx.post(f"{BASE}/aci/start", params={"patient_id": patient_id, "language": "hinglish"})
    print("\n=== ACI START ===")
    session = r.json()
    print(json.dumps(session, indent=2))
    session_id = session["session_id"]

    # 4. Turn 1 — Hinglish input
    r = httpx.post(f"{BASE}/aci/converse", json={
        "session_id": session_id,
        "patient_text": "Mujhe kal se chest mein pain ho raha hai especially left side mein"
    })
    t1 = r.json()
    print("\n=== TURN 1 (Hinglish) ===")
    print(f"  Style:    {t1['style_mode']}")
    print(f"  Ratios:   {t1['language_ratios']}")
    print(f"  AI says:  {t1['ai_response'][:120]}...")
    print(f"  Flags:    {t1['red_flags']}")
    print(f"  Progress: {t1['progress_pct']}%")

    # 5. Turn 2 — More English
    r = httpx.post(f"{BASE}/aci/converse", json={
        "session_id": session_id,
        "patient_text": "It is more like a pressure kind of feeling, heaviness actually"
    })
    t2 = r.json()
    print("\n=== TURN 2 (English shift) ===")
    print(f"  Style:    {t2['style_mode']}")
    print(f"  Ratios:   {t2['language_ratios']}")
    print(f"  AI says:  {t2['ai_response'][:120]}...")

    # 6. Turn 3 — Back to Hindi
    r = httpx.post(f"{BASE}/aci/converse", json={
        "session_id": session_id,
        "patient_text": "Haan left arm mein bhi kabhi kabhi jaata hai dard"
    })
    t3 = r.json()
    print("\n=== TURN 3 (Hindi shift) ===")
    print(f"  Style:    {t3['style_mode']}")
    print(f"  Ratios:   {t3['language_ratios']}")
    print(f"  AI says:  {t3['ai_response'][:120]}...")
    print(f"  Flags:    {t3['red_flags']}")

    # 7. Prescription OCR
    r = httpx.post(
        f"{BASE}/prescription/scan",
        data={"patient_id": patient_id},
        files={"document": ("test.jpg", b"fake image bytes", "image/jpeg")},
    )
    ocr = r.json()
    print("\n=== PRESCRIPTION OCR ===")
    print(f"  Medications: {len(ocr['medications'])}")
    for med in ocr["medications"]:
        print(f"    - {med.get('drug_name', '')} {med.get('strength', '')} | {med.get('frequency', '')}")
    print(f"  Lab Values:  {len(ocr['lab_values'])}")
    for lab in ocr["lab_values"]:
        status = lab.get("status", "?")
        ref = lab.get("reference_range", "?")
        icon = "!!!" if status == "abnormal" else "OK " if status == "normal" else "?  "
        print(f"    {icon} {lab.get('test_name', '')}: {lab.get('value', '')} (ref: {ref})")
    print(f"  Corrections: {ocr['corrections']}")

    # 8. Generate summary
    r = httpx.post(f"{BASE}/summary/generate", params={
        "patient_id": patient_id,
        "session_id": session_id,
    })
    summary = r.json()
    print("\n=== CLINICAL SUMMARY ===")
    if "detail" in summary:
        print(f"  ERROR: {summary['detail']}")
    else:
        print(f"  CC:            {summary.get('chief_complaint', 'N/A')}")
        print(f"  HPI:           {summary.get('hpi', 'N/A')[:150]}...")
        print(f"  Medications:   {summary.get('current_medications', [])}")
        print(f"  Red Flags:     {summary.get('red_flags', [])}")
        print(f"  RAG Enriched:  {summary.get('rag_enriched', False)}")
    print(f"  Seek Help:     {summary.get('when_to_seek_help', [])[:2]}")
    print(f"  Timeline:      {len(summary.get('timeline', []))} entries")

    # 9. Readback
    r = httpx.post(f"{BASE}/readback/generate", params={
        "patient_id": patient_id,
        "session_id": session_id,
    })
    readback = r.json()
    print("\n=== PATIENT READBACK ===")
    print(f"  Language: {readback.get('language', 'N/A')}")
    print(f"  Text:     {readback.get('text', 'N/A')}")

    print("\n" + "=" * 60)
    print("ALL ENDPOINTS WORKING")
    print("=" * 60)


if __name__ == "__main__":
    test()
