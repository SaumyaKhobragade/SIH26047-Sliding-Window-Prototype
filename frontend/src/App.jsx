import { useState, useCallback, useEffect } from 'react'
import RegistrationStep from './steps/RegistrationStep'
import ConversationStep from './steps/ConversationStep'
import PrescriptionStep from './steps/PrescriptionStep'
import DoctorReportStep from './steps/DoctorReportStep'

const API = 'http://localhost:8080'

// Map React step index + RegistrationStep flowState → sidebar step 1-6
function getSidebarActive(currentStep, regFlowState) {
  if (currentStep === 0) {
    if (regFlowState === 'scanning') return 1
    if (regFlowState === 'returning') return 2
    return 3 // new_reg or consent
  }
  if (currentStep === 1) return 4
  if (currentStep === 2) return 5
  return 6
}

const JOURNEY_STEPS = [
  { n: '01', label: 'Identify' },
  { n: '02', label: 'Confirm' },
  { n: '03', label: 'Register' },
  { n: '04', label: 'Listen' },
  { n: '05', label: 'Records' },
  { n: '06', label: 'Summary' },
]

export default function App() {
  const [currentStep, setCurrentStep] = useState(0)
  const [patientData, setPatientData] = useState(null)
  const [conversationData, setConversationData] = useState(null)
  const [prescriptionData, setPrescriptionData] = useState(null)
  const [faceMatched, setFaceMatched] = useState(false)
  const [regFlowState, setRegFlowState] = useState('scanning')
  const [toastVisible, setToastVisible] = useState(false)
  const [clock, setClock] = useState('')

  // Backend state
  const [patientId, setPatientId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [readbackData, setReadbackData] = useState(null)

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleRegistrationComplete = useCallback(async (data) => {
    setPatientData(data)

    try {
      let pid = data.patientId || null
      const isReturning = data.isReturning || false

      if (isReturning && pid) {
        setPatientId(pid)
        setFaceMatched(true)
      } else {
        const formData = new FormData()
        formData.append('name', data.name)
        formData.append('age', data.age)
        formData.append('gender', data.gender)
        formData.append('phone', data.phone || '')
        formData.append('abha_id', data.abhaId || '')
        formData.append('language_preference', data.language || 'hinglish')

        if (data.faceBlob) {
          formData.append('face_image', data.faceBlob, 'face.jpg')
        }

        const res = await fetch(`${API}/patient/register`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const result = await res.json()
          pid = result.patient_id
          setPatientId(pid)
          setFaceMatched(result.is_returning || false)
        }
      }

      if (pid) {
        const aciRes = await fetch(
          `${API}/aci/start?patient_id=${pid}&language=${data.language || 'hinglish'}`,
          { method: 'POST' }
        )
        if (aciRes.ok) {
          const aciData = await aciRes.json()
          setSessionId(aciData.session_id)
          setPatientData(prev => ({
            ...prev,
            patientId: pid,
            sessionId: aciData.session_id,
            greeting: aciData.greeting,
            touchOptions: aciData.touch_options,
            styleMode: aciData.style_mode,
          }))
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using mock mode:', err.message)
      setPatientId('PT-MOCK-' + Date.now())
      setSessionId('SESS-MOCK-' + Date.now())
      setFaceMatched(Math.random() > 0.6)
    }

    setCurrentStep(1)
  }, [])

  const handleConversationComplete = useCallback((data) => {
    setConversationData(data)
    setCurrentStep(2)
  }, [])

  const handlePrescriptionComplete = useCallback(async (data) => {
    setPrescriptionData(data)

    if (patientId && sessionId) {
      try {
        const res = await fetch(
          `${API}/summary/generate?patient_id=${patientId}&session_id=${sessionId}`,
          { method: 'POST' }
        )
        if (res.ok) {
          const summary = await res.json()
          setSummaryData(summary)
        }

        const rbRes = await fetch(
          `${API}/readback/generate?patient_id=${patientId}&session_id=${sessionId}`,
          { method: 'POST' }
        )
        if (rbRes.ok) {
          const rb = await rbRes.json()
          setReadbackData(rb)
        }
      } catch (err) {
        console.warn('Summary generation failed, using mock:', err.message)
      }
    }

    setCurrentStep(3)
  }, [patientId, sessionId])

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }, [])

  const handleReset = useCallback(() => {
    setCurrentStep(0)
    setPatientData(null)
    setConversationData(null)
    setPrescriptionData(null)
    setFaceMatched(false)
    setPatientId(null)
    setSessionId(null)
    setSummaryData(null)
    setReadbackData(null)
    setRegFlowState('scanning')
  }, [])

  const showToast = useCallback(() => {
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 4000)
  }, [])

  const sidebarActive = getSidebarActive(currentStep, regFlowState)

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <RegistrationStep
            onComplete={handleRegistrationComplete}
            onFlowStateChange={setRegFlowState}
          />
        )
      case 1:
        return (
          <ConversationStep
            patient={patientData}
            sessionId={sessionId}
            patientId={patientId}
            apiBase={API}
            onComplete={handleConversationComplete}
            onBack={handleBack}
          />
        )
      case 2:
        return (
          <PrescriptionStep
            patient={patientData}
            patientId={patientId}
            apiBase={API}
            onComplete={handlePrescriptionComplete}
            onBack={handleBack}
          />
        )
      case 3:
        return (
          <DoctorReportStep
            patient={patientData}
            conversation={conversationData}
            prescriptions={prescriptionData}
            faceMatched={faceMatched}
            summaryData={summaryData}
            readbackData={readbackData}
            patientId={patientId}
            sessionId={sessionId}
            apiBase={API}
            onReset={handleReset}
            onSendToDoctor={showToast}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-mesh" />

      {/* Topbar */}
      <header className="topbar">
        <a className="brand" href="#" aria-label="Aarogya home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Aarogya</span>
        </a>

        <div className="encounter-info">
          <span className="online-dot" />
          <span>Private consultation</span>
          <b style={{ opacity: 0.4 }}>•</b>
          <span>{clock}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {patientId && (
            <span style={{ fontSize: 11, color: 'var(--accent-teal)', fontFamily: 'monospace', opacity: 0.8 }}>
              {patientId}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            SIH26047 · Ministry of Ayush
          </span>
          <button className="help-button" aria-label="Get help">?</button>
        </div>
      </header>

      {/* Main: sidebar + screen */}
      <div className="main-content">
        {/* Journey Sidebar */}
        <aside className="journey" aria-label="Patient intake steps">
          <div className="journey-intro">
            <span className="eyebrow">PATIENT INTAKE</span>
            <h2>Your care,<br />one calm step<br />at a time.</h2>
          </div>

          <nav className="step-list">
            {JOURNEY_STEPS.map((step, i) => {
              const stepN = i + 1
              const isActive = stepN === sidebarActive
              const isDone = stepN < sidebarActive
              return (
                <button
                  key={step.n}
                  className={`journey-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span>{step.n}</span>
                  <em>{step.label}</em>
                </button>
              )
            })}
          </nav>

          <div className="journey-footer">
            <span className="lock">⌁</span>
            Your information stays secure
          </div>
        </aside>

        {/* Screen Stage */}
        <section className="screen-stage">
          <article className="screen">
            {renderStep()}
          </article>
        </section>
      </div>

      {/* Toast */}
      <div className={`toast${toastVisible ? '' : ' hidden'}`} role="status">
        <span>✓</span>
        <p>
          <b>Sent securely</b><br />
          The doctor has received {patientData?.name || 'the patient'}'s intake summary.
        </p>
      </div>
    </div>
  )
}
