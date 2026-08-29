import { useState, useRef, useEffect, useCallback } from 'react'

const FALLBACK_QUESTIONS = [
  { field: 'chief_complaint', system: 'Kya problem ho raha hai aapko? Batao kya hua.', touchOptions: ['Chest pain', 'Headache', 'Stomach pain', 'Fever', 'Back pain', 'Breathing difficulty', 'Other'] },
  { field: 'onset', system: 'Yeh kab se ho raha hai?', touchOptions: ['Today', 'Since yesterday', '2-3 days', '1 week', 'More than a week'] },
  { field: 'character', system: 'Yeh kaisa feel hota hai? Describe karein.', touchOptions: ['Sharp/stabbing', 'Dull/aching', 'Burning', 'Pressure/heaviness', 'Throbbing'] },
  { field: 'radiation', system: 'Kya yeh kisi aur jagah bhi jaata hai?', touchOptions: ['Yes, spreading', 'No, stays in one place', 'Sometimes'] },
  { field: 'associated_symptoms', system: 'Aur kuch symptoms hain? Fever, vomiting, dizziness?', touchOptions: ['Fever', 'Nausea/vomiting', 'Dizziness', 'Breathlessness', 'Sweating', 'None'] },
  { field: 'timing', system: 'Constant hai ya aata jaata hai?', touchOptions: ['Constant', 'Comes and goes', 'Only at certain times', 'Getting worse'] },
  { field: 'exacerbating', system: 'Kya karne pe badhta hai? Aur kya karne pe kam hota hai?', touchOptions: ['Worse with movement', 'Worse with eating', 'Better with rest', 'No change'] },
  { field: 'severity', system: 'Scale of 1-10 pe kitna hai?', touchOptions: ['1-3 (Mild)', '4-6 (Moderate)', '7-8 (Severe)', '9-10 (Very severe)'] },
  { field: 'past_medical', system: 'Koi purani bimari? Diabetes, BP, thyroid?', touchOptions: ['Diabetes', 'Hypertension', 'Heart disease', 'Thyroid', 'Asthma', 'None'] },
  { field: 'medications', system: 'Koi regular medicine chal rahi hai?', touchOptions: ['Yes, for diabetes', 'Yes, for BP', 'Multiple medications', 'No regular meds'] },
  { field: 'allergies', system: 'Koi allergy hai? Medicine ya food se?', touchOptions: ['No allergies', 'Medicine allergy', 'Food allergy', 'Not sure'] },
  { field: 'family_history', system: 'Family mein kisi ko heart problem, diabetes, ya kuch serious?', touchOptions: ['Heart disease', 'Diabetes', 'Cancer', 'No significant history'] },
]

// SOCRATES letters
const SOCRATES = ['S', 'O', 'C', 'R', 'A', 'T', 'E', 'S']
const SOCRATES_LABELS = 'Site · Onset · Character · Radiation · Associated · Timing · Exacerbating · Severity'

export default function ConversationStep({ patient, sessionId, patientId, apiBase, onComplete, onBack }) {
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [langRatio, setLangRatio] = useState({ hindi: 33, english: 33, hinglish: 34 })
  const [styleMode, setStyleMode] = useState('hinglish')
  const [redFlags, setRedFlags] = useState([])
  const [redFlagDismissed, setRedFlagDismissed] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [backendMode, setBackendMode] = useState(!!sessionId)
  const [collectedFields, setCollectedFields] = useState({})
  const [fallbackIndex, setFallbackIndex] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [typedInput, setTypedInput] = useState('')
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(scrollToBottom, [messages])

  const speakText = useCallback(async (text) => {
    const ttsBase = apiBase || 'http://localhost:8080'
    try {
      const res = await fetch(`${ttsBase}/tts?text=${encodeURIComponent(text)}&language=hindi`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.audio_base64) { const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`); audio.play(); return }
      }
    } catch {}
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'hi-IN'; u.rate = 0.9
      window.speechSynthesis.speak(u)
    }
  }, [apiBase])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (backendMode && patient?.greeting) addAIMessage(patient.greeting, patient.touchOptions || [])
      else { const q = FALLBACK_QUESTIONS[0]; addAIMessage(q.system, q.touchOptions) }
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const addAIMessage = (text, touchOptions = []) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, {
        role: 'system', text, touchOptions,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      speakText(text)
    }, 800 + Math.random() * 600)
  }

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
    } catch (err) { console.warn('Backend ACI unavailable:', err.message); setBackendMode(false) }
    return null
  }

  const handlePatientInput = async (text) => {
    setMessages(prev => [...prev, {
      role: 'patient', text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])
    setTypedInput('')

    if (backendMode) {
      setIsTyping(true)
      const result = await sendToBackend(text)
      setIsTyping(false)
      if (result) {
        addAIMessage(result.ai_response, result.touch_options || [])
        if (result.language_ratios) setLangRatio(result.language_ratios)
        if (result.style_mode) setStyleMode(result.style_mode)
        if (result.progress_pct != null) setProgress(result.progress_pct)
        if (result.red_flags?.length > 0) setRedFlags(prev => [...prev, ...result.red_flags.filter(f => !prev.includes(f))])
        if (result.field_collected) setCollectedFields(prev => ({ ...prev, [result.field_collected]: text }))
        if (result.is_complete) setTimeout(() => setIsComplete(true), 2000)
        return
      }
    }

    const currentQ = FALLBACK_QUESTIONS[fallbackIndex]
    if (currentQ) setCollectedFields(prev => ({ ...prev, [currentQ.field]: text }))
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

  const handleMicClick = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop(); setIsListening(false)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'hi-IN'; recognition.interimResults = true; recognition.continuous = true
    recognitionRef.current = recognition; setIsListening(true); setLiveTranscript('')
    let finalTranscript = ''
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += t + ' '; else interim += t
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
      if (text) handlePatientInput(text)
    }
    recognition.start()
  }

  const handleComplete = () => {
    onComplete({ messages, redFlags, styleMode, sessionId, collectedFields, clinicalFields: collectedFields })
  }

  const patientName = patient?.name || 'Patient'
  const totalQs = backendMode ? 12 : FALLBACK_QUESTIONS.length
  const currentQ = Math.round((progress / 100) * totalQs)
  // How many SOCRATES letters done based on progress
  const socratesDone = Math.floor((progress / 100) * 8)

  // Last AI message touch options
  const lastMsg = messages[messages.length - 1]
  const showTouchOptions = lastMsg?.role === 'system' && lastMsg.touchOptions?.length > 0 && !isComplete

  return (
    <>
      <div className="screen-heading split-heading clinical-heading">
        <div>
          <span className="eyebrow">CLINICAL CONVERSATION</span>
          <h1>Tell me what's<br /><i>troubling you.</i></h1>
        </div>
        <div className="socrates-progress">
          <div>
            <b>SOCRATES</b>
            <span className="socrates-pct">{progress}%</span>
          </div>
          <div className="progress-track">
            <i className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <small>{currentQ} of {totalQs} clinical dimensions complete</small>
        </div>
      </div>

      <div className="clinical-grid">
        {/* Chat column */}
        <div className="chat-shell interview-chat">
          <div className="framework-row">
            {SOCRATES.map((l, i) => (
              <span key={l} className={i < socratesDone ? 'done' : ''}>{l}</span>
            ))}
            <em>{SOCRATES_LABELS}</em>
          </div>

          <div className="chat-messages-inner" style={{ flex: 1 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role === 'system' ? 'system' : 'patient-message patient'}`}>
                {msg.role === 'system' && <span className="avatar ai-avatar">A</span>}
                <div>
                  <div className="message-bubble-inner">{msg.text}</div>
                  <time className="message-time">{msg.time}</time>
                  {/* Touch options only for last system message */}
                  {msg.role === 'system' && i === messages.length - 1 && showTouchOptions && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {msg.touchOptions.map((opt, j) => (
                        <button key={j} className="touch-option" onClick={() => handlePatientInput(opt)}>{opt}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="message system">
                <span className="avatar ai-avatar">A</span>
                <div className="message-bubble-inner pending-response">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            {liveTranscript && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 14,
                color: '#fca5a5', fontStyle: 'italic',
              }}>
                "{liveTranscript}"
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Language detection bar */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.015)' }}>
            {['Hindi', 'English', 'Hinglish'].map(lang => {
              const key = lang.toLowerCase()
              const pct = langRatio[key] || 0
              const colors = { hindi: 'var(--accent-amber)', english: 'var(--accent-blue)', hinglish: 'var(--accent-purple)' }
              return (
                <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{lang}</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[key], borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ width: 30, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Clinical aside */}
        <aside className="clinical-side">
          {/* Red flag */}
          {redFlags.length > 0 && !redFlagDismissed && (
            <div className="red-flag">
              <div className="flag-icon">!</div>
              <div>
                <b>Red Flag Alert</b>
                <p>{redFlags[redFlags.length - 1]}</p>
              </div>
              <button onClick={() => setRedFlagDismissed(true)} aria-label="Dismiss alert">×</button>
            </div>
          )}

          {/* Live transcript */}
          <div className="transcript">
            <div className="transcript-title">
              <span>
                <i className="listening-dot" />
                LIVE TRANSCRIPT
              </span>
              <small>{isListening ? 'Listening' : 'Idle'}</small>
            </div>
            <p>
              {liveTranscript
                ? `"${liveTranscript}"`
                : messages.filter(m => m.role === 'patient').length > 0
                  ? `"${messages.filter(m => m.role === 'patient').slice(-1)[0]?.text}…"`
                  : '"Waiting for your response…"'}
            </p>
            <div className="sound-bars">
              {Array.from({ length: 16 }).map((_, i) => (
                <i key={i} style={{ animationPlayState: isListening ? 'running' : 'paused' }} />
              ))}
            </div>
          </div>

          {/* AI note */}
          <div className="clinical-notes">
            <span>AI NOTE</span>
            <p>
              {styleMode === 'formal_hindi' ? 'Responding in Formal Hindi mode.' :
               styleMode === 'english_professional' ? 'Responding in English Professional mode.' :
               'Symptom pattern is being structured for the clinician.'}
            </p>
          </div>
        </aside>
      </div>

      {/* Voice dock */}
      {!isComplete && (
        <div className="voice-dock clinical-dock" style={{ marginTop: 14 }}>
          <button
            className={`large-mic${isListening ? ' is-listening' : ''}`}
            onClick={handleMicClick}
            aria-label={isListening ? 'Stop listening' : 'Speak'}
          >
            <span>⌁</span>
          </button>
          <div className="input-wrap">
            <input
              type="text"
              placeholder="Speak or type your response…"
              value={typedInput}
              onChange={e => setTypedInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && typedInput.trim()) handlePatientInput(typedInput) }}
            />
            <button onClick={() => { if (typedInput.trim()) handlePatientInput(typedInput) }} aria-label="Send">↑</button>
          </div>
          <small>{isListening ? 'Listening… tap mic to pause' : 'Tap to speak'}</small>
        </div>
      )}

      {/* Completion */}
      {isComplete && (
        <div className="action-bar" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          <button className="btn btn-primary btn-lg" onClick={handleComplete}>
            Continue to Records →
          </button>
        </div>
      )}
    </>
  )
}
