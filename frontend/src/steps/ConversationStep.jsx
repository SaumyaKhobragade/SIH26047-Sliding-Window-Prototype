import { useState, useRef, useEffect, useCallback } from 'react'

// ── GENERIC SOCRATES Question Script (fallback when backend is offline) ──
// These are generic — they work for ANY complaint, not just chest pain
const FALLBACK_QUESTIONS = [
  {
    field: 'chief_complaint',
    system: 'Kya problem ho raha hai aapko? Batao kya hua.',
    touchOptions: ['Chest pain', 'Headache', 'Stomach pain', 'Fever', 'Back pain', 'Breathing difficulty', 'Other'],
  },
  {
    field: 'onset',
    system: 'Yeh kab se ho raha hai?',
    touchOptions: ['Today', 'Since yesterday', '2-3 days', '1 week', 'More than a week'],
  },
  {
    field: 'character',
    system: 'Yeh kaisa feel hota hai? Describe karein.',
    touchOptions: ['Sharp/stabbing', 'Dull/aching', 'Burning', 'Pressure/heaviness', 'Throbbing'],
  },
  {
    field: 'radiation',
    system: 'Kya yeh kisi aur jagah bhi jaata hai?',
    touchOptions: ['Yes, spreading', 'No, stays in one place', 'Sometimes'],
  },
  {
    field: 'associated_symptoms',
    system: 'Aur kuch symptoms hain? Fever, vomiting, dizziness?',
    touchOptions: ['Fever', 'Nausea/vomiting', 'Dizziness', 'Breathlessness', 'Sweating', 'None'],
  },
  {
    field: 'timing',
    system: 'Constant hai ya aata jaata hai?',
    touchOptions: ['Constant', 'Comes and goes', 'Only at certain times', 'Getting worse'],
  },
  {
    field: 'exacerbating',
    system: 'Kya karne pe badhta hai? Aur kya karne pe kam hota hai?',
    touchOptions: ['Worse with movement', 'Worse with eating', 'Better with rest', 'No change'],
  },
  {
    field: 'severity',
    system: 'Scale of 1-10 pe kitna hai?',
    touchOptions: ['1-3 (Mild)', '4-6 (Moderate)', '7-8 (Severe)', '9-10 (Very severe)'],
  },
  {
    field: 'past_medical',
    system: 'Koi purani bimari? Diabetes, BP, thyroid?',
    touchOptions: ['Diabetes', 'Hypertension', 'Heart disease', 'Thyroid', 'Asthma', 'None'],
  },
  {
    field: 'medications',
    system: 'Koi regular medicine chal rahi hai?',
    touchOptions: ['Yes, for diabetes', 'Yes, for BP', 'Multiple medications', 'No regular meds'],
  },
  {
    field: 'allergies',
    system: 'Koi allergy hai? Medicine ya food se?',
    touchOptions: ['No allergies', 'Medicine allergy', 'Food allergy', 'Not sure'],
  },
  {
    field: 'family_history',
    system: 'Family mein kisi ko heart problem, diabetes, ya kuch serious?',
    touchOptions: ['Heart disease', 'Diabetes', 'Cancer', 'No significant history'],
  },
]

export default function ConversationStep({ patient, sessionId, patientId, apiBase, onComplete, onBack }) {
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [langRatio, setLangRatio] = useState({ hindi: 33, english: 33, hinglish: 34 })
  const [styleMode, setStyleMode] = useState('hinglish')
  const [redFlags, setRedFlags] = useState([])
  const [isComplete, setIsComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [backendMode, setBackendMode] = useState(!!sessionId)
  const [collectedFields, setCollectedFields] = useState({})
  const [fallbackIndex, setFallbackIndex] = useState(0) // tracks which question we're on in fallback mode
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  // ── TTS ──
  const speakText = useCallback(async (text) => {
    const ttsBase = apiBase || 'http://localhost:8080'
    try {
      const res = await fetch(`${ttsBase}/tts?text=${encodeURIComponent(text)}&language=hindi`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`)
          audio.play()
          return
        }
      }
    } catch {}
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'hi-IN'; u.rate = 0.9
      window.speechSynthesis.speak(u)
    }
  }, [apiBase])

  // ── Start: show first AI question ──
  useEffect(() => {
    const timer = setTimeout(() => {
      if (backendMode && patient?.greeting) {
        addAIMessage(patient.greeting, patient.touchOptions || [])
      } else {
        // Fallback: show first SOCRATES question
        const q = FALLBACK_QUESTIONS[0]
        addAIMessage(q.system, q.touchOptions)
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  // ── Add an AI message to the chat ──
  const addAIMessage = (text, touchOptions = []) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, {
        role: 'system',
        text,
        touchOptions,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      speakText(text)
    }, 800 + Math.random() * 600)
  }

  // ── Send patient text to backend ACI ──
  const sendToBackend = async (text) => {
    if (!backendMode || !sessionId) return null
    try {
      const base = apiBase || 'http://localhost:8080'
      const res = await fetch(`${base}/aci/converse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, patient_text: text }),
      })
      if (res.ok) return await res.json()
    } catch (err) {
      console.warn('Backend ACI unavailable:', err.message)
      setBackendMode(false)
    }
    return null
  }

  // ── Handle patient input (from touch option, mic, or typed) ──
  const handlePatientInput = async (text) => {
    // 1. Show patient message immediately
    setMessages(prev => [...prev, {
      role: 'patient',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])

    // 2. Try backend first
    if (backendMode) {
      setIsTyping(true)
      const result = await sendToBackend(text)
      setIsTyping(false)

      if (result) {
        // Backend gave us a real response — use it
        addAIMessage(result.ai_response, result.touch_options || [])

        if (result.language_ratios) setLangRatio(result.language_ratios)
        if (result.style_mode) setStyleMode(result.style_mode)
        if (result.progress_pct != null) setProgress(result.progress_pct)
        if (result.red_flags?.length > 0) {
          setRedFlags(prev => [...prev, ...result.red_flags.filter(f => !prev.includes(f))])
        }
        if (result.field_collected) {
          setCollectedFields(prev => ({ ...prev, [result.field_collected]: text }))
        }
        if (result.is_complete) {
          setTimeout(() => setIsComplete(true), 2000)
        }
        return
      }
    }

    // 3. Fallback: use generic SOCRATES script
    // Store the patient's ACTUAL answer
    const currentQ = FALLBACK_QUESTIONS[fallbackIndex]
    if (currentQ) {
      setCollectedFields(prev => ({ ...prev, [currentQ.field]: text }))
    }

    const nextIdx = fallbackIndex + 1
    setFallbackIndex(nextIdx)
    setProgress(Math.round((nextIdx / FALLBACK_QUESTIONS.length) * 100))

    if (nextIdx >= FALLBACK_QUESTIONS.length) {
      addAIMessage('Thank you! Sab information mil gayi. Summary generate ho raha hai.', [])
      setTimeout(() => setIsComplete(true), 2000)
    } else {
      const nextQ = FALLBACK_QUESTIONS[nextIdx]
      addAIMessage(nextQ.system, nextQ.touchOptions)
    }
  }

  // ── Mic: real speech recognition with continuous listening ──
  const [liveTranscript, setLiveTranscript] = useState('')
  const silenceTimerRef = useRef(null)

  const handleMicClick = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      return
    }

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

      // Auto-stop after 2.5s silence
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
      if (text) handlePatientInput(text)
    }

    recognition.start()
  }

  // ── Complete conversation ──
  const handleComplete = () => {
    onComplete({
      messages,
      redFlags,
      styleMode,
      sessionId,
      collectedFields,
      clinicalFields: collectedFields,
    })
  }

  // ── RENDER ──
  const patientName = patient?.name || 'Patient'
  const totalQs = backendMode ? 12 : FALLBACK_QUESTIONS.length
  const currentQ = Math.round((progress / 100) * totalQs)

  return (
    <div className="glass-card" style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 4 }}>
            🩺 Voice Clinical Interview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Speaking with <strong>{patientName}</strong> • Question {currentQ} of {totalQs}
          </p>
        </div>
        <div style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-full)', padding: '6px 14px',
          fontSize: 12, fontWeight: 600, color: 'var(--accent-teal)',
        }}>
          🌐 {styleMode === 'formal_hindi' ? 'Formal Hindi' :
               styleMode === 'english_professional' ? 'English Professional' :
               'Hinglish Casual'}
        </div>
      </div>

      {/* Language Detection */}
      <div style={{
        background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
          Live Language Detection
        </div>
        {['Hindi', 'English', 'Hinglish'].map(lang => {
          const key = lang.toLowerCase()
          const pct = langRatio[key] || 0
          const colors = { hindi: '#f59e0b', english: '#3b82f6', hinglish: '#8b5cf6' }
          return (
            <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ width: 60, fontSize: 12, fontWeight: 500 }}>{lang}</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: colors[key], borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ width: 40, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{pct}%</span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))',
          transition: 'width 0.6s ease', borderRadius: 2,
        }} />
      </div>

      {/* Red Flag Alert */}
      {redFlags.length > 0 && (
        <div className="red-flag-alert" style={{ marginBottom: 16 }}>
          <span className="red-flag-icon">🚨</span>
          <div className="red-flag-content">
            <h3>Red Flag Detected</h3>
            <p>{redFlags[redFlags.length - 1]}</p>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role === 'system' ? 'system' : 'patient'}`}>
              <div className="message-avatar">
                {msg.role === 'system' ? '🤖' : '🧑'}
              </div>
              <div>
                <div className="message-bubble">{msg.text}</div>
                <div className="message-meta">{msg.time}</div>
                {/* Touch options only for the LAST system message */}
                {msg.role === 'system' && msg.touchOptions?.length > 0 && i === messages.length - 1 && !isComplete && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {msg.touchOptions.map((opt, j) => (
                      <button key={j} className="touch-option" onClick={() => handlePatientInput(opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="message system">
              <div className="message-avatar">🤖</div>
              <div className="message-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {!isComplete && (
          <div className="chat-input-area" style={{ flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              className="mic-btn"
              onClick={handleMicClick}
              title={isListening ? 'Tap to stop' : 'Tap to speak'}
              style={{
                background: isListening ? 'linear-gradient(135deg, #ef4444, #f97316)' : undefined,
                boxShadow: isListening ? '0 0 24px rgba(239,68,68,0.5)' : undefined,
                animation: isListening ? 'pulse 1s ease-in-out infinite' : undefined,
              }}
            >
              {isListening ? '⏹' : '🎙️'}
            </button>
            {isListening && liveTranscript && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: 15,
                color: '#fca5a5', fontWeight: 500, maxWidth: '90%', textAlign: 'center',
              }}>
                "{liveTranscript}"
              </div>
            )}
            <span style={{
              fontSize: 13,
              color: isListening ? 'var(--accent-red)' : 'var(--text-muted)',
              fontWeight: isListening ? 600 : 400,
            }}>
              {isListening ? '🔴 Listening... tap mic to stop' : 'Tap mic to speak or use touch options above'}
            </span>
          </div>
        )}
      </div>

      {/* Completion */}
      {isComplete && (
        <div className="action-bar" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          <button className="btn btn-primary btn-lg" onClick={handleComplete}>
            Continue to Prescription Scan →
          </button>
        </div>
      )}
    </div>
  )
}
