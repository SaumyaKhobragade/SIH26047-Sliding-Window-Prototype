import { useState, useRef, useEffect, useCallback } from 'react'

const REGISTRATION_STEPS = [
  { id: 'name', field: 'name', prompt: 'Aapka poora naam bataiye.', promptEn: 'Please tell me your full name.', touchLabel: 'Type your name', type: 'text' },
  { id: 'age', field: 'age', prompt: 'Aapki umar kitni hai?', promptEn: 'What is your age?', touchLabel: 'Enter age', type: 'number' },
  { id: 'gender', field: 'gender', prompt: 'Aap male hain, female, ya other?', promptEn: 'Are you male, female, or other?', options: ['Male', 'Female', 'Other'] },
  { id: 'phone', field: 'phone', prompt: 'Aapka phone number bataiye.', promptEn: 'What is your phone number?', touchLabel: 'Enter phone', type: 'tel' },
  { id: 'language', field: 'language', prompt: 'Aap Hindi mein baat karna chahenge, English mein, ya Hinglish mein?', promptEn: 'Would you like to speak in Hindi, English, or Hinglish?', options: ['Hinglish', 'Hindi', 'English'] },
]

const API = 'http://localhost:8080'

export default function RegistrationStep({ onComplete, onFlowStateChange }) {
  const [flowState, setFlowState] = useState('scanning') // scanning | returning | new_reg | consent
  const [form, setForm] = useState({
    name: '', age: '', gender: '', phone: '', abhaId: '', language: 'hinglish',
  })
  const [currentStep, setCurrentStep] = useState(0)
  const [faceState, setFaceState] = useState('idle')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [touchInput, setTouchInput] = useState('')
  const [returningPatient, setReturningPatient] = useState(null)
  const [editField, setEditField] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const captureTimerRef = useRef(null)
  const hasCapturedRef = useRef(false)

  const step = flowState === 'new_reg' ? REGISTRATION_STEPS[currentStep] : null

  // Notify parent of flow state changes for sidebar
  useEffect(() => {
    onFlowStateChange?.(flowState)
  }, [flowState, onFlowStateChange])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (recognitionRef.current) recognitionRef.current.abort()
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current)
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
      captureTimerRef.current = setTimeout(() => captureAndIdentify(), 2500)
    } catch {
      setFaceState('captured')
      if (!hasCapturedRef.current) {
        hasCapturedRef.current = true
        speakPrompt('Camera not available. Chaliye registration shuru karte hain. Aapka poora naam bataiye.')
        setFlowState('new_reg')
      }
    }
  }

  const captureAndIdentify = async () => {
    if (hasCapturedRef.current) return
    hasCapturedRef.current = true
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      canvasRef.current.width = 640
      canvasRef.current.height = 480
      ctx.drawImage(videoRef.current, 0, 0, 640, 480)
    }
    setFaceState('captured')

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
          setReturningPatient({
            patientId: data.patient_id,
            name: data.patient_name || 'Patient',
            confidence: data.confidence,
            pastVisitCount: data.past_visit_count || 0,
          })
          speakPrompt(`Namaste ${data.patient_name || ''}! Aapko pehchaan liya. Aapke ${data.past_visit_count || 0} purane visits hain. Kya aapki details sahi hain?`)
          setFlowState('returning')
          setForm(prev => ({ ...prev, name: data.patient_name || prev.name }))
          return
        }
      }
    } catch (err) {
      console.warn('Face identify failed:', err.message)
    }

    speakPrompt('Namaste! Aap naye patient lagte hain. Chaliye registration shuru karte hain. Aapka poora naam bataiye.')
    setFlowState('new_reg')
  }

  const currentAudioRef = useRef(null)

  const speakPrompt = async (text) => {
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }
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
    } catch (err) { console.warn('TTS unavailable:', err.message) }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'hi-IN'; u.rate = 0.9
      u.onend = () => setIsSpeaking(false)
      window.speechSynthesis.speak(u)
    } else { setIsSpeaking(false) }
  }

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
    if (recognitionRef.current) recognitionRef.current.stop()
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
        if (event.results[i].isFinal) finalTranscript += t + ' '
        else interim += t
      }
      setLiveTranscript((finalTranscript + interim).trim())
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => recognition.stop(), 2500)
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
      if (lower.includes('naam') || lower.includes('name')) { setEditField('name'); speakPrompt('Apna sahi naam bataiye.') }
      else if (lower.includes('umar') || lower.includes('age')) { setEditField('age'); speakPrompt('Apni sahi umar bataiye.') }
      else if (lower.includes('phone')) { setEditField('phone'); speakPrompt('Apna sahi phone number bataiye.') }
    }
  }

  const handleEditVoice = (transcript) => {
    if (editField === 'name') setForm(f => ({ ...f, name: transcript }))
    else if (editField === 'age') { const num = transcript.replace(/\D/g, ''); if (num) setForm(f => ({ ...f, age: num })) }
    else if (editField === 'phone') { const num = transcript.replace(/\D/g, ''); if (num) setForm(f => ({ ...f, phone: num })) }
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
      faceBlob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.8))
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

  // ─── RENDER ───────────────────────────────────────────────────────────

  // Screen 1: Camera / Scanning / new_reg initial view
  if (flowState === 'scanning' || (flowState === 'new_reg' && !step?.options)) {

    return (
      <>
        {/* Screen 1: Identify */}
        {flowState === 'scanning' && (
          <>
            <div className="screen-heading">
              <span className="eyebrow">NAMASTE · WELCOME</span>
              <h1>Let's begin with<br /><i>your presence.</i></h1>
              <p>Look at the camera to identify yourself.</p>
            </div>

            <div className="scan-layout">
              {/* Camera card */}
              <div className="camera-card">
                <div className="camera-top">
                  <span><span className="live-dot" /> LIVE CAMERA</span>
                  <span>HD · 1080p</span>
                </div>
                <div className="camera-video-wrap">
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div className="camera-fallback" style={{ display: faceState === 'idle' ? 'flex' : 'none' }}>
                    <div className="portrait-shape">
                      <div className="hair" /><div className="face"><i /><i /><b /></div>
                      <div className="neck" /><div className="shoulders" />
                    </div>
                  </div>
                  <div className="scan-frame">
                    <span /><span /><span /><span />
                  </div>
                  {faceState === 'capturing' && <div className="scan-pulse-overlay" />}
                  <div className="face-guide">
                    <span className="guide-ring" />
                    <small>POSITION FACE IN FRAME</small>
                  </div>
                  {faceState === 'captured' && (
                    <div className="face-matched-badge">
                      {returningPatient ? '🔗 Matched' : '✓ Captured'}
                    </div>
                  )}
                </div>
                <div className="camera-bottom">
                  <span>Face recognition is encrypted</span>
                  <span className="camera-battery">▰</span>
                </div>
              </div>

              {/* Actions */}
              <div className="scan-actions">
                <p className="scan-note">
                  <span>✦</span>
                  We'll only use this to find your care records.
                </p>

                {faceState === 'capturing' ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div className="scan-spinner" />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Looking up your face in our records…</p>
                  </div>
                ) : (
                  <button className="capture-button" onClick={() => { if (!hasCapturedRef.current) captureAndIdentify() }}>
                    <span className="capture-icon" /> Capture <kbd>↵</kbd>
                  </button>
                )}

                <div className="language-box">
                  <span>YOUR LANGUAGE</span>
                  <div className="language-toggle" role="group" aria-label="Select language">
                    {['हिंदी', 'English', 'Hinglish'].map(l => (
                      <button
                        key={l}
                        className={selectedLanguage === l ? 'selected' : ''}
                        onClick={() => setSelectedLanguage(l)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Screen 3: New Registration (non-scanning) */}
        {flowState === 'new_reg' && step && (
          <NewRegView
            step={step}
            currentStep={currentStep}
            totalSteps={REGISTRATION_STEPS.length}
            isSpeaking={isSpeaking}
            isListening={isListening}
            liveTranscript={liveTranscript}
            touchInput={touchInput}
            setTouchInput={setTouchInput}
            form={form}
            videoRef={videoRef}
            canvasRef={canvasRef}
            faceState={faceState}
            returningPatient={returningPatient}
            onOptionSelect={handleOptionSelect}
            onTouchSubmit={handleTouchSubmit}
            onMicClick={startListening}
          />
        )}

        {/* Consent */}
        {flowState === 'consent' && (
          <ConsentView
            isSpeaking={isSpeaking}
            isListening={isListening}
            liveTranscript={liveTranscript}
            form={form}
            onConfirm={confirmAndProceed}
            onMicClick={startListening}
            speakPrompt={speakPrompt}
          />
        )}
      </>
    )
  }

  // Screen 2: Returning patient confirm
  if (flowState === 'returning' && returningPatient) {
    return (
      <>
        <div className="screen-heading compact-heading">
          <span className="eyebrow">IDENTITY CONFIRMED</span>
          <h1>Is this <i>you?</i></h1>
          <p>We found a possible match in the Aarogya care network.</p>
        </div>

        <div className="match-card">
          <div className="match-photo">
            <canvas ref={canvasRef} style={{
              width: 140, height: 160, objectFit: 'cover', borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent-teal)', display: 'block', background: 'var(--bg-secondary)'
            }} />
            <div className="photo-tag"><span /> FACE MATCHED</div>
          </div>

          <div className="patient-profile">
            <div className="confidence">
              <span>{Math.round((returningPatient.confidence || 0.95) * 100)}%</span>
              <small>match confidence</small>
              <div className="confidence-bar-track">
                <div
                  className="confidence-bar-fill"
                  style={{ width: `${Math.round((returningPatient.confidence || 0.95) * 100)}%` }}
                />
              </div>
            </div>

            <span className="eyebrow">PATIENT RECORD</span>
            <h2>{form.name || returningPatient.name}</h2>

            <div className="profile-meta">
              <div><small>PATIENT ID</small><b style={{ fontFamily: 'monospace', color: 'var(--accent-teal)', fontSize: 13 }}>{returningPatient.patientId}</b></div>
              <div><small>PAST VISITS</small><b>{returningPatient.pastVisitCount} visits</b></div>
            </div>

            {editField && editField !== 'choosing' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder={`Enter new ${editField}`}
                  value={touchInput}
                  onChange={e => setTouchInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && touchInput.trim()) {
                      setForm(f => ({ ...f, [editField]: touchInput.trim() }))
                      setTouchInput(''); setEditField(null)
                      speakPrompt('Updated! Kya ab sab sahi hai?')
                    }
                  }}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={() => {
                  if (touchInput.trim()) {
                    setForm(f => ({ ...f, [editField]: touchInput.trim() }))
                    setTouchInput(''); setEditField(null)
                    speakPrompt('Updated! Kya ab sab sahi hai?')
                  }
                }}>✓</button>
              </div>
            )}

            <div className="profile-actions">
              <button className="primary-action" onClick={confirmAndProceed}>
                Sahi hai <span>—</span> Start Interview
              </button>
              <button className="text-action" onClick={() => {
                setEditField('choosing')
                speakPrompt('Kya change karna hai? Naam, umar, ya phone number?')
              }}>
                Change details
              </button>
            </div>
          </div>
        </div>

        <div className="speak-hint">
          <button
            className={`mini-mic${isListening ? ' is-listening' : ''}`}
            onClick={startListening}
            aria-label="Speak"
          >⌁</button>
          <span><b>Prefer to speak?</b> Tap the mic and say "Yes, this is me".</span>
        </div>

        {isListening && liveTranscript && (
          <div style={{
            marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: 14,
            color: '#fca5a5', fontWeight: 500, textAlign: 'center',
          }}>
            "{liveTranscript}"
          </div>
        )}
      </>
    )
  }

  // New reg / consent fallback
  if (flowState === 'new_reg' && step) {
    return (
      <NewRegView
        step={step}
        currentStep={currentStep}
        totalSteps={REGISTRATION_STEPS.length}
        isSpeaking={isSpeaking}
        isListening={isListening}
        liveTranscript={liveTranscript}
        touchInput={touchInput}
        setTouchInput={setTouchInput}
        form={form}
        videoRef={videoRef}
        canvasRef={canvasRef}
        faceState={faceState}
        returningPatient={returningPatient}
        onOptionSelect={handleOptionSelect}
        onTouchSubmit={handleTouchSubmit}
        onMicClick={startListening}
      />
    )
  }

  if (flowState === 'consent') {
    return (
      <ConsentView
        isSpeaking={isSpeaking}
        isListening={isListening}
        liveTranscript={liveTranscript}
        form={form}
        onConfirm={confirmAndProceed}
        onMicClick={startListening}
        speakPrompt={speakPrompt}
      />
    )
  }

  return null
}

// ── Sub-view: New Registration (chat style) ──────────────────────────────────
function NewRegView({ step, currentStep, totalSteps, isSpeaking, isListening, liveTranscript,
  touchInput, setTouchInput, form, videoRef, canvasRef, faceState, returningPatient,
  onOptionSelect, onTouchSubmit, onMicClick }) {

  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100)
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <div className="screen-heading split-heading">
        <div>
          <span className="eyebrow">NEW PATIENT</span>
          <h1>Let's get to <i>know you.</i></h1>
          <p>Answer in the language that feels natural.</p>
        </div>
        <div className="step-counter">
          <b id="registerStep">Step {currentStep + 1}</b>
          <span> of {totalSteps}</span>
          <div><i style={{ width: `${progressPct}%` }} /></div>
        </div>
      </div>

      <div className="chat-shell register-chat">
        <div className="chat-date">TODAY · FIRST VISIT</div>
        <div className="chat-messages-inner">
          {/* Collected info pills */}
          {(form.name || form.age || form.gender || form.phone) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
              {form.name && <span className="info-pill">👤 {form.name}</span>}
              {form.age && <span className="info-pill">🎂 {form.age}y</span>}
              {form.gender && <span className="info-pill">⚧ {form.gender}</span>}
              {form.phone && <span className="info-pill">📞 {form.phone}</span>}
            </div>
          )}
          <div className="message system">
            <span className="avatar ai-avatar">A</span>
            <div>
              <div className="message-bubble-inner">
                <p>Namaste! I'm Aarogya, your care assistant.</p>
                <p className="question" style={{ marginTop: 6 }}>{step.prompt}</p>
                {step.promptEn && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{step.promptEn}</p>}
              </div>
              <time className="message-time">{now}</time>
            </div>
          </div>
        </div>

        {step.options && (
          <div className="suggestions">
            {step.options.map(opt => (
              <button key={opt} onClick={() => onOptionSelect(opt)}>{opt}</button>
            ))}
            <button onClick={onMicClick}>Say it aloud</button>
          </div>
        )}

        <div className="voice-dock">
          <button
            className={`large-mic${isListening ? ' is-listening' : ''}`}
            onClick={onMicClick}
            aria-label="Speak your answer"
          >
            <span>⌁</span>
          </button>
          {!step.options && (
            <div className="input-wrap">
              <input
                type={step.type || 'text'}
                placeholder="Type your answer here…"
                value={touchInput}
                onChange={e => setTouchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onTouchSubmit()}
                autoFocus
              />
              <button onClick={onTouchSubmit} aria-label="Send">↑</button>
            </div>
          )}
          <small>{isListening ? '🔴 Listening…' : 'Tap to speak'}</small>
        </div>
      </div>

      {isListening && liveTranscript && (
        <div style={{
          marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: 14,
          color: '#fca5a5', fontWeight: 500, textAlign: 'center',
        }}>
          "{liveTranscript}"
        </div>
      )}
    </>
  )
}

// ── Sub-view: Consent ─────────────────────────────────────────────────────────
function ConsentView({ isSpeaking, isListening, liveTranscript, form, onConfirm, onMicClick, speakPrompt }) {
  return (
    <>
      <div className="screen-heading">
        <span className="eyebrow">CONSENT</span>
        <h1>Almost <i>there.</i></h1>
        <p>Your information will be processed securely under DPDP Act 2023.</p>
      </div>

      <div className="chat-shell" style={{ marginTop: 24, padding: '24px 28px', height: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: isSpeaking ? 'var(--accent-teal)' : 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            animation: isSpeaking ? 'micPulse 1s ease-in-out infinite' : 'none',
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>
              Aapki awaaz, chehra, aur documents AI se process honge. Kya aap agree karte hain?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 6 }}>
              Your voice, face, and documents will be processed by AI. Do you agree? (DPDP Act 2023 compliant)
            </div>
          </div>
        </div>

        {/* Collected summary */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {form.name && <span className="info-pill">👤 {form.name}</span>}
          {form.age && <span className="info-pill">🎂 {form.age}y</span>}
          {form.gender && <span className="info-pill">⚧ {form.gender}</span>}
          {form.phone && <span className="info-pill">📞 {form.phone}</span>}
          {form.language && <span className="info-pill">🌐 {form.language}</span>}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="primary-action btn-full" style={{ flex: 1 }} onClick={onConfirm}>
            ✅ Haan, agree <span>—</span> Continue
          </button>
          <button className="text-action" style={{ flex: 0.5 }} onClick={() => speakPrompt('Theek hai, aap bina consent ke proceed nahi kar sakte.')}>
            ❌ Nahi
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button
            className={`large-mic${isListening ? ' is-listening' : ''}`}
            onClick={onMicClick}
            style={{ width: 44, height: 44, fontSize: 18 }}
            aria-label="Speak consent answer"
          >
            <span>⌁</span>
          </button>
        </div>
      </div>

      {isListening && liveTranscript && (
        <div style={{
          marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: 14,
          color: '#fca5a5', fontWeight: 500, textAlign: 'center',
        }}>
          "{liveTranscript}"
        </div>
      )}
    </>
  )
}
