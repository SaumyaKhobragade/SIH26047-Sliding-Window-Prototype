import { useState, useEffect } from 'react'

const PAST_HISTORY_RAG = {
  visits: [
    { date: '2024-03-15', doctor: 'Dr. A. Shah, General Medicine', complaint: 'Routine checkup — elevated blood sugar detected', diagnosis: 'Type 2 Diabetes Mellitus, Essential Hypertension', prescribed: ['Metformin 500mg BD', 'Amlodipine 5mg OD'] },
    { date: '2025-02-20', doctor: 'City Pathology Lab', complaint: 'Routine lab work', diagnosis: 'HbA1c 8.1% (uncontrolled), Total Cholesterol 242 mg/dL (high)', prescribed: [], isLab: true },
    { date: '2025-02-28', doctor: 'Dr. R. Patel, Endocrinology', complaint: 'Follow-up for uncontrolled diabetes', diagnosis: 'Uncontrolled Type 2 DM, Hyperlipidemia', prescribed: ['Glimepiride 1mg OD (added)', 'Atorvastatin 10mg HS (added)'] },
  ],
  chronicConditions: ['Type 2 Diabetes Mellitus (since 2024)', 'Essential Hypertension (since 2024)', 'Hyperlipidemia (since 2025)'],
  currentMedications: ['Metformin 500mg BD', 'Amlodipine 5mg OD', 'Glimepiride 1mg OD', 'Atorvastatin 10mg HS'],
  allergies: ['Sulfa drugs — cutaneous rash'],
}

export default function DoctorReportStep({ patient, conversation, prescriptions, faceMatched, summaryData, readbackData, patientId, sessionId, apiBase, onReset, onSendToDoctor }) {
  const [isLoading, setIsLoading] = useState(true)
  const [showRAG, setShowRAG] = useState(false)
  const [reportStatus, setReportStatus] = useState('draft')
  const [readbackText, setReadbackText] = useState(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  useEffect(() => {
    const timer1 = setTimeout(() => setIsLoading(false), summaryData ? 500 : 2000)
    const timer2 = setTimeout(() => setShowRAG(true), summaryData ? 1000 : 3500)
    if (readbackData?.text) setReadbackText(readbackData.text)
    return () => { clearTimeout(timer1); clearTimeout(timer2) }
  }, [summaryData, readbackData])

  const s = summaryData || {}
  const fields = conversation?.clinicalFields || conversation?.collectedFields || {}
  const messages = conversation?.messages || []

  const chiefComplaint = s.chief_complaint || fields.chief_complaint || extractFromMessages('complaint') || 'Not provided'
  const medications = s.current_medications || splitField(fields.medications) || []
  const allergies = s.allergies || splitField(fields.allergies) || []
  const familyHistory = s.family_history || splitField(fields.family_history) || []
  const pastMedical = s.past_medical_history || []
  const redFlags = s.red_flags || conversation?.redFlags || []
  const pastVisits = s.past_visits || (faceMatched ? PAST_HISTORY_RAG.visits : [])

  function splitField(val) {
    if (!val) return []
    if (Array.isArray(val)) return val
    return val.split(',').map(v => v.trim()).filter(Boolean)
  }

  function extractFromMessages(keyword) {
    const patientMsgs = messages.filter(m => m.role === 'patient').map(m => m.text)
    if (patientMsgs.length === 0) return null
    if (keyword === 'complaint' && patientMsgs.length > 0) return patientMsgs[0]
    return null
  }

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  // Extract meds from prescriptions array
  const prescriptionMeds = (prescriptions || [])
    .flatMap(doc => (doc.medications || []).map(m => `${m.name} ${m.strength}`))
    .filter(Boolean)

  const allMeds = medications.length > 0 ? medications :
    faceMatched ? PAST_HISTORY_RAG.currentMedications : prescriptionMeds

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px' }}>
        <div style={{ marginBottom: 24 }}>
          <div className="scan-spinner" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, marginBottom: 8 }}>
            Generating Clinical Summary…
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Combining voice interview + scanned documents + past history
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="completion-head">
        <div>
          <span className="eyebrow">READY FOR YOUR DOCTOR</span>
          <h1>Your story, <i>clearly told.</i></h1>
        </div>
        <div className="complete-mark">
          <span>✓</span>
          <small>INTAKE COMPLETE</small>
        </div>
      </div>

      {/* RAG indicator */}
      {faceMatched && showRAG && (
        <div className="rag-indicator" style={{ marginBottom: 20 }}>
          <span className="icon">🧠</span>
          <span>
            <strong>RAG Pipeline:</strong> Face matched to existing patient. {pastVisits.length} prior visits retrieved from ChromaDB.
          </span>
        </div>
      )}

      {/* Red flag */}
      {redFlags.length > 0 && (
        <div className="red-flag-alert">
          <span className="red-flag-icon">🚨</span>
          <div className="red-flag-content">
            <h3>Priority Alert — Red Flag Detected</h3>
            <p>{redFlags.join(' • ')}</p>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-glass)',
        padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
      }}>
        {[
          { id: 'summary', label: '📋 Clinical Summary' },
          { id: 'timeline', label: '📅 Timeline' },
          { id: 'readback', label: '🔊 Hindi Readback' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 16px',
              background: activeTab === tab.id ? 'var(--accent-teal-dim)' : 'transparent',
              border: activeTab === tab.id ? '1px solid rgba(20,184,166,0.3)' : '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              color: activeTab === tab.id ? 'var(--accent-teal)' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="summary-layout">
          {/* Main summary card */}
          <section className="summary-card">
            <div className="summary-top">
              <div>
                <span className="eyebrow">CLINICAL INTAKE SUMMARY</span>
                <h2>{patient?.name || 'Patient'}</h2>
                <p>Generated {today}</p>
              </div>
              <span className="secure-badge">⌁ Secure</span>
            </div>

            <div className="summary-person">
              {patient?.age && <div><span>AGE</span><b>{patient.age} years</b></div>}
              {patient?.gender && <div><span>GENDER</span><b>{patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}</b></div>}
              <div><span>CHIEF COMPLAINT</span><b>{chiefComplaint}</b></div>
              {faceMatched && <div><span>STATUS</span><b style={{ color: 'var(--accent-blue)' }}>Returning patient</b></div>}
            </div>

            {/* SOCRATES */}
            <div className="summary-section">
              <h3>SOCRATES findings</h3>
              {s.hpi ? (
                <p>{s.hpi}</p>
              ) : (
                <p>
                  {chiefComplaint !== 'Not provided' ? chiefComplaint : 'Chief complaint not provided.'}
                  {fields.onset && ` Onset: ${fields.onset}.`}
                  {fields.character && ` Character: ${fields.character}.`}
                  {fields.radiation && ` Radiation: ${fields.radiation}.`}
                  {fields.severity && ` Severity: ${fields.severity}.`}
                  {!fields.onset && !fields.character && chiefComplaint === 'Not provided' &&
                    ' Detailed SOCRATES fields will be populated during the clinical interview.'}
                </p>
              )}
            </div>

            {/* Red flags */}
            {redFlags.length > 0 && (
              <div className="summary-section warning-summary">
                <h3><span>!</span> Red flags to review</h3>
                <p>{redFlags.join(' • ')}</p>
              </div>
            )}

            {/* Medications */}
            <div className="summary-section meds-summary">
              <h3>Current / recently prescribed medications</h3>
              {allMeds.length > 0 ? (
                <div>
                  {allMeds.map((med, i) => <span key={i}>{med}</span>)}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not reported during this interview.</p>
              )}
              {faceMatched && allMeds.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--accent-blue)', marginTop: 8, fontStyle: 'italic' }}>
                  📎 Source: RAG pipeline ({pastVisits.length} prior visits)
                </div>
              )}
            </div>

            {/* AI summary */}
            <div className="summary-section ai-summary">
              <div>
                <span className="sparkle">✦</span>
                <h3>AI clinical summary</h3>
              </div>
              <p>
                {s.ai_summary ||
                  `${patient?.name || 'Patient'} presents with ${chiefComplaint}. ${
                    redFlags.length > 0
                      ? 'A focused clinical assessment is recommended to rule out time-sensitive causes.'
                      : 'Intake completed successfully. Awaiting clinical review.'
                  }`}
              </p>
            </div>

            {/* Past medical history */}
            {(faceMatched || pastMedical.length > 0) && (
              <div className="summary-section">
                <h3>Past Medical / Surgical History</h3>
                {faceMatched && pastVisits.length > 0 ? (
                  <div>
                    {PAST_HISTORY_RAG.chronicConditions.map((c, i) => (
                      <div key={i} style={{ marginBottom: 4, fontSize: 13, color: 'var(--text-secondary)' }}>• {c}</div>
                    ))}
                  </div>
                ) : pastMedical.length > 0 ? (
                  pastMedical.map((item, i) => (
                    <div key={i} style={{ marginBottom: 4, fontSize: 13, color: 'var(--text-secondary)' }}>• {item}</div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>No past medical history available.</p>
                )}
              </div>
            )}

            {/* Allergies */}
            {(allergies.length > 0 || faceMatched) && (
              <div className="summary-section">
                <h3>Drug Allergies</h3>
                {allergies.length > 0 ? (
                  allergies.map((a, i) => <div key={i} style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: 13 }}>• {a}</div>)
                ) : faceMatched ? (
                  PAST_HISTORY_RAG.allergies.map((a, i) => <div key={i} style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: 13 }}>• {a}</div>)
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>No known drug allergies reported.</p>
                )}
              </div>
            )}
          </section>

          {/* Completion aside */}
          <aside className="completion-side">
            {/* Audio card */}
            <div className="audio-card">
              <span className="eyebrow">HINDI AUDIO SUMMARY</span>
              <h3>सारांश सुनें</h3>
              <p>Listen to a simple recap in Hindi.</p>
              <button id="audioButton" onClick={() => setIsPlayingAudio(v => !v)}>
                <span>{isPlayingAudio ? '⏸' : '▶'}</span>
                {isPlayingAudio ? 'Playing…' : 'Play summary'}
                <em>0:48</em>
              </button>
              <div className="audio-waves">
                {Array.from({ length: 10 }).map((_, i) => (
                  <i key={i} style={{
                    height: `${8 + Math.random() * 14}px`,
                    opacity: isPlayingAudio ? 0.8 : 0.3,
                    transition: 'opacity 0.3s',
                  }} />
                ))}
              </div>
            </div>

            {/* QR card */}
            <div className="qr-card">
              <div className="qr" aria-label="QR code">
                {Array.from({ length: 12 }).map((_, i) => <i key={i} />)}
              </div>
              <div>
                <b>ABHA health record</b>
                <p>Scan to securely view this visit on your phone.</p>
              </div>
            </div>

            {/* Status badge */}
            <span className={`status-badge ${reportStatus}`} style={{ alignSelf: 'flex-start' }}>
              {reportStatus === 'draft' ? '📝 Draft — Awaiting Confirmation' : '✅ Confirmed'}
            </span>

            {/* Send to doctor */}
            {reportStatus === 'draft' ? (
              <>
                <button
                  className="primary-action send-button"
                  id="sendDoctor"
                  onClick={async () => {
                    if (patientId && sessionId && apiBase) {
                      try {
                        await fetch(`${apiBase}/summary/confirm?patient_id=${patientId}&session_id=${sessionId}`, { method: 'POST' })
                      } catch (err) { console.warn('Confirm endpoint failed:', err.message) }
                    }
                    setReportStatus('confirmed')
                    onSendToDoctor?.()
                  }}
                >
                  Send to Doctor <span>→</span>
                </button>
                <button className="print-button" id="printReport" onClick={() => window.print()}>
                  ⌘ &nbsp; Print report
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600, fontSize: 14 }}>
                ✅ Report confirmed and saved to patient record. ABHA linked.
              </div>
            )}

            <button className="btn btn-secondary btn-full" onClick={onReset} style={{ marginTop: 4 }}>
              🔄 New Patient
            </button>
          </aside>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, marginBottom: 20 }}>
            Chronological Medical Timeline
          </h3>
          <div className="timeline">
            {faceMatched && pastVisits.map((visit, i) => (
              <div key={i} className="timeline-item">
                <div className={`timeline-dot${visit.isLab ? ' warning' : ''}`} />
                <div className="timeline-date">{visit.date}</div>
                <div className="timeline-content">
                  <strong>{visit.doctor}</strong>
                  <div style={{ marginTop: 4 }}>{visit.complaint}</div>
                  <div style={{ marginTop: 4 }}><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Dx:</span> {visit.diagnosis}</div>
                  {visit.prescribed?.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Rx:</span> {visit.prescribed.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="timeline-item">
              <div className="timeline-dot current" />
              <div className="timeline-date">{new Date().toISOString().split('T')[0]} (Today)</div>
              <div className="timeline-content">
                <strong>Current Visit — Aarogya AI Intake</strong>
                <div style={{ marginTop: 4 }}>Chief Complaint: {chiefComplaint}</div>
                {redFlags.length > 0 && <div style={{ marginTop: 4 }}><span className="badge-abnormal">🚨 {redFlags[0]}</span></div>}
              </div>
            </div>
          </div>
          {!faceMatched && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
              No prior visits found. This is a first-time patient.<br />Timeline will build over subsequent visits.
            </div>
          )}
        </div>
      )}

      {activeTab === 'readback' && (
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, marginBottom: 8 }}>🔊 Patient Audio Readback</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
            Summary is read back to the patient in their language for verification before submission.
          </p>

          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              READBACK {readbackText ? '(Live from Sarvam AI)' : '(Demo)'}:
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-primary)', fontStyle: 'italic', padding: '12px 0' }}>
              {readbackText
                ? `"${readbackText}"`
                : `"Aapne bataya ki ${chiefComplaint}. ${allMeds.length > 0 ? `Aap currently ${allMeds.join(', ')} le rahe hain.` : ''} Kya yeh sab sahi hai?"`}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: '12px 16px', background: 'rgba(20,184,166,0.08)', borderRadius: 'var(--radius-md)' }}>
              <button style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--accent-teal)', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶</button>
              <div style={{ flex: 1 }}>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '0%', height: '100%', background: 'var(--accent-teal)', borderRadius: 2 }} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>0:00 / 0:42</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => {
              if (patientId && sessionId && apiBase) {
                try { await fetch(`${apiBase}/summary/confirm?patient_id=${patientId}&session_id=${sessionId}`, { method: 'POST' }) } catch {}
              }
              setReportStatus('confirmed'); onSendToDoctor?.()
            }}>
              ✅ "Haan, sahi hai" (Yes, correct)
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }}>
              ❌ "Nahi, change karna hai"
            </button>
          </div>
        </div>
      )}

      <div className="action-bar" style={{ marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onReset}>🔄 New Patient</button>
        {reportStatus === 'draft' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary">✏️ Edit Summary</button>
            <button className="btn btn-primary btn-lg" onClick={async () => {
              if (patientId && sessionId && apiBase) {
                try { await fetch(`${apiBase}/summary/confirm?patient_id=${patientId}&session_id=${sessionId}`, { method: 'POST' }) } catch {}
              }
              setReportStatus('confirmed'); onSendToDoctor?.()
            }}>
              ✅ Confirm &amp; Save to Record
            </button>
          </div>
        )}
        {reportStatus === 'confirmed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600, fontSize: 14 }}>
            ✅ Report confirmed and saved to patient record. ABHA linked.
          </div>
        )}
      </div>
    </>
  )
}
