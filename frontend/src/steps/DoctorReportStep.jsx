import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Check, Brain, AlertTriangle, ClipboardList, Calendar, Volume2, Paperclip,
  Sparkles, Play, Pause, FileText, Printer, RotateCcw, ShieldCheck, Stethoscope,
  FlaskConical, Siren, HelpCircle, ThumbsUp, ThumbsDown, Languages,
} from 'lucide-react'

// There is deliberately NO mock past history in this file any more. It used to
// hold three invented visits, four medications and an HbA1c of 8.1%, and rendered
// them whenever `faceMatched` was true but the backend returned no history — so a
// patient the kiosk had merely recognised was handed to the doctor with a
// diabetes/hyperlipidemia history and drugs nobody had prescribed. An empty
// section is safe; a fabricated one is not.

const FIELD_LABELS = {
  chief_complaint: 'Chief complaint',
  onset: 'Onset',
  character: 'Character',
  radiation: 'Radiation',
  associated_symptoms: 'Associated symptoms',
  timing: 'Timing',
  exacerbating: 'Aggravating / relieving',
  severity: 'Severity',
  past_medical: 'Past medical history',
  medications: 'Medications',
  allergies: 'Allergies',
  family_history: 'Family history',
  personal_history: 'Personal history',
}

const prettyField = (f) => FIELD_LABELS[f] || f.replace(/_/g, ' ')

// Fixed bar heights — Math.random() in the render body re-drew the waveform on
// every state change, which made the card twitch whenever anything else updated.
const WAVE_HEIGHTS = [9, 14, 20, 12, 17, 22, 11, 16, 13, 19]

export default function DoctorReportStep({
  patient, conversation, prescriptions, faceMatched, summaryData, readbackData,
  summaryError, patientId, sessionId, apiBase, onReset, onSendToDoctor,
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [reportStatus, setReportStatus] = useState('draft')
  const [confirmError, setConfirmError] = useState('')
  const [patientDisputed, setPatientDisputed] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const audioRef = useRef(null)
  const confirmingRef = useRef(false)

  const s = summaryData || {}
  const hasRealData = Boolean(summaryData)

  useEffect(() => {
    // No point spinning for two seconds over data that is already here (or over
    // an error that is never going to resolve itself).
    const delay = hasRealData || summaryError ? 350 : 1200
    const timer = setTimeout(() => setIsLoading(false), delay)
    return () => clearTimeout(timer)
  }, [hasRealData, summaryError])

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause() }, [])

  const fields = conversation?.clinicalFields || conversation?.collectedFields || {}
  const rawAnswers = conversation?.rawAnswers || {}
  const messages = conversation?.messages || []

  const splitField = (val) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    return String(val).split(',').map(v => v.trim()).filter(Boolean)
  }
  const suffix = (n) => (n === 1 ? '' : 's')

  const chiefComplaint = s.chief_complaint || fields.chief_complaint ||
    (messages.find(m => m.role === 'patient')?.text) || 'Not provided'
  const medications = (s.current_medications?.length ? s.current_medications : null) || splitField(fields.medications)
  const allergies = (s.allergies?.length ? s.allergies : null) || splitField(fields.allergies)
  const familyHistory = (s.family_history?.length ? s.family_history : null) || splitField(fields.family_history)
  const pastMedical = (s.past_medical_history?.length ? s.past_medical_history : null) || splitField(fields.past_medical)
  const redFlags = s.red_flags || conversation?.redFlags || []
  const pastVisits = s.past_visits || []
  const investigations = s.investigations_summary || []
  const seekHelp = s.when_to_seek_help || []
  const missingFields = s.missing_fields || []
  const unverifiedFields = s.unverified_fields || []
  const abnormalCount = investigations.filter(i => i.is_abnormal).length

  // Medicines read off documents the patient actually scanned this visit.
  const prescriptionMeds = (prescriptions || [])
    .flatMap(doc => (doc.medications || []).map(m => `${m.name || m.drug_name || ''} ${m.strength || ''}`.trim()))
    .filter(Boolean)
  const allMeds = medications.length ? medications : prescriptionMeds

  const interviewComplete = hasRealData
    ? s.interview_complete
    : Boolean(conversation?.interviewComplete)
  const fieldsCollected = hasRealData
    ? s.fields_collected
    : Object.keys(fields).filter(k => fields[k]).length
  const fieldsTotal = hasRealData ? s.fields_total : (conversation?.totalQuestions || 13)

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── One confirmation path ───────────────────────────────────────────────────
  // Three buttons used to POST /summary/confirm with their own copy of this code
  // and a bare `catch {}`, so a doctor tapping two of them stored the same
  // consultation twice and a failed save still flipped the badge to "Confirmed".
  const confirmReport = useCallback(async () => {
    if (confirmingRef.current || reportStatus === 'confirmed') return
    confirmingRef.current = true
    setConfirmError('')
    try {
      if (!patientId || !sessionId || !apiBase) {
        throw new Error('No clinical session — this report was not saved to the patient record.')
      }
      const res = await fetch(
        `${apiBase}/summary/confirm?patient_id=${patientId}&session_id=${sessionId}`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      setReportStatus('confirmed')
      onSendToDoctor?.()
    } catch (err) {
      console.error('Confirm failed:', err)
      setConfirmError(err.message)
    } finally {
      confirmingRef.current = false
    }
  }, [patientId, sessionId, apiBase, reportStatus, onSendToDoctor])

  // ── Real readback audio ─────────────────────────────────────────────────────
  const readbackText = readbackData?.text || ''
  const readbackAudio = readbackData?.audio_base64 || ''

  const toggleAudio = () => {
    if (!readbackAudio) return
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPlayingAudio(false)
      return
    }
    if (!audioRef.current) {
      const audio = new Audio(`data:audio/wav;base64,${readbackAudio}`)
      audio.onended = () => setIsPlayingAudio(false)
      audio.onerror = () => setIsPlayingAudio(false)
      audio.onpause = () => setIsPlayingAudio(false)
      audioRef.current = audio
    }
    audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => setIsPlayingAudio(false))
  }

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
          {interviewComplete
            ? <><Check size={18} color="var(--accent-green)" /><small>INTAKE COMPLETE</small></>
            : <><AlertTriangle size={18} color="var(--accent-amber)" /><small>INTAKE INCOMPLETE</small></>}
        </div>
      </div>

      {/* The report could not be generated — say so instead of rendering an empty
          summary that reads like a patient with no findings. */}
      {summaryError && (
        <div className="red-flag-alert" role="alert" style={{ marginBottom: 20 }}>
          <span className="red-flag-icon"><AlertTriangle size={20} color="var(--accent-red)" /></span>
          <div className="red-flag-content">
            <h3>No structured summary was generated</h3>
            <p style={{ marginBottom: 6 }}>{summaryError}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Nothing below has been through the clinical normalization layer. Do not
              treat it as a clinical record — {Object.keys(rawAnswers).length} raw answer
              {suffix(Object.keys(rawAnswers).length)} were captured and are shown verbatim.
            </p>
          </div>
        </div>
      )}

      {/* Provenance strip — what was actually collected and how it was produced. */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center',
        fontSize: 12,
      }}>
        <span className="info-pill">
          <ClipboardList size={13} /> {fieldsCollected}/{fieldsTotal} clinical fields
        </span>
        <span className="info-pill" style={{ color: hasRealData ? 'var(--accent-teal)' : 'var(--accent-amber)' }}>
          <Sparkles size={13} /> {hasRealData
            ? `AI summary: ${s.ai_summary_source === 'llm' ? 'LLM-generated' : 'template fallback'}`
            : 'no backend summary'}
        </span>
        {conversation?.styleMode && (
          <span className="info-pill"><Languages size={13} /> {conversation.styleMode.replace(/_/g, ' ')}</span>
        )}
        {s.rag_enriched && (
          <span className="info-pill" style={{ color: 'var(--accent-blue)' }}>
            <Brain size={13} /> RAG: {pastVisits.length} prior visit{suffix(pastVisits.length)}
          </span>
        )}
        {s.generated_at && (
          <span style={{ color: 'var(--text-muted)' }}>generated {s.generated_at.slice(0, 19).replace('T', ' ')}</span>
        )}
      </div>

      {(missingFields.length > 0 || unverifiedFields.length > 0) && (
        <div style={{
          background: 'var(--accent-amber-dim)', border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 20, fontSize: 13,
          color: '#fcd34d', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {missingFields.length > 0 && (
            <div><b>Not collected:</b> {missingFields.map(prettyField).join(', ')} — the doctor still needs to ask.</div>
          )}
          {unverifiedFields.length > 0 && (
            <div>
              <b>Unverified wording:</b> {unverifiedFields.map(prettyField).join(', ')} — stored as the
              patient said it, not normalized by the clinical layer.
            </div>
          )}
        </div>
      )}

      {/* Urgency banner (deterministic triage rule, not an LLM guess) */}
      {s.urgency && (
        <div className={`urgency-banner urgency-${(s.urgency.level || '').toLowerCase()}`} style={{ marginBottom: 20 }}>
          <span className="urgency-label">TRIAGE</span>
          <strong>{s.urgency.level}</strong>
          <span>
            {s.urgency.note}
            {s.urgency.severity_score != null && ` · reported severity ${s.urgency.severity_score}/10`}
          </span>
        </div>
      )}

      {/* Red flag */}
      {redFlags.length > 0 && (
        <div className="red-flag-alert">
          <span className="red-flag-icon"><AlertTriangle size={20} color="var(--accent-red)" /></span>
          <div className="red-flag-content">
            <h3>Priority Alert — Red Flag Detected</h3>
            <p>{redFlags.join(' • ')}</p>
          </div>
        </div>
      )}

      {patientDisputed && (
        <div role="alert" style={{
          background: 'var(--accent-amber-dim)', border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 'var(--radius-md)', padding: '10px 14px', margin: '16px 0', fontSize: 13, color: '#fcd34d',
        }}>
          <b>Patient did not confirm this readback.</b> They indicated something is wrong —
          review the record with them before saving.
        </div>
      )}

      {/* Tab nav */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-glass)',
        padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
      }}>
        {[
          { id: 'summary', label: 'Clinical Summary', Icon: ClipboardList },
          { id: 'timeline', label: 'Timeline', Icon: Calendar },
          { id: 'readback', label: 'Patient Readback', Icon: Volume2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 16px', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              background: activeTab === tab.id ? 'var(--accent-teal-dim)' : 'transparent',
              border: activeTab === tab.id ? '1px solid rgba(20,184,166,0.3)' : '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              color: activeTab === tab.id ? 'var(--accent-teal)' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'var(--transition-fast)',
            }}
          >
            <tab.Icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="summary-layout">
          <section className="summary-card">
            <div className="summary-top">
              <div>
                <span className="eyebrow">CLINICAL INTAKE SUMMARY</span>
                <h2>{patient?.name || 'Patient'}</h2>
                <p>Generated {today}</p>
              </div>
              <span className="secure-badge"><ShieldCheck size={13} /> Secure</span>
            </div>

            <div className="summary-person">
              {patient?.age && <div><span>AGE</span><b>{patient.age} years</b></div>}
              {patient?.gender && <div><span>GENDER</span><b>{patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}</b></div>}
              <div><span>CHIEF COMPLAINT</span><b>{chiefComplaint}</b></div>
              {faceMatched && <div><span>STATUS</span><b style={{ color: 'var(--accent-blue)' }}>Returning patient</b></div>}
            </div>

            {/* HPI / SOCRATES */}
            <div className="summary-section">
              <h3>History of presenting illness (SOCRATES)</h3>
              {s.hpi ? (
                <p>{s.hpi}</p>
              ) : (
                <>
                  <p style={{ color: 'var(--accent-amber)', fontSize: 12, fontStyle: 'italic', marginBottom: 6 }}>
                    Not normalized — shown as the patient said it.
                  </p>
                  {Object.keys(FIELD_LABELS).slice(0, 8).some(k => fields[k] || rawAnswers[k]) ? (
                    Object.keys(FIELD_LABELS).slice(0, 8).map(k => (
                      (fields[k] || rawAnswers[k]) && (
                        <div key={k} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 3 }}>
                          <b>{prettyField(k)}:</b> {fields[k] || rawAnswers[k]}
                        </div>
                      )
                    ))
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                      No SOCRATES fields were captured.
                    </p>
                  )}
                </>
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
                <div>{allMeds.map((med, i) => <span key={i}>{med}</span>)}</div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not reported during this interview.</p>
              )}
              {allMeds.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--accent-blue)', marginTop: 8, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Paperclip size={13} />
                  Source: {medications.length
                    ? `patient interview${s.rag_enriched ? ' + past records' : ''}${prescriptions?.length ? ' + scanned documents' : ''}`
                    : 'scanned documents'}
                </div>
              )}
            </div>

            {/* AI summary — only when it really came from the summary service. */}
            <div className="summary-section ai-summary">
              <div>
                <span className="sparkle"><Sparkles size={16} color="var(--accent-teal)" /></span>
                <h3>AI clinical summary</h3>
              </div>
              {s.ai_summary ? (
                <>
                  <p>{s.ai_summary}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    {s.ai_summary_source === 'llm'
                      ? 'Generated by the clinical LLM from the collected fields.'
                      : 'Template fallback — the LLM was unavailable, so this is assembled from the fields verbatim.'}
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No AI summary available for this intake.
                </p>
              )}
            </div>

            {/* Investigations — PS gap: abnormal values highlighted for the doctor. */}
            {investigations.length > 0 && (
              <div className="summary-section">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FlaskConical size={15} /> Investigations
                  {abnormalCount > 0 && (
                    <span className="badge-abnormal" style={{ marginLeft: 6 }}>
                      {abnormalCount} out of range
                    </span>
                  )}
                </h3>
                {investigations.map((inv, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    fontSize: 13, padding: '6px 0', borderTop: i ? '1px solid var(--border-color)' : 'none',
                  }}>
                    <span style={{ fontWeight: inv.is_abnormal ? 700 : 500 }}>
                      {inv.is_abnormal && <b style={{ color: 'var(--accent-red)', marginRight: 6 }}>!</b>}
                      {inv.test || inv.test_name}
                    </span>
                    <span>
                      <b style={{ color: inv.is_abnormal ? 'var(--accent-red)' : 'var(--text-primary)' }}>{inv.value}</b>
                      <small style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                        ref {inv.reference || inv.reference_range || '—'} · {inv.document_date}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Past medical history */}
            <div className="summary-section">
              <h3>Past medical / surgical history</h3>
              {pastMedical.length > 0 ? (
                pastMedical.map((item, i) => (
                  <div key={i} style={{ marginBottom: 4, fontSize: 13, color: 'var(--text-secondary)' }}>• {item}</div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                  None reported, and none found in past records.
                </p>
              )}
            </div>

            {/* Allergies — never silently downgraded to "no known allergies". */}
            <div className="summary-section">
              <h3>Drug allergies</h3>
              {allergies.length > 0 ? (
                allergies.map((a, i) => (
                  <div key={i} style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: 13 }}>• {a}</div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                  {missingFields.includes('allergies')
                    ? 'Not asked / not answered — allergy status is UNKNOWN, not "none".'
                    : 'Patient reported no known drug allergies.'}
                </p>
              )}
            </div>

            {/* Family history */}
            {familyHistory.length > 0 && (
              <div className="summary-section">
                <h3>Family history</h3>
                {familyHistory.map((fh, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>• {fh}</div>
                ))}
              </div>
            )}

            {/* Personal history + ROS — collected by the interview, never shown before. */}
            {s.personal_history && (
              <div className="summary-section">
                <h3>Personal history</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.personal_history}</p>
              </div>
            )}
            {s.review_of_systems && (
              <div className="summary-section">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Stethoscope size={15} /> Review of systems
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.review_of_systems}</p>
              </div>
            )}

            {/* PS gap: explicit escalation advice for the patient. */}
            {seekHelp.length > 0 && (
              <div className="summary-section warning-summary">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Siren size={15} /> When to seek immediate help
                </h3>
                {seekHelp.map((h, i) => (
                  <div key={i} style={{ fontSize: 13, marginBottom: 3 }}>• {h}</div>
                ))}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                  Pre-validated clinical templates — not generated text.
                </p>
              </div>
            )}
          </section>

          {/* Completion aside */}
          <aside className="completion-side">
            {/* Audio card — plays the real readback, or says there is none. */}
            <div className="audio-card">
              <span className="eyebrow">PATIENT AUDIO SUMMARY</span>
              <h3>{readbackData?.language === 'english_professional' ? 'Listen to the summary' : 'सारांश सुनें'}</h3>
              <p>
                {readbackAudio
                  ? 'Played back to the patient for verification.'
                  : 'Audio unavailable — read the text on the Patient Readback tab.'}
              </p>
              <button id="audioButton" onClick={toggleAudio} disabled={!readbackAudio}
                style={{ opacity: readbackAudio ? 1 : 0.5, cursor: readbackAudio ? 'pointer' : 'not-allowed' }}>
                {isPlayingAudio ? <Pause size={16} /> : <Play size={16} />}
                {isPlayingAudio ? 'Playing…' : readbackAudio ? 'Play summary' : 'No audio'}
              </button>
              <div className="audio-waves">
                {WAVE_HEIGHTS.map((h, i) => (
                  <i key={i} style={{
                    height: `${h}px`,
                    opacity: isPlayingAudio ? 0.8 : 0.3,
                    transition: 'opacity 0.3s',
                  }} />
                ))}
              </div>
            </div>

            {/* Status badge */}
            <span className={`status-badge ${reportStatus}`} style={{ alignSelf: 'flex-start' }}>
              {reportStatus === 'draft'
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Draft — Awaiting Confirmation</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Confirmed</span>}
            </span>

            {confirmError && (
              <div role="alert" style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 12, color: '#fca5a5',
              }}>
                {confirmError}
              </div>
            )}

            {reportStatus === 'draft' ? (
              <>
                <button className="primary-action send-button" id="sendDoctor" onClick={confirmReport}>
                  Send to Doctor <span>→</span>
                </button>
                <button className="print-button" id="printReport" onClick={() => window.print()}>
                  <Printer size={15} /> Print report
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600, fontSize: 14 }}>
                <Check size={16} /> Saved to the patient record. This visit is now part of their history.
              </div>
            )}

            <button className="btn btn-secondary btn-full" onClick={onReset} style={{ marginTop: 4 }}>
              <RotateCcw size={16} /> New Patient
            </button>
          </aside>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, marginBottom: 6 }}>
            Chronological Medical Timeline
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Past visits, scanned documents and today's intake in date order — the doctor
            no longer has to reconstruct the sequence from loose paper.
          </p>
          {/* Uses the backend's merged timeline (visits + documents + current visit)
              rather than past_visits alone, which left every scanned report out. */}
          {(s.timeline || []).length > 0 ? (
            <div className="timeline">
              {s.timeline.map((entry, i) => {
                const isCurrent = entry.type === 'current_visit'
                const isLab = entry.type === 'lab_report'
                const meds = entry.medications?.filter(Boolean) || []
                return (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot${isCurrent ? ' current' : isLab ? ' warning' : ''}`} />
                    <div className="timeline-date">
                      {entry.date}{isCurrent ? ' (Today)' : ''}
                    </div>
                    <div className="timeline-content">
                      <strong>
                        {isCurrent ? 'Current Visit — Aarogya AI Intake' : entry.doctor || 'Unknown source'}
                      </strong>
                      <div style={{ marginTop: 4 }}>{entry.summary}</div>
                      {meds.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 13 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Rx:</span> {meds.join(', ')}
                        </div>
                      )}
                      {entry.red_flags?.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <span className="badge-abnormal"><AlertTriangle size={12} /> {entry.red_flags[0]}</span>
                        </div>
                      )}
                      {isCurrent && redFlags.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <span className="badge-abnormal"><AlertTriangle size={12} /> {redFlags[0]}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {entry.type?.replace(/_/g, ' ')}
                        {entry.ocr_confidence != null && ` · OCR ${Math.round(entry.ocr_confidence * 100)}%`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-dot current" />
                <div className="timeline-date">{new Date().toISOString().split('T')[0]} (Today)</div>
                <div className="timeline-content">
                  <strong>Current Visit — Aarogya AI Intake</strong>
                  <div style={{ marginTop: 4 }}>Chief complaint: {chiefComplaint}</div>
                </div>
              </div>
            </div>
          )}
          {!s.rag_enriched && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>
              No prior confirmed visits — this is a first-time patient.<br />
              The timeline builds from the next visit onward.
            </div>
          )}
        </div>
      )}

      {activeTab === 'readback' && (
        <div className="glass-card" style={{ maxWidth: '100%' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Volume2 size={22} /> Patient Audio Readback
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
            The record is read back to the patient in their own language so they can
            correct it before it reaches the doctor.
          </p>

          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              READBACK {readbackText ? `· ${readbackData?.language || 'patient language'}` : '· UNAVAILABLE'}
            </div>
            {/* The old fallback invented a Hinglish sentence out of local state and
                showed it as if the kiosk had spoken it. */}
            <div style={{ fontSize: 15, lineHeight: 1.8, color: readbackText ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
              {readbackText
                ? `"${readbackText}"`
                : 'No readback was generated for this session — the patient has not verified this record.'}
            </div>

            {readbackAudio ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: '12px 16px', background: 'rgba(20,184,166,0.08)', borderRadius: 'var(--radius-md)' }}>
                <button
                  onClick={toggleAudio}
                  style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--accent-teal)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label={isPlayingAudio ? 'Pause readback' : 'Play readback'}
                >
                  {isPlayingAudio ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {isPlayingAudio ? 'Playing the readback…' : 'Play the readback for the patient'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                <HelpCircle size={14} /> Text-to-speech was unavailable, so read the text above aloud.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }}
              disabled={reportStatus === 'confirmed'}
              onClick={() => { setPatientDisputed(false); confirmReport() }}>
              <ThumbsUp size={16} /> Patient confirms — save to record
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }}
              onClick={() => { setPatientDisputed(true); setActiveTab('summary') }}>
              <ThumbsDown size={16} /> Patient disputes something
            </button>
          </div>
        </div>
      )}

      <div className="action-bar" style={{ marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onReset}><RotateCcw size={16} /> New Patient</button>
        {reportStatus === 'draft' ? (
          <button className="btn btn-primary btn-lg" onClick={confirmReport}>
            <Check size={16} /> Confirm &amp; Save to Record
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600, fontSize: 14 }}>
            <Check size={16} /> Report confirmed and saved to patient record.
          </div>
        )}
      </div>
    </>
  )
}
