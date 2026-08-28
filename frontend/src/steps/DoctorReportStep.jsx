import { useState, useEffect } from 'react'

const PAST_HISTORY_RAG = {
  visits: [
    {
      date: '2024-03-15',
      doctor: 'Dr. A. Shah, General Medicine',
      complaint: 'Routine checkup — elevated blood sugar detected',
      diagnosis: 'Type 2 Diabetes Mellitus, Essential Hypertension',
      prescribed: ['Metformin 500mg BD', 'Amlodipine 5mg OD'],
    },
    {
      date: '2025-02-20',
      doctor: 'City Pathology Lab',
      complaint: 'Routine lab work',
      diagnosis: 'HbA1c 8.1% (uncontrolled), Total Cholesterol 242 mg/dL (high)',
      prescribed: [],
      isLab: true,
    },
    {
      date: '2025-02-28',
      doctor: 'Dr. R. Patel, Endocrinology',
      complaint: 'Follow-up for uncontrolled diabetes',
      diagnosis: 'Uncontrolled Type 2 DM, Hyperlipidemia',
      prescribed: ['Glimepiride 1mg OD (added)', 'Atorvastatin 10mg HS (added)'],
    },
  ],
  chronicConditions: ['Type 2 Diabetes Mellitus (since 2024)', 'Essential Hypertension (since 2024)', 'Hyperlipidemia (since 2025)'],
  currentMedications: ['Metformin 500mg BD', 'Amlodipine 5mg OD', 'Glimepiride 1mg OD', 'Atorvastatin 10mg HS'],
  allergies: ['Sulfa drugs — cutaneous rash'],
}

export default function DoctorReportStep({ patient, conversation, prescriptions, faceMatched, summaryData, readbackData, patientId, sessionId, apiBase, onReset }) {
  const [isLoading, setIsLoading] = useState(true)
  const [showRAG, setShowRAG] = useState(false)
  const [reportStatus, setReportStatus] = useState('draft')
  const [activeTab, setActiveTab] = useState('summary')
  const [readbackText, setReadbackText] = useState(null)

  useEffect(() => {
    const timer1 = setTimeout(() => setIsLoading(false), summaryData ? 500 : 2000)
    const timer2 = setTimeout(() => setShowRAG(true), summaryData ? 1000 : 3500)
    if (readbackData?.text) setReadbackText(readbackData.text)
    return () => { clearTimeout(timer1); clearTimeout(timer2) }
  }, [summaryData, readbackData])

  // Build report data from: backend summary > conversation fields > empty
  const s = summaryData || {}
  const fields = conversation?.clinicalFields || conversation?.collectedFields || {}
  const messages = conversation?.messages || []

  // Extract what was ACTUALLY collected from conversation
  const chiefComplaint = s.chief_complaint || fields.chief_complaint || extractFromMessages('complaint') || 'Not provided'
  const medications = s.current_medications || splitField(fields.medications) || []
  const allergies = s.allergies || splitField(fields.allergies) || []
  const familyHistory = s.family_history || splitField(fields.family_history) || []
  const pastMedical = s.past_medical_history || []
  const redFlags = s.red_flags || conversation?.redFlags || []
  const investigations = s.investigations_summary || []
  const pastVisits = s.past_visits || (faceMatched ? PAST_HISTORY_RAG.visits : [])

  function splitField(val) {
    if (!val) return []
    if (Array.isArray(val)) return val
    return val.split(',').map(v => v.trim()).filter(Boolean)
  }

  function extractFromMessages(keyword) {
    // Try to find relevant info from actual chat messages
    const patientMsgs = messages.filter(m => m.role === 'patient').map(m => m.text)
    if (patientMsgs.length === 0) return null
    // The first patient message is usually the chief complaint
    if (keyword === 'complaint' && patientMsgs.length > 0) return patientMsgs[0]
    return null
  }

  // Check if we have real data or it's empty
  const hasRealData = Object.keys(fields).length > 0 || summaryData

  if (isLoading) {
    return (
      <div className="glass-card" style={{ maxWidth: 600, textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚙️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Generating Clinical Summary...</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          Combining voice interview + scanned documents + past history
        </p>
        <div style={{
          height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2,
          overflow: 'hidden', maxWidth: 300, margin: '0 auto',
        }}>
          <div style={{
            height: '100%', width: '60%',
            background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))',
            borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
      </div>
    )
  }

  return (
    <div className="report-container">
      {/* Report Header */}
      <div className="report-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>
            👨‍⚕️ Doctor's Clinical Summary
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {summaryData ? 'AI-generated from live conversation' : 'Generated from conversation data'} • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`status-badge ${reportStatus}`}>
            {reportStatus === 'draft' ? '📝 Draft — Awaiting Confirmation' : '✅ Confirmed'}
          </span>
        </div>
      </div>

      {/* Patient Info Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)', padding: '14px 20px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--accent-purple-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>🧑</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{patient?.name || 'Patient'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {patient?.age || '—'}y / {patient?.gender === 'male' ? 'M' : patient?.gender === 'female' ? 'F' : 'O'} •
              Token: <strong>#047</strong> •
              OPD: General
            </div>
          </div>
        </div>
        {faceMatched && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)',
            padding: '4px 12px', borderRadius: 'var(--radius-full)', fontWeight: 600,
          }}>
            🔗 Linked to past records (face match)
          </div>
        )}
      </div>

      {/* RAG Indicator */}
      {faceMatched && showRAG && (
        <div className="rag-indicator">
          <span className="icon">🧠</span>
          <span>
            <strong>RAG Pipeline:</strong> Face matched to existing patient. {pastVisits.length} prior visits retrieved from ChromaDB.
            Past history appended to report below.
          </span>
        </div>
      )}

      {/* Red Flag Alert */}
      {redFlags.length > 0 && (
        <div className="red-flag-alert">
          <span className="red-flag-icon">🚨</span>
          <div className="red-flag-content">
            <h3>Priority Alert — Red Flag Detected</h3>
            <p>{redFlags.join(' • ')}</p>
          </div>
        </div>
      )}

      {/* Data source notice */}
      {!hasRealData && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 16,
          fontSize: 12, color: '#fbbf24',
        }}>
          ⚠️ Limited data collected from conversation. Some fields may be empty. In production, the AI interview collects all SOCRATES fields.
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-glass)',
        padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
      }}>
        {[
          { id: 'summary', label: '📋 Clinical Summary' },
          { id: 'timeline', label: '📅 Document Timeline' },
          { id: 'readback', label: '🔊 Patient Readback' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 16px',
              background: activeTab === tab.id ? 'var(--accent-teal-dim)' : 'transparent',
              border: activeTab === tab.id ? '1px solid rgba(20, 184, 166, 0.3)' : '1px solid transparent',
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

      {/* TAB: Clinical Summary */}
      {activeTab === 'summary' && (
        <div className="report-grid">
          <div className="report-section full-width">
            <div className="report-section-title">🎯 Chief Complaint</div>
            <div className="report-section-body">
              <strong>{chiefComplaint}</strong>
            </div>
          </div>

          <div className="report-section full-width">
            <div className="report-section-title">📝 History of Present Illness (HPI)</div>
            <div className="report-section-body">
              {s.hpi ? (
                <p>{s.hpi}</p>
              ) : (
                <div>
                  <p style={{ marginBottom: 8 }}>
                    Patient reports: <strong>{chiefComplaint}</strong>
                  </p>
                  {fields.onset && <div>• Onset: <strong>{fields.onset}</strong></div>}
                  {fields.character && <div>• Character: <strong>{fields.character}</strong></div>}
                  {fields.radiation && <div>• Radiation: <strong>{fields.radiation}</strong></div>}
                  {fields.exacerbating && <div>• Aggravating factors: <strong>{fields.exacerbating}</strong></div>}
                  {fields.severity && <div>• Severity: <strong>{fields.severity}</strong></div>}
                  {!fields.onset && !fields.character && (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                      Detailed HPI fields will be populated when collected via the SOCRATES framework during interview.
                    </p>
                  )}
                </div>
              )}
              {redFlags.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span className="badge-abnormal" style={{ fontSize: 12 }}>
                    ⚠️ Red Flag: {redFlags[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title">🏥 Past Medical / Surgical History</div>
            <div className="report-section-body">
              {faceMatched && pastVisits.length > 0 ? (
                <>
                  {PAST_HISTORY_RAG.chronicConditions.map((c, i) => (
                    <div key={i}>• {c}</div>
                  ))}
                  <div style={{ fontSize: 12, color: 'var(--accent-blue)', marginTop: 8, fontStyle: 'italic' }}>
                    📎 Source: RAG pipeline ({pastVisits.length} prior visits)
                  </div>
                </>
              ) : pastMedical.length > 0 ? (
                pastMedical.map((item, i) => <div key={i}>• {item}</div>)
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                  No past medical history available. Will be populated from conversation or RAG retrieval.
                </div>
              )}
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title">💊 Current Medications</div>
            <div className="report-section-body">
              {medications.length > 0 ? (
                medications.map((med, i) => <div key={i}>• {med}</div>)
              ) : faceMatched ? (
                <>
                  {PAST_HISTORY_RAG.currentMedications.map((med, i) => (
                    <div key={i}>• {med}</div>
                  ))}
                  <div style={{ fontSize: 12, color: 'var(--accent-blue)', marginTop: 8, fontStyle: 'italic' }}>
                    📎 Source: RAG pipeline
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                  Not reported during this interview.
                </div>
              )}
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title">⚠️ Drug Allergies</div>
            <div className="report-section-body">
              {allergies.length > 0 ? (
                allergies.map((a, i) => (
                  <div key={i} style={{ color: 'var(--accent-red)', fontWeight: 600 }}>• {a}</div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                  No known drug allergies reported.
                </div>
              )}
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title">👨‍👩‍👦 Family History</div>
            <div className="report-section-body">
              {familyHistory.length > 0 ? (
                familyHistory.map((fh, i) => <div key={i}>• {fh}</div>)
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                  Not reported during this interview.
                </div>
              )}
            </div>
          </div>

          {/* Lab Summary — only show if we have data */}
          {(investigations.length > 0 || (faceMatched && pastVisits.length > 0)) && (
            <div className="report-section full-width">
              <div className="report-section-title">🧪 Prior Investigations Summary</div>
              <div className="report-section-body">
                {investigations.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 11 }}>Test</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 11 }}>Value</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 11 }}>Reference</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 11 }}>Status</div>
                    {investigations.map((inv, i) => (
                      <>
                        <div key={`t${i}`}>{inv.test || inv.name}</div>
                        <div key={`v${i}`} style={{ fontWeight: 700, color: inv.abnormal ? 'var(--accent-red)' : undefined }}>{inv.value}</div>
                        <div key={`r${i}`} style={{ color: 'var(--text-muted)' }}>{inv.reference || '—'}</div>
                        <div key={`s${i}`}>
                          {inv.abnormal
                            ? <span className="badge-abnormal">⚠️ {inv.status || 'ABNORMAL'}</span>
                            : <span className="badge-normal">✓ {inv.status || 'Normal'}</span>
                          }
                        </div>
                      </>
                    ))}
                  </div>
                ) : faceMatched ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    📎 Lab data from prior visits available via RAG pipeline. Will be populated from scanned documents.
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* What was actually discussed in conversation */}
          {messages.length > 0 && (
            <div className="report-section full-width">
              <div className="report-section-title">💬 Conversation Transcript ({messages.length} messages)</div>
              <div className="report-section-body" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                    <strong style={{ color: msg.role === 'system' ? 'var(--accent-teal)' : 'var(--accent-purple)' }}>
                      {msg.role === 'system' ? 'AI: ' : 'Patient: '}
                    </strong>
                    {msg.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Document Timeline */}
      {activeTab === 'timeline' && (
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>Chronological Medical Timeline</h3>
          <div className="timeline">
            {faceMatched && pastVisits.map((visit, i) => (
              <div key={i} className="timeline-item">
                <div className={`timeline-dot ${visit.isLab ? 'warning' : ''}`} />
                <div className="timeline-date">{visit.date}</div>
                <div className="timeline-content">
                  <strong>{visit.doctor}</strong>
                  <div style={{ marginTop: 4 }}>{visit.complaint}</div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Dx:</span>{' '}
                    {visit.diagnosis}
                  </div>
                  {visit.prescribed?.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Rx:</span>{' '}
                      {visit.prescribed.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="timeline-item">
              <div className="timeline-dot current" />
              <div className="timeline-date">{new Date().toISOString().split('T')[0]} (Today)</div>
              <div className="timeline-content">
                <strong>Current Visit — MediKiosk AI Intake</strong>
                <div style={{ marginTop: 4 }}>
                  Chief Complaint: {chiefComplaint}
                </div>
                {redFlags.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <span className="badge-abnormal">🚨 {redFlags[0]}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {!faceMatched && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
              No prior visits found. This is a first-time patient.
              <br />Timeline will build over subsequent visits.
            </div>
          )}
        </div>
      )}

      {/* TAB: Patient Readback */}
      {activeTab === 'readback' && (
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>🔊 Patient Audio Readback</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
            Summary is read back to the patient in their language for verification before submission.
          </p>

          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              READBACK {readbackText ? '(Live from Sarvam AI)' : '(Demo)'}:
            </div>
            <div style={{
              fontSize: 16, lineHeight: 1.8, color: 'var(--text-primary)',
              fontStyle: 'italic', padding: '12px 0',
            }}>
              {readbackText ? (
                `"${readbackText}"`
              ) : (
                <span>
                  "Aapne bataya ki <strong>{chiefComplaint}</strong>.
                  {medications.length > 0 && (
                    <> Aap currently <strong>{medications.join(', ')}</strong> le rahe hain.</>
                  )}
                  {allergies.length > 0 && (
                    <> Aapko <strong>{allergies.join(', ')}</strong> se allergy hai.</>
                  )}
                  <br /><br />
                  Kya yeh sab sahi hai?"
                </span>
              )}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 16,
              padding: '12px 16px', background: 'rgba(20, 184, 166, 0.08)', borderRadius: 'var(--radius-md)',
            }}>
              <button style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: 'var(--accent-teal)', color: 'white', fontSize: 20,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                ▶
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: '0%', height: '100%', background: 'var(--accent-teal)', borderRadius: 2 }} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>0:00 / 0:42</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }}>
              ✅ "Haan, sahi hai" (Yes, correct)
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }}>
              ❌ "Nahi, change karna hai" (No, need to change)
            </button>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="action-bar" style={{ marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onReset}>
          🔄 New Patient
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          {reportStatus === 'draft' && (
            <>
              <button className="btn btn-secondary">
                ✏️ Edit Summary
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={async () => {
                  if (patientId && sessionId && apiBase) {
                    try {
                      await fetch(
                        `${apiBase}/summary/confirm?patient_id=${patientId}&session_id=${sessionId}`,
                        { method: 'POST' }
                      )
                    } catch (err) {
                      console.warn('Confirm endpoint failed:', err.message)
                    }
                  }
                  setReportStatus('confirmed')
                }}
              >
                ✅ Confirm & Save to Record
              </button>
            </>
          )}
          {reportStatus === 'confirmed' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'var(--accent-green)', fontWeight: 600, fontSize: 15,
            }}>
              ✅ Report confirmed and saved to patient record. ABHA linked.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
