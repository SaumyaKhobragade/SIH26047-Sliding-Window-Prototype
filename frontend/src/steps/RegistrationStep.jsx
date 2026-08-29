import { useState, useRef, useEffect, useCallback } from 'react'

const REGISTRATION_STEPS = [
  { id: 'name', field: 'name', prompt: 'Aapka poora naam bataiye.', promptEn: 'Please tell me your full name.', touchLabel: 'Type your name', type: 'text' },
  { id: 'age', field: 'age', prompt: 'Aapki umar kitni hai?', promptEn: 'What is your age?', touchLabel: 'Enter age', type: 'number' },
  { id: 'gender', field: 'gender', prompt: 'Aap male hain, female, ya other?', promptEn: 'Are you male, female, or other?', options: ['Male', 'Female', 'Other'] },
  { id: 'phone', field: 'phone', prompt: 'Aapka phone number bataiye.', promptEn: 'What is your phone number?', touchLabel: 'Enter phone', type: 'tel' },
  { id: 'language', field: 'language', prompt: 'Aap Hindi mein baat karna chahenge, English mein, ya Hinglish mein?', promptEn: 'Would you like to speak in Hindi, English, or Hinglish?', options: ['Hinglish', 'Hindi', 'English'] },
]

const API = 'http://localhost:8080'

export default function RegistrationStep({ onComplete }) {
  // Flow states: 'scanning' → 'returning' → done  OR  'scanning' → 'new_reg' → done
  const [flowState, setFlowState] = useState('scanning') // scanning | returning | new_reg | consent
  const [form, setForm] = useState({
    name: '', age: '', gender: '', phone: '', abhaId: '', language: 'hinglish',
  })
  const [currentStep, setCurrentStep] = useState(0)
  const [faceState, setFaceState] = useState('idle')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [touchInput, setTouchInput] = useState('')
  const [returningPatient, setReturningPatient] = useState(null) // data from face match
  const [editField, setEditField] = useState(null) // which field user wants to edit
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const timeoutRef = useRef(null)
  const captureStartedRef = useRef(false)

  const step = flowState === 'new_reg' ? REGISTRATION_STEPS[currentStep] : null

  // Auto-start camera on mount
  useEffect(() => {
    startCamera()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (recognitionRef.current) recognitionRef.current.abort()
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setFaceState('capturing')
      // Auto-capture after 2.5s
      timeoutRef.current = setTimeout(() => captureAndIdentify(), 2500)
    } catch {
      setFaceState('captured')
      speakPrompt('Camera not available. Chaliye registration shuru karte hain.')
      setFlowState('new_reg')
    }
  }

  const captureAndIdentify = async () => {
    if (captureStartedRef.current) return
    captureStartedRef.current = true

    // Capture photo
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      canvasRef.current.width = 640
      canvasRef.current.height = 480
      ctx.drawImage(videoRef.current, 0, 0, 640, 480)
    }
    setFaceState('captured')

    // Try to identify via backend
    try {
      const blob = await new Promise(resolve =>
        canvasRef.current.toBlob(resolve, 'image/jpeg', 0.8)
      )
      const formData = new FormData()
      formData.append('face_image', blob, 'face.jpg')

      const res = await fetch(`${API}/patient/identify`, { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        if (data.matched && data.patient_id) {
          // Returning patient found!
          // Fetch full patient data
          const patientRes = await fetch(`${API}/health`) // We'll use the stored data
          setReturningPatient({
            patientId: data.patient_id,
            name: data.patient_name || 'Patient',
            confidence: data.confidence,
            pastVisitCount: data.past_visit_count || 0,
          })
          // Patient already identified above, no need to re-fetch

          speakPrompt(`Namaste ${data.patient_name || ''}! Aapko pehchaan liya. Aapke ${data.past_visit_count || 0} purane visits hain. Kya aapki details sahi hain?`)
          setFlowState('returning')
          // Pre-fill form with known data
          setForm(prev => ({
            ...prev,
            name: data.patient_name || prev.name,
          }))
          return
        }
      }
    } catch (err) {
      console.warn('Face identify failed:', err.message)
    }

    // No match — new patient. Combine welcome + first question into one voice.
    speakPrompt('Namaste! Aap naye patient lagte hain. Chaliye registration shuru karte hain. Aapka poora naam bataiye.')
    setFlowState('new_reg')
  }

  // Track current audio to stop overlapping voices
  const currentAudioRef = useRef(null)

  const speakPrompt = async (text) => {
    // Stop any currently playing audio first
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setIsSpeaking(true)
    try {
      const res = await fetch(`${API}/tts?text=${encodeURIComponent(text)}&language=hindi`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`)
          currentAudioRef.current = audio
          audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null }
          audio.onerror = () => { setIsSpeaking(false); currentAudioRef.current = null }
          audio.play()
          return
        }
      }
    } catch (err) {
      console.warn('TTS unavailable:', err.message)
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'hi-IN'; u.rate = 0.9
      u.onend = () => setIsSpeaking(false)
      window.speechSynthesis.speak(u)
    } else {
      setIsSpeaking(false)
    }
  }

  // Speak registration step prompts — only for step 1+ (step 0 is in the welcome message)
  const prevStepRef = useRef(-1)
  useEffect(() => {
    if (flowState === 'new_reg' && step && currentStep > 0 && currentStep !== prevStepRef.current) {
      prevStepRef.current = currentStep
      speakPrompt(step.prompt)
    }
  }, [currentStep])

  const [liveTranscript, setLiveTranscript] = useState('')
  const silenceTimerRef = useRef(null)

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
  }, [])

  const startListening = useCallback(() => {
    if (isListening) { stopListening(); return }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'hi-IN'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    setIsListening(true)
    setLiveTranscript('')

    let finalTranscript = ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += t + ' '
        } else {
          interim += t
        }
      }
      setLiveTranscript((finalTranscript + interim).trim())

      // Reset silence timer — auto-stop after 2.5s of silence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        recognition.stop()
      }, 2500)
    }

    recognition.onerror = () => { setIsListening(false); setLiveTranscript('') }
    recognition.onend = () => {
      setIsListening(false)
      const text = (finalTranscript || liveTranscript).trim()
      setLiveTranscript('')
      if (text) {
        if (flowState === 'returning') handleReturningVoice(text)
        else if (editField) handleEditVoice(text)
        else handleNewRegVoice(text)
      }
    }

    recognition.start()
  }, [flowState, currentStep, editField, isListening, liveTranscript])

  const handleReturningVoice = (transcript) => {
    const lower = transcript.toLowerCase()
    if (lower.includes('haan') || lower.includes('yes') || lower.includes('sahi') || lower.includes('correct') || lower.includes('theek')) {
      confirmAndProceed()
    } else if (lower.includes('nahi') || lower.includes('no') || lower.includes('change') || lower.includes('galat')) {
      speakPrompt('Kya change karna hai? Naam, umar, ya phone number?')
      setEditField('choosing')
    } else if (editField === 'choosing') {
      if (lower.includes('naam') || lower.includes('name')) {
        setEditField('name')
        speakPrompt('Apna sahi naam bataiye.')
      } else if (lower.includes('umar') || lower.includes('age')) {
        setEditField('age')
        speakPrompt('Apni sahi umar bataiye.')
      } else if (lower.includes('phone')) {
        setEditField('phone')
        speakPrompt('Apna sahi phone number bataiye.')
      }
    }
  }

  const handleEditVoice = (transcript) => {
    if (editField === 'name') {
      setForm(f => ({ ...f, name: transcript }))
    } else if (editField === 'age') {
      const num = transcript.replace(/\D/g, '')
      if (num) setForm(f => ({ ...f, age: num }))
    } else if (editField === 'phone') {
      const num = transcript.replace(/\D/g, '')
      if (num) setForm(f => ({ ...f, phone: num }))
    }
    setEditField(null)
    speakPrompt('Updated! Kya ab sab sahi hai?')
  }

  const handleNewRegVoice = (transcript) => {
    if (!step) return
    if (step.field === 'gender') {
      const l = transcript.toLowerCase()
      if (l.includes('female') || l.includes('mahila')) setForm(f => ({ ...f, gender: 'female' }))
      else if (l.includes('male') || l.includes('purush')) setForm(f => ({ ...f, gender: 'male' }))
      else setForm(f => ({ ...f, gender: 'other' }))
      advanceReg()
    } else if (step.field === 'language') {
      const l = transcript.toLowerCase()
      if (l.includes('hindi') && !l.includes('hinglish')) setForm(f => ({ ...f, language: 'hindi' }))
      else if (l.includes('english')) setForm(f => ({ ...f, language: 'english' }))
      else setForm(f => ({ ...f, language: 'hinglish' }))
      advanceReg()
    } else if (step.field === 'age') {
      const num = transcript.replace(/\D/g, '')
      if (num) { setForm(f => ({ ...f, age: num })); advanceReg() }
    } else if (step.field) {
      setForm(f => ({ ...f, [step.field]: transcript }))
      advanceReg()
    }
  }

  const handleTouchSubmit = () => {
    if (step?.field && touchInput.trim()) {
      setForm(f => ({ ...f, [step.field]: touchInput.trim() }))
      setTouchInput('')
      advanceReg()
    }
  }

  const handleOptionSelect = (option) => {
    if (step?.field === 'gender') setForm(f => ({ ...f, gender: option.toLowerCase() }))
    else if (step?.field === 'language') setForm(f => ({ ...f, language: option.toLowerCase() }))
    advanceReg()
  }

  const advanceReg = () => {
    if (currentStep < REGISTRATION_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      setFlowState('consent')
      speakPrompt('Aapki awaaz, chehra, aur documents AI se process honge. Kya aap agree karte hain?')
    }
  }

  const confirmAndProceed = async () => {
    let faceBlob = null
    if (canvasRef.current) {
      faceBlob = await new Promise(resolve =>
        canvasRef.current.toBlob(resolve, 'image/jpeg', 0.8)
      )
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())

    onComplete({
      ...form,
      faceBlob,
      patientId: returningPatient?.patientId || null,
      isReturning: !!returningPatient,
      pastVisitCount: returningPatient?.pastVisitCount || 0,
      faceEmbedding: '[128-d vector]',
      registeredAt: new Date().toISOString(),
    })
  }

  const progressPct = flowState === 'new_reg'
    ? Math.round((currentStep / REGISTRATION_STEPS.length) * 100)
    : flowState === 'returning' ? 100 : 50

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="glass-card" style={{ maxWidth: 780 }}>
      {/* Header with camera */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div style={{
          width: 200, height: 160, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          border: faceState === 'captured' ? '2px solid var(--accent-green)' : '2px solid var(--accent-teal)',
          position: 'relative', flexShrink: 0, background: '#000',
        }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {faceState === 'captured' && (
            <div style={{
              position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
              background: returningPatient ? 'rgba(99, 102, 241, 0.9)' : 'rgba(34, 197, 94, 0.9)',
              color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            }}>
              {returningPatient ? '🔗 Matched' : '✓ Captured'}
            </div>
          )}
          {faceState === 'capturing' && (
            <div style={{
              position: 'absolute', inset: 0, border: '2px solid var(--accent-teal)',
              borderRadius: 'var(--radius-lg)', animation: 'scanPulse 2s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 4 }}>
            {flowState === 'scanning' ? '📷 Scanning Face...' :
             flowState === 'returning' ? '👋 Welcome Back!' :
             '🏥 Voice Registration'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            {flowState === 'scanning' ? 'Checking if you are a returning patient...' :
             flowState === 'returning' ? `Match confidence: ${Math.round((returningPatient?.confidence || 0.95) * 100)}%` :
             'New patient — speak to register'}
          </p>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              background: flowState === 'returning'
                ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))',
              transition: 'width 0.4s ease', borderRadius: 2,
            }} />
          </div>

          {/* Collected info pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {form.name && <span className="info-pill">👤 {form.name}</span>}
            {form.age && <span className="info-pill">🎂 {form.age}y</span>}
            {form.gender && <span className="info-pill">⚧ {form.gender}</span>}
            {form.phone && <span className="info-pill">📞 {form.phone}</span>}
            {returningPatient && <span className="info-pill" style={{ color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.3)' }}>
              📂 {returningPatient.pastVisitCount} past visits
            </span>}
          </div>
        </div>
      </div>

      {/* ── SCANNING STATE ── */}
      {flowState === 'scanning' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
            border: '3px solid var(--accent-teal)', borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Looking up your face in our records...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* ── RETURNING PATIENT STATE ── */}
      {flowState === 'returning' && returningPatient && (
        <>
          {/* Patient details card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
            border: '1px solid rgba(139,92,246,0.2)', borderRadius: 'var(--radius-lg)',
            padding: '20px 24px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Patient Details on File
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>NAME</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{form.name || returningPatient.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PATIENT ID</div>
                <div style={{ fontSize: 14, fontFamily: 'monospace', color: 'var(--accent-teal)' }}>{returningPatient.patientId}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PAST VISITS</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{returningPatient.pastVisitCount}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>MATCH CONFIDENCE</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#22c55e' }}>{Math.round((returningPatient.confidence || 0.95) * 100)}%</div>
              </div>
            </div>
            {editField && editField !== 'choosing' && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder={`Enter new ${editField}`} value={touchInput}
                  onChange={e => setTouchInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && touchInput.trim()) {
                      setForm(f => ({ ...f, [editField]: touchInput.trim() }))
                      setTouchInput(''); setEditField(null)
                      speakPrompt('Updated! Kya ab sab sahi hai?')
                    }
                  }}
                  style={{ flex: 1 }} autoFocus />
                <button className="btn btn-primary" onClick={() => {
                  if (touchInput.trim()) {
                    setForm(f => ({ ...f, [editField]: touchInput.trim() }))
                    setTouchInput(''); setEditField(null)
                    speakPrompt('Updated! Kya ab sab sahi hai?')
                  }
                }}>✓</button>
              </div>
            )}
          </div>

          {/* AI prompt */}
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: isSpeaking ? 'var(--accent-teal)' : 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                animation: isSpeaking ? 'pulse 1s ease-in-out infinite' : 'none',
              }}>🤖</div>
              <div style={{ fontSize: 15 }}>
                {editField === 'choosing'
                  ? 'Kya change karna hai? Naam, umar, ya phone?'
                  : editField
                    ? `Apna sahi ${editField} bataiye.`
                    : 'Kya aapki details sahi hain? "Haan" bolein ya "change" bolein.'}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={confirmAndProceed}>
              ✅ Sahi hai — Start Interview
            </button>
            <button className="btn btn-secondary" style={{ flex: 0.6 }} onClick={() => {
              setEditField('choosing')
              speakPrompt('Kya change karna hai? Naam, umar, ya phone number?')
            }}>
              ✏️ Change Details
            </button>
          </div>
        </>
      )}

      {/* ── NEW REGISTRATION STATE ── */}
      {flowState === 'new_reg' && step && (
        <>
          {/* AI prompt */}
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: isSpeaking ? 'var(--accent-teal)' : 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                animation: isSpeaking ? 'pulse 1s ease-in-out infinite' : 'none',
              }}>🤖</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6, marginBottom: 6 }}>{step.prompt}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{step.promptEn}</div>
              </div>
            </div>
          </div>

          {/* Input area */}
          <div style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 16,
          }}>
            {step.options ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {step.options.map(opt => (
                  <button key={opt} className="touch-option" onClick={() => handleOptionSelect(opt)}
                    style={{ flex: 1, minWidth: 120, padding: '12px 16px', fontSize: 14 }}>
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type={step.type || 'text'} placeholder={step.touchLabel}
                  value={touchInput} onChange={e => setTouchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTouchSubmit()} autoFocus style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={handleTouchSubmit}>✓</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CONSENT STATE ── */}
      {flowState === 'consent' && (
        <div style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: isSpeaking ? 'var(--accent-teal)' : 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              animation: isSpeaking ? 'pulse 1s ease-in-out infinite' : 'none',
            }}>🤖</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>
                Aapki awaaz, chehra, aur documents AI se process honge. Kya aap agree karte hain?
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                Your voice, face, and documents will be processed by AI. Do you agree? (DPDP Act 2023 compliant)
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={confirmAndProceed}>
              ✅ Haan, agree (Yes)
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => {
              speakPrompt('Theek hai, aap bina consent ke proceed nahi kar sakte.')
            }}>
              ❌ Nahi (No)
            </button>
          </div>
        </div>
      )}

      {/* ── MIC BUTTON (always visible except scanning) ── */}
      {flowState !== 'scanning' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <button onClick={startListening}
            style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none',
              background: isListening
                ? 'linear-gradient(135deg, #ef4444, #f97316)'
                : 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
              color: '#fff', fontSize: 28, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isListening ? '0 0 24px rgba(239,68,68,0.4)' : '0 4px 20px rgba(20,184,166,0.3)',
              animation: isListening ? 'pulse 1s ease-in-out infinite' : 'none',
            }}>
            {isListening ? '⏹' : '🎙️'}
          </button>
          {isListening && liveTranscript && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: 14,
              color: '#fca5a5', fontWeight: 500, maxWidth: '100%', textAlign: 'center',
            }}>
              "{liveTranscript}"
            </div>
          )}
          <span style={{
            fontSize: 12,
            color: isListening ? 'var(--accent-red)' : 'var(--text-muted)',
            fontWeight: isListening ? 600 : 400,
          }}>
            {isListening ? '🔴 Listening... tap mic to stop' : 'Tap mic to speak, or use buttons above'}
          </span>
        </div>
      )}
    </div>
  )
}
