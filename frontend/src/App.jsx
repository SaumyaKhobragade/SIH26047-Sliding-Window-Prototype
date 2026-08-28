import { useState, useCallback } from 'react'
import RegistrationStep from './steps/RegistrationStep'
import ConversationStep from './steps/ConversationStep'
import PrescriptionStep from './steps/PrescriptionStep'
import DoctorReportStep from './steps/DoctorReportStep'

const API = 'http://localhost:8080'

const STEPS = [
  { id: 'register', label: 'Register' },
  { id: 'converse', label: 'Converse' },
  { id: 'scan', label: 'Scan' },
  { id: 'report', label: 'Report' },
]

export default function App() {
  const [currentStep, setCurrentStep] = useState(0)
  const [patientData, setPatientData] = useState(null)
  const [conversationData, setConversationData] = useState(null)
  const [prescriptionData, setPrescriptionData] = useState(null)
  const [faceMatched, setFaceMatched] = useState(false)

  // Backend state
  const [patientId, setPatientId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [readbackData, setReadbackData] = useState(null)

  const handleRegistrationComplete = useCallback(async (data) => {
    setPatientData(data)

    try {
      let pid = data.patientId || null
      const isReturning = data.isReturning || false

      if (isReturning && pid) {
        // Returning patient — already registered, skip re-registration
        setPatientId(pid)
        setFaceMatched(true)
      } else {
        // New patient — register via backend
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

      // Start ACI session for both new and returning patients
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

    // Generate summary from backend
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

        // Generate readback
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
  }, [])

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <RegistrationStep onComplete={handleRegistrationComplete} />
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
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="app-container">
      <div className="bg-mesh" />

      <div className="top-bar">
        <div className="logo">
          <div className="logo-icon">🏥</div>
          <div>
            <div className="logo-text">MediKiosk</div>
            <div className="logo-sub">AI Clinical History Platform</div>
          </div>
        </div>

        <div className="step-indicator">
          {STEPS.map((step, i) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                className={`step-dot ${
                  i < currentStep ? 'completed' : i === currentStep ? 'active' : ''
                }`}
                title={step.label}
              />
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < currentStep ? 'completed' : ''}`} />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {patientId && (
            <span style={{ fontSize: 11, color: 'var(--accent-teal)', fontFamily: 'monospace' }}>
              {patientId}
            </span>
          )}
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            SIH26047 • Ministry of Ayush
          </span>
        </div>
      </div>

      <div className="main-content">
        {renderStep()}
      </div>
    </div>
  )
}
