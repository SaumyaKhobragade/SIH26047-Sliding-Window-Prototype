"""
End-to-end integration test for the MediKiosk prototype backend.

Unlike the old version (3 fixed turns whose answers did not match the questions
being asked, so the interview never completed and the doctor's report was never
actually exercised), this drives the interview off the field the backend says it
is collecting, walks all 13 SOCRATES questions, and asserts on the structured
summary that the doctor receives.

Run the server first:   python main.py
Then:                   python test_flow.py
"""
import json
import re
import sys

import httpx

from test_fixture_rx import (
    EXPECT_ABNORMAL, EXPECT_DATE, EXPECT_DIAGNOSIS, EXPECT_DOCTOR, EXPECT_DRUGS,
    EXPECT_NORMAL, render_prescription_png,
)

BASE = "http://localhost:8080"
TIMEOUT = 90.0

# Answers keyed by clinical field, so the reply always matches the question.
# Deliberately code-mixed to exercise adaptive style switching.
ANSWERS = {
    "chief_complaint": "Mujhe kal se chest mein pain ho raha hai especially left side mein",
    "onset": "Kal shaam se shuru hua tha, achanak",
    "character": "It is more like a pressure kind of feeling, heaviness actually",
    "radiation": "Haan left arm mein bhi kabhi kabhi jaata hai dard",
    "associated_symptoms": "Pasina bahut aata hai aur saans phool jaati hai",
    "timing": "Chalne par badh jaata hai, aaram karne se kam ho jaata hai",
    "exacerbating": "Seedhi chadhne se zyada hota hai, lete hue thoda better",
    "severity": "7 out of 10",
    "past_medical": "Sugar hai 8 saal se aur BP bhi hai",
    "medications": "Metformin 500 subah shaam aur Amlodipine 5 subah",
    "allergies": "Sulpha dawa se rash aa gaya tha ek baar",
    "family_history": "Papa ko heart attack aaya tha 60 ki age mein",
    "personal_history": "Tambaku nahi khata, kabhi kabhi sharab. Neend theek nahi aati",
}

PASS, FAIL = "PASS", "FAIL"
results = []


def check(label, condition, detail=""):
    results.append((PASS if condition else FAIL, label, detail))
    print(f"  [{PASS if condition else FAIL}] {label}" + (f" — {detail}" if detail else ""))
    return bool(condition)


def test():
    client = httpx.Client(timeout=TIMEOUT)

    # ── 1. Health ────────────────────────────────────────────────────────────
    print("=== HEALTH ===")
    health = client.get(f"{BASE}/health").json()
    print(json.dumps(health, indent=2))
    check("LLM API key configured", health["llm"]["api_key_present"])
    check("13 clinical questions registered", health["clinical_questions"] == 13,
          f"got {health['clinical_questions']}")

    print("\n=== LLM LIVE PROBE ===")
    probe = client.get(f"{BASE}/health/llm").json()
    llm_up = check("LLM reachable", probe["reachable"], probe.get("last_error") or "")
    print(f"  model={probe.get('model')} reply={probe.get('reply', '')!r}")

    # ── 2. Register ──────────────────────────────────────────────────────────
    print("\n=== REGISTER ===")
    patient = client.post(f"{BASE}/patient/register", data={
        "name": "Ramesh Kumar", "age": "58", "gender": "male",
        "phone": "+919876543210", "abha_id": "12-3456-7890-1234",
        "language_preference": "hinglish",
    }).json()
    patient_id = patient["patient_id"]
    print(f"  patient_id = {patient_id}")

    # ── 3. Start session ─────────────────────────────────────────────────────
    print("\n=== ACI START ===")
    session = client.post(f"{BASE}/aci/start",
                          params={"patient_id": patient_id, "language": "hinglish"}).json()
    session_id = session["session_id"]
    print(f"  session_id = {session_id}")
    print(f"  greeting   = {session['greeting'][:100]}")
    check("start returns total_questions", session.get("total_questions") == 13)
    check("start returns first field", session.get("field") == "chief_complaint",
          session.get("field", ""))
    check("start returns touch options", len(session.get("touch_options", [])) > 0)

    # ── 4. Walk the full interview ───────────────────────────────────────────
    print("\n=== INTERVIEW (13 questions) ===")
    field = session["field"]
    styles_seen, all_flags, turn = set(), [], 0

    while turn < 20:
        turn += 1
        answer = ANSWERS.get(field, "Theek hai")
        r = client.post(f"{BASE}/aci/converse",
                        json={"session_id": session_id, "patient_text": answer})
        if r.status_code != 200:
            check(f"turn {turn} succeeded", False, f"HTTP {r.status_code}: {r.text[:200]}")
            break
        t = r.json()
        styles_seen.add(t["style_mode"])
        all_flags.extend(f for f in t["red_flags"] if f not in all_flags)

        print(f"  {t['questions_answered']:>2}/{t['total_questions']} "
              f"stored={t['field_stored']:<20} style={t['style_mode']:<22} "
              f"mix={t['language_ratios'].get('hinglish', 0):>3} "
              f"-> {t['normalized_value'][:44]!r}")

        if t["field_stored"] != field:
            check(f"turn {turn} stored the field it asked", False,
                  f"asked {field}, stored {t['field_stored']}")
        if t["is_complete"]:
            break
        field = t["field_collected"]

    print(f"\n  styles observed: {sorted(styles_seen)}")
    print(f"  red flags:       {all_flags}")
    check("interview completed", t["is_complete"])
    check("all 13 questions answered", t["questions_answered"] == 13,
          f"got {t['questions_answered']}")
    check("progress reached 100%", t["progress_pct"] == 100, f"got {t['progress_pct']}%")
    check("adaptive style actually switched", len(styles_seen) > 1,
          f"only {sorted(styles_seen)}")
    check("chest-pain red flag raised", any("chest" in f.lower() or "cardiac" in f.lower()
                                            for f in all_flags), str(all_flags))

    # Blank input must NOT consume a question (SOCRATES is never skipped).
    before = t["questions_answered"]
    blank = client.post(f"{BASE}/aci/converse",
                        json={"session_id": session_id, "patient_text": "   "}).json()
    check("blank input does not skip a question",
          blank["questions_answered"] == before, f"{before} -> {blank['questions_answered']}")

    # Unknown session must 404, not 500.
    bad = client.post(f"{BASE}/aci/converse",
                      json={"session_id": "SESS-NOPE", "patient_text": "hi"})
    check("unknown session returns 404", bad.status_code == 404, f"got {bad.status_code}")

    # ── 5. Session survives a fresh read (persistence) ───────────────────────
    print("\n=== SESSION PERSISTENCE ===")
    stored = client.get(f"{BASE}/aci/session/{session_id}").json()
    check("session readable from store", stored.get("is_complete") is True)
    check("raw answers kept for provenance",
          len(stored.get("raw_answers", {})) == 13, str(len(stored.get("raw_answers", {}))))
    sources = stored.get("normalization_source", {})
    print(f"  normalization sources: { {k: v for k, v in sources.items()} }")
    check("no field fell through to raw verbatim",
          "verbatim" not in sources.values(),
          [k for k, v in sources.items() if v == "verbatim"] and
          str([k for k, v in sources.items() if v == "verbatim"]) or "")

    # ── 6. Prescription OCR: the honest-failure contract ─────────────────────
    # This used to upload b"fake image bytes" and assert that medicines and lab
    # values came back — which only ever passed because the service fell back to
    # a hardcoded Dr. A. Shah prescription (Metformin, Amlodipine, HbA1c 8.1%).
    # That fallback is gone: unreadable input must be refused, not answered with
    # example data. Real extraction can only be exercised with a real photo of a
    # real prescription, so that is a manual step, not something this test fakes.
    print("\n=== PRESCRIPTION OCR (must refuse unreadable input) ===")
    bad = client.post(
        f"{BASE}/prescription/scan",
        data={"patient_id": patient_id},
        files={"document": ("test.jpg", b"fake image bytes", "image/jpeg")},
    )
    print(f"  garbage upload -> HTTP {bad.status_code}: {bad.text[:200]}")
    check("unreadable document is refused, not answered with sample data",
          bad.status_code == 422, f"got {bad.status_code}")
    detail = (bad.json().get("detail", "") if bad.status_code == 422 else "")
    check("refusal explains itself to the patient", len(detail) > 20, detail[:80])
    check("refusal says nothing was recorded",
          "nothing was added" in detail.lower() or "please" in detail.lower(),
          detail[:80])

    empty = client.post(
        f"{BASE}/prescription/scan",
        data={"patient_id": patient_id},
        files={"document": ("empty.jpg", b"", "image/jpeg")},
    )
    check("empty upload is refused too", empty.status_code == 422,
          f"got {empty.status_code}")

    # ── 6b. Prescription OCR: the success path ───────────────────────────────
    # The refusal checks above passed for months while the success path was
    # completely broken — Sarvam transcribed the page perfectly and the service
    # threw all of it away, because it read page["content"] (which the API leaves
    # null) and never page["blocks"][i]["text"] (which holds the transcript). A
    # suite that only asserts on failures cannot notice that nothing ever
    # succeeds, so this drives a document the reader can actually read.
    #
    # Rendered printed text, so it tests the plumbing end to end. Handwriting is
    # the harder real case and can only be judged on real photographs.
    print("\n=== PRESCRIPTION OCR (must read a readable document) ===")
    fixture = render_prescription_png()
    if fixture is None:
        print("  SKIPPED — Pillow or a TrueType font is unavailable on this machine.")
    else:
        # A separate patient, so the refused-scan assertions in section 7 stay
        # meaningful for `patient_id`.
        rx_pid = client.post(f"{BASE}/patient/register", data={
            "name": "Ramesh Kumar", "age": "58", "gender": "male",
            "language_preference": "hinglish",
        }).json()["patient_id"]

        good = client.post(
            f"{BASE}/prescription/scan",
            data={"patient_id": rx_pid},
            files={"document": ("printed_rx.png", fixture, "image/png")},
        )
        if not check("a readable document is actually read", good.status_code == 200,
                     f"HTTP {good.status_code}: {good.text[:200]}"):
            print("  (skipping the extraction checks — nothing came back)")
        else:
            doc = good.json()
            meds = doc.get("medications", [])
            labs = doc.get("lab_values", [])
            print(f"  ocr={doc.get('ocr_source')} extraction={doc.get('extraction_source')}")
            for m in meds:
                print(f"    {m.get('drug_name'):<16} {m.get('strength',''):<10} "
                      f"freq={m.get('frequency','')!r} dur={m.get('duration','')!r}")
            for l in labs:
                print(f"    {'!!' if l.get('status') in ('abnormal','critical') else '  '} "
                      f"{l.get('test_name'):<18} {l.get('value'):<12} {l.get('status')} "
                      f"ref={l.get('reference')!r}")

            names = [(m.get("drug_name") or "") for m in meds]
            check("every medicine on the page was extracted",
                  all(any(exp.lower() in n.lower() for n in names) for exp in EXPECT_DRUGS),
                  f"expected {EXPECT_DRUGS}, got {names}")
            # "Tab. Metformin" reaching the doctor as a drug named "Tab. Metformin".
            check("dosage forms are stripped from drug names",
                  not any(re.match(r"^\s*(tab|cap|syp|inj)\b", n, re.I) for n in names),
                  str(names))
            # The duration used to be reported AS the frequency ("x 30 days"),
            # losing the 1-0-1 schedule that says when to take the drug.
            check("dosing schedule is not overwritten by the course length",
                  not any(re.search(r"\d+\s*(day|week|month)", m.get("frequency") or "", re.I)
                          for m in meds),
                  str([m.get("frequency") for m in meds]))
            check("the 1-0-1 schedule was decoded into words",
                  any("morning" in (m.get("frequency") or "").lower()
                      or "night" in (m.get("frequency") or "").lower() for m in meds),
                  str([m.get("frequency") for m in meds]))
            check("course length captured separately",
                  sum(1 for m in meds if (m.get("duration") or "").strip()) >= 3,
                  str([m.get("duration") for m in meds]))
            check("no bogus OCR corrections reported for text read correctly",
                  not doc.get("corrections"), str(doc.get("corrections")))

            lab_names = [(l.get("test_name") or "").lower() for l in labs]
            check("every lab value on the page was extracted",
                  all(any(exp in n for n in lab_names)
                      for exp in EXPECT_ABNORMAL + EXPECT_NORMAL),
                  f"got {lab_names}")
            abnormal = {(l.get("test_name") or "").lower() for l in labs
                        if l.get("status") in ("abnormal", "critical")}
            check("out-of-range labs are flagged abnormal",
                  all(any(exp in a for a in abnormal) for exp in EXPECT_ABNORMAL),
                  f"flagged {sorted(abnormal)}")
            check("in-range labs are NOT flagged",
                  not any(any(exp in a for a in abnormal) for exp in EXPECT_NORMAL),
                  f"flagged {sorted(abnormal)}")
            # "Fasting Glucose" matched no reference key, so a diabetic's
            # 148 mg/dL went to the doctor as "unknown — N/A", unflagged.
            check("no lab was left without a reference range",
                  not any((l.get("reference") or "N/A") == "N/A" for l in labs),
                  str([(l.get("test_name"), l.get("reference")) for l in labs]))
            check("prescriber read off the document",
                  EXPECT_DOCTOR.lower() in (doc.get("doctor_name") or "").lower(),
                  repr(doc.get("doctor_name")))
            check("prescription date read off the document",
                  doc.get("date") == EXPECT_DATE, repr(doc.get("date")))
            check("diagnosis read off the document",
                  EXPECT_DIAGNOSIS in (doc.get("diagnosis") or "").lower(),
                  repr(doc.get("diagnosis")))

            # The document must reach the doctor, not just the scan response.
            # A session is required, but it need not be a second full interview —
            # these checks are about the document's journey into the report.
            rx_sid = client.post(f"{BASE}/aci/start",
                                 params={"patient_id": rx_pid,
                                         "language": "hinglish"}).json()["session_id"]
            rx_sum = client.post(f"{BASE}/summary/generate",
                                 params={"patient_id": rx_pid,
                                         "session_id": rx_sid}).json()
            invs = rx_sum.get("investigations_summary", [])
            check("the scanned labs reach the doctor's report", len(invs) >= 5,
                  f"{len(invs)} investigations")
            check("abnormal labs sort to the top of the report",
                  bool(invs) and invs[0].get("is_abnormal"),
                  str([(i.get("test"), i.get("is_abnormal")) for i in invs[:3]]))
            check("the scanned document appears in the timeline",
                  any(e.get("type") == "prescription" for e in rx_sum.get("timeline", [])),
                  str([e.get("type") for e in rx_sum.get("timeline", [])]))
            report_meds = " | ".join(rx_sum.get("current_medications", []))
            check("scanned medicines reach the doctor's medication list",
                  all(exp.lower() in report_meds.lower() for exp in EXPECT_DRUGS),
                  report_meds[:160])

    # ── 7. Structured doctor summary ─────────────────────────────────────────
    print("\n=== CLINICAL SUMMARY (the doctor's report) ===")
    r = client.post(f"{BASE}/summary/generate",
                    params={"patient_id": patient_id, "session_id": session_id})
    if r.status_code != 200:
        check("summary generated", False, f"HTTP {r.status_code}: {r.text[:300]}")
        return report()
    s = r.json()
    print(f"  CC:              {s['chief_complaint']}")
    print(f"  HPI:             {s['hpi'][:200]}")
    print(f"  AI summary:      [{s['ai_summary_source']}] {(s['ai_summary'] or '')[:200]}")
    print(f"  Urgency:         {s.get('urgency')}")
    print(f"  Past medical:    {s['past_medical_history']}")
    print(f"  Medications:     {s['current_medications']}")
    print(f"  Allergies:       {s['allergies']}")
    print(f"  Family history:  {s['family_history']}")
    print(f"  Personal hx:     {s['personal_history']}")
    print(f"  ROS:             {s['review_of_systems'][:160]}")
    print(f"  Investigations:  {len(s['investigations_summary'])}")
    for inv in s["investigations_summary"][:4]:
        print(f"      {'!!' if inv.get('is_abnormal') else 'ok'} {inv.get('test')}: "
              f"{inv.get('value')} ({inv.get('status')})")
    print(f"  Red flags:       {s['red_flags']}")
    print(f"  Seek help:       {s['when_to_seek_help'][:2]}")
    print(f"  Fields:          {s['fields_collected']}/{s['fields_total']}")
    print(f"  Missing:         {s['missing_fields']}")
    print(f"  Unverified:      {s['unverified_fields']}")
    print(f"  RAG enriched:    {s['rag_enriched']} | timeline {len(s['timeline'])} entries")

    check("summary marks interview complete", s["interview_complete"])
    check("all 13 fields present in report", s["fields_collected"] == 13,
          f"{s['fields_collected']}/{s['fields_total']}")
    check("nothing reported missing", not s["missing_fields"], str(s["missing_fields"]))
    check("chief complaint is clean English",
          bool(s["chief_complaint"]) and "Not assessed" not in s["chief_complaint"])
    check("HPI is a real narrative", len(s["hpi"]) > 60, f"{len(s['hpi'])} chars")
    check("medications listed", bool(s["current_medications"]))
    check("allergy captured, not defaulted to NKDA",
          not any("NKDA" in a.upper() or "no known" in a.lower()
                  for a in s["allergies"]), str(s["allergies"]))
    check("personal history not 'Not assessed'",
          "Not assessed" not in s["personal_history"], s["personal_history"][:80])
    check("red flags present in report", bool(s["red_flags"]))
    check("cardiac-specific seek-help advice",
          any("chest" in h.lower() or "arm" in h.lower() or "jaw" in h.lower()
              for h in s["when_to_seek_help"]), str(s["when_to_seek_help"][:2]))
    check("first-time patient is NOT flagged as returning", s["rag_enriched"] is False,
          f"rag_enriched={s['rag_enriched']}")
    check("abnormal labs sorted first in investigations",
          not s["investigations_summary"] or s["investigations_summary"][0].get("is_abnormal")
          or not any(i.get("is_abnormal") for i in s["investigations_summary"]))
    # Both scans above were refused, so nothing should have reached the record.
    check("refused scans left no investigations in the report",
          not s["investigations_summary"], str(len(s["investigations_summary"])))
    check("refused scans left no document entry in the timeline",
          not any(e.get("type") in ("prescription", "lab_report") for e in s["timeline"]),
          str([e.get("type") for e in s["timeline"]]))
    if llm_up:
        check("AI summary came from the LLM, not the template fallback",
              s["ai_summary_source"] == "llm", s["ai_summary_source"])
    check("generated_at stamped", bool(s["generated_at"]))

    # ── 8. Readback ──────────────────────────────────────────────────────────
    print("\n=== PATIENT READBACK ===")
    rb = client.post(f"{BASE}/readback/generate",
                     params={"patient_id": patient_id, "session_id": session_id}).json()
    print(f"  language: {rb.get('language')}")
    print(f"  text:     {rb.get('text')}")
    print(f"  audio:    {'yes (' + str(len(rb['audio_base64'])) + ' b64 chars)' if rb.get('audio_base64') else 'NONE'}")
    check("readback text produced", bool(rb.get("text")))
    check("readback does not invent 'no allergies'",
          "no allerg" not in (rb.get("text") or "").lower(), rb.get("text", "")[:80])

    # ── 9. Confirm → visit count increments by exactly 1 ─────────────────────
    print("\n=== DOCTOR CONFIRMATION ===")
    conf = client.post(f"{BASE}/summary/confirm",
                       params={"patient_id": patient_id, "session_id": session_id}).json()
    print(f"  {conf}")
    check("confirmation increments visit count by exactly 1",
          conf["visit_count"] == 1, f"got {conf['visit_count']}")

    # The doctor's report offers three confirm buttons ("Send to Doctor",
    # "Confirm & Save", and the readback's "patient confirms"). Hitting more than
    # one must not store the same consultation as several visits.
    conf2 = client.post(f"{BASE}/summary/confirm",
                        params={"patient_id": patient_id, "session_id": session_id}).json()
    check("re-confirming the same session does NOT add a second visit",
          conf2["visit_count"] == 1, f"got {conf2['visit_count']}")

    # Now the SAME patient must read as returning.
    s2 = client.post(f"{BASE}/summary/generate",
                     params={"patient_id": patient_id, "session_id": session_id}).json()
    check("after a confirmed visit the patient IS returning", s2["rag_enriched"] is True,
          f"rag_enriched={s2['rag_enriched']}")
    check("past visits listed", len(s2["past_visits"]) >= 1, str(len(s2["past_visits"])))

    return report()


def report():
    failed = [r for r in results if r[0] == FAIL]
    print("\n" + "=" * 64)
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("\nFAILURES:")
        for _, label, detail in failed:
            print(f"  - {label}" + (f" — {detail}" if detail else ""))
    print("=" * 64)
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(test())
    except httpx.ConnectError:
        print(f"Cannot reach {BASE}. Start the server first:  python main.py")
        sys.exit(2)
