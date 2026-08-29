import { useState, useRef, useEffect, useCallback } from 'react'

// There is deliberately NO offline question script here. This step used to carry
// its own 13-question Hinglish list and run the whole interview locally whenever
// the backend was unreachable: the answers were never normalized into the strict
// clinical English layer, no red flags were evaluated, nothing was persisted, and
// no doctor's report could be produced — but the screen looked identical to a
// working interview, right down to the progress bar reaching 100%. Without a
// clinical session this step now says so and offers a retry.

// SOCRATES letters
const SOCRATES = ['S', 'O', 'C', 'R', 'A', 'T', 'E', 'S']
const SOCRATES_LABELS = 'Site · Onset · Character · Radiation · Associated · Timing · Exacerbating · Severity'

const STYLE_LABEL = {
  formal_hindi: 'Formal Hindi',
  hinglish_casual: 'Hinglish (casual)',
  english_professional: 'English (professional)',
}

export default function ConversationStep({ patient, sessionId, apiBase, onComplete, onBack, onRetryConnection }) {
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [langRatio, setLangRatio] = useState({ hindi: 33, english: 33, hinglish: 34 })
  const [styleMode, setStyleMode] = useState(patient?.styleMode || 'hinglish_casual')
  const [redFlags, setRedFlags] = useState([])
  const [redFlagDismissed, setRedFlagDismissed] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [progress, setProgress] = useState(0)
  const [collectedFields, setCollectedFields] = useState({})
  const [rawAnswers, setRawAnswers] = useState({})
  const [isListening, setIsListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [typedInput, setTypedInput] = useState('')
  const [answered, setAnswered] = useState(0)
  const [retrying, setRetrying] = useState(false)
  // The kiosk used to hardcode 12 while the engine asked 13, so the counter read
  // "13 of 12 complete". The engine is the only source of this number now.
  const [totalQs, setTotalQs] = useState(patient?.totalQuestions || 0)
  const [connectionError, setConnectionError] = useState('')
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  // Speech callbacks are created once per mic press; without refs they read the
  // state values captured at that moment (always the initial ones).
  const liveTranscriptRef = useRef('')
  const handleInputRef = useRef(null)
  const styleModeRef = useRef(styleMode)
  const lastQuestionRef = useRef(null)
  const greetedRef = useRef(false)
  const currentAudioRef = useRef(null)

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  useEffect(() => { scrollToBottom() }, [messages])
  useEffect(() => { styleModeRef.current = styleMode }, [styleMode])

  // Speak in the style the engine actually selected. This was pinned to
  // `language=hindi`, so an English-speaking patient heard Hindi TTS.
  const speakText = useCallback(async (text, style) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    const ttsBase = apiBase || 'http://localhost:8080'
    const lang = style || styleModeRef.current || 'hinglish_casual'
    try {
      const res = await fetch(
        `${ttsBase}/tts?text=${encodeURIComponent(text)}&language=${encodeURIComponent(lang)}`,
        { method: 'POST' }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
          currentAudioRef.current = audio;
          audio.play();
          return
        }
      }
    } catch {}
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang === 'english_professional' ? 'en-IN' : 'hi-IN'
      u.rate = 0.9
      window.speechSynthesis.speak(u)
    }
  }, [apiBase])

  const addAIMessage = useCallback((text, touchOptions = [], style) => {
    lastQuestionRef.current = { text, touchOptions, style }
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, {
        role: 'system', text, touchOptions,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
      speakText(text, style)
    }, 800 + Math.random() * 600)
  }, [speakText])

  // Greet only once a real session exists — and only once, so a retry that
  // succeeds does not replay the greeting on top of an interview in progress.
  // The flag is set when the message is actually added, NOT when the timer is
  // scheduled: `patient` gets a new object identity on every setPatientData, and
  // StrictMode re-runs mount effects, so a flag set up-front let the cleanup
  // cancel the pending greeting while the re-run bailed out — no greeting at all.
  useEffect(() => {
    if (!sessionId || !patient?.greeting || greetedRef.current) return
    const timer = setTimeout(() => {
      greetedRef.current = true
      addAIMessage(patient.greeting, patient.touchOptions || [], patient.styleMode)
      if (patient.totalQuestions) setTotalQs(patient.totalQuestions)
    }, 800)
    return () => clearTimeout(timer)
  }, [sessionId, patient, addAIMessage])

  const sendToBackend = async (text) => {
    const base = apiBase || 'http://localhost:8080'
    const res = await fetch(`${base}/aci/converse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, patient_text: text }),
    })
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    return await res.json()
  }

  const handlePatientInput = async (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed || !sessionId) return
    setMessages(prev => [...prev, {
      role: 'patient', text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])
    setTypedInput('')
    setConnectionError('')

    setIsTyping(true)
    let result = null
    try {
      result = await sendToBackend(trimmed)
    } catch (err) {
      setIsTyping(false)
      // Falling through to an offline script here restarted the interview at
      // question 1 and silently discarded everything already collected.
      // Surface the failure and let the patient re-send instead.
      setConnectionError(`Connection problem: ${err.message}. Tap send again to retry.`)
      return
    }
    setIsTyping(false)

    if (result.language_ratios) setLangRatio(result.language_ratios)
    if (result.style_mode) setStyleMode(result.style_mode)
    if (result.progress_pct != null) setProgress(result.progress_pct)
    if (result.total_questions) setTotalQs(result.total_questions)
    if (result.questions_answered != null) setAnswered(result.questions_answered)
    if (result.red_flags?.length > 0) {
      setRedFlags(prev => [...prev, ...result.red_flags.filter(f => !prev.includes(f))])
    }
    // `field_collected` is the field of the NEXT question. Storing the answer
    // under it shifted every answer one field forward — the chief complaint
    // landed in `onset`, and the last answer was dropped entirely.
    const storedField = result.field_stored || result.field_collected
    if (storedField) {
      setRawAnswers(prev => ({ ...prev, [storedField]: trimmed }))
      setCollectedFields(prev => ({
        ...prev,
        [storedField]: result.normalized_value || trimmed,
      }))
    }
    // Show what went into the record — the strict English clinical layer.
    if (result.normalized_value && result.normalized_value !== trimmed) {
      setMessages(prev => {
        const next = [...prev]
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'patient') { next[i] = { ...next[i], recordedAs: result.normalized_value }; break }
        }
        return next
      })
    }
    addAIMessage(result.ai_response, result.touch_options || [], result.style_mode)
    if (result.is_complete) setTimeout(() => setIsComplete(true), 2000)
  }

  // Keep the ref pointing at the latest handler so speech callbacks never fire a
  // version of it that closed over a stale sessionId.
  useEffect(() => { handleInputRef.current = handlePatientInput; })
  useEffect(() => { liveTranscriptRef.current = liveTranscript; }, [liveTranscript])

  const handleMicClick = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop(); setIsListening(false)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setConnectionError('Voice input is not supported in this browser. Please type your answer.')
      return
    }
    const recognition = new SpeechRecognition()
    // Follow the patient's own style rather than always assuming Hindi.
    recognition.lang = styleModeRef.current === 'english_professional' ? 'en-IN' : 'hi-IN'
    recognition.interimResults = true; recognition.continuous = true
    recognitionRef.current = recognition; setIsListening(true)
    setLiveTranscript(''); liveTranscriptRef.current = ''
    let finalTranscript = ''
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += t + ' '; else interim += t
      }
      const combined = (finalTranscript + interim).trim()
      setLiveTranscript(combined)
      liveTranscriptRef.current = combined
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => recognition.stop(), 2500)
    }
    recognition.onerror = () => { setIsListening(false); setLiveTranscript(''); liveTranscriptRef.current = '' }
    recognition.onend = () => {
      setIsListening(false)
      // liveTranscriptRef, not the captured state: interim-only speech (common
      // for short answers like "haan") produced an empty finalTranscript and the
      // whole answer was silently dropped.
      const text = (finalTranscript || liveTranscriptRef.current || '').trim()
      setLiveTranscript(''); liveTranscriptRef.current = ''
      if (text) handleInputRef.current?.(text)
    }
    recognition.start()
  }

  const handleComplete = () => {
    onComplete({
      messages, redFlags, styleMode, sessionId, collectedFields, rawAnswers,
      clinicalFields: collectedFields,
      questionsAnswered: answered, totalQuestions: totalQs,
      interviewComplete: totalQs > 0 && answered >= totalQs,
    })
  }

  const handleRetry = async () => {
    if (retrying || !onRetryConnection) return
    setRetrying(true)
    setConnectionError('')
    try {
      await onRetryConnection()
    } catch (err) {
      setConnectionError(`Still unreachable: ${err.message}`)
    } finally {
      setRetrying(false)
    }
  }

  // No session means the ACI engine never started: there is nothing to ask, no
  // way to normalize an answer into the clinical record, and no report to build.
  // Running a local script here would look like a working interview and produce
  // nothing the doctor can use, so the step stops here instead.
  if (!sessionId) {
    return (
      <>
        <div className="screen-heading compact-heading">
          <span className="eyebrow">CLINICAL CONVERSATION</span>
          <h1>The interview can't<br /><i>start right now.</i></h1>
        </div>

        <div className="upload-panel" style={{ cursor: 'default', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>⚠</div>
          <h3>Clinical service<br />unreachable</h3>
          <p style={{ maxWidth: 460, margin: '0 auto' }}>
            Your answers are turned into the doctor's record by the clinical
            service, which this kiosk can't reach. Nothing you say now could be
            saved or passed on, so the interview is paused rather than run
            without it.
          </p>
          {connectionError && (
            <div role="alert" style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 12,
              color: '#fca5a5', marginTop: 14, maxWidth: 460,
            }}>
              {connectionError}
            </div>
          )}
          <small style={{ marginTop: 14 }}>
            Please tell the front desk if this keeps happening.
          </small>
        </div>

        <div className="action-bar">
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          {onRetryConnection && (
            <button className="btn btn-primary btn-lg" onClick={handleRetry} disabled={retrying}>
              {retrying ? 'Reconnecting…' : 'Try again'}
            </button>
          )}
        </div>
      </>
    )
  }

  const currentQ = answered || Math.round((progress / 100) * totalQs)
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
                  {/* The strict clinical layer: what actually entered the record */}
                  {msg.recordedAs && (
                    <div style={{
                      fontSize: 11, color: 'var(--accent-teal)', marginTop: 4,
                      fontFamily: 'monospace', opacity: 0.85,
                    }}>
                      → recorded as: {msg.recordedAs}
                    </div>
                  )}
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

            {connectionError && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13,
                color: '#fca5a5',
              }}>
                {connectionError}
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
            <span>AI NOTE · {STYLE_LABEL[styleMode] || styleMode}</span>
            <p>
              {styleMode === 'formal_hindi' ? 'Responding in Formal Hindi. Record is kept in clinical English.' :
               styleMode === 'english_professional' ? 'Responding in professional English.' :
               'Matching your Hinglish. Record is kept in clinical English.'}
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
