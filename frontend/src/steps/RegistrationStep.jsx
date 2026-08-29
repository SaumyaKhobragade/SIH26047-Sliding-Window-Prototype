import { useState, useRef, useEffect, useCallback } from 'react'
import { Link2, Check, Sparkles, CornerDownLeft, User, Cake, VenusAndMars, Phone, Mic, Globe, ScanFace, AlertTriangle } from 'lucide-react'

// Three prompt variants per question — one per style mode the kiosk supports.
// The patient's chosen language now decides which one is shown AND spoken; the
// whole step used to speak Hinglish at `language=hindi` no matter what was picked.
const REGISTRATION_STEPS = [
  {
    id: 'name', field: 'name', type: 'text',
    promptHi: 'अपना पूरा नाम बताइए।',
    prompt: 'Aapka poora naam bataiye.',
    promptEn: 'Please tell me your full name.',
  },
  {
    id: 'age', field: 'age', type: 'number',
    promptHi: 'आपकी उम्र कितनी है?',
    prompt: 'Aapki umar kitni hai?',
    promptEn: 'What is your age?',
  },
  {
    id: 'gender', field: 'gender', options: ['Male', 'Female', 'Other'],
    promptHi: 'आप पुरुष हैं, महिला, या अन्य?',
    prompt: 'Aap male hain, female, ya other?',
    promptEn: 'Are you male, female, or other?',
  },
  {
    id: 'phone', field: 'phone', type: 'tel',
    promptHi: 'अपना फ़ोन नंबर बताइए।',
    prompt: 'Aapka phone number bataiye.',
    promptEn: 'What is your phone number?',
  },
  {
    id: 'language', field: 'language', options: ['Hinglish', 'Hindi', 'English'],
    promptHi: 'आप हिंदी में बात करना चाहेंगे, इंग्लिश में, या हिंग्लिश में?',
    prompt: 'Aap Hindi mein baat karna chahenge, English mein, ya Hinglish mein?',
    promptEn: 'Would you like to speak in Hindi, English, or Hinglish?',
  },
]

// The scan-screen toggle used to write to its own `selectedLanguage` state that
// nothing ever read, so picking English still registered the patient as Hinglish
// and every downstream prompt, TTS voice and ACI style started in Hindi.
const LANGUAGE_CHOICES = [
  { label: 'हिंदी', value: 'hindi' },
  { label: 'English', value: 'english' },
  { label: 'Hinglish', value: 'hinglish' },
]

const GREETING = {
  returning: {
    hindi: (n, v) => `नमस्ते ${n}! आपको पहचान लिया। आपके ${v} पुराने विज़िट हैं। क्या आपकी जानकारी सही है?`,
    hinglish: (n, v) => `Namaste ${n}! Aapko pehchaan liya. Aapke ${v} purane visits hain. Kya aapki details sahi hain?`,
    english: (n, v) => `Hello ${n}! We have recognised you. You have ${v} previous visits on record. Are these details correct?`,
  },
  newPatient: {
    hindi: 'नमस्ते! आप नए मरीज़ लगते हैं। चलिए रजिस्ट्रेशन शुरू करते हैं। अपना पूरा नाम बताइए।',
    hinglish: 'Namaste! Aap naye patient lagte hain. Chaliye registration shuru karte hain. Aapka poora naam bataiye.',
    english: 'Welcome! You appear to be a new patient. Let us begin registration. Please tell me your full name.',
  },
  noCamera: {
    hindi: 'कैमरा उपलब्ध नहीं है। चलिए रजिस्ट्रेशन शुरू करते हैं। अपना पूरा नाम बताइए।',
    hinglish: 'Camera not available. Chaliye registration shuru karte hain. Aapka poora naam bataiye.',
    english: 'The camera is not available. Let us begin registration. Please tell me your full name.',
  },
  consent: {
    hindi: 'आपकी आवाज़, चेहरा और दस्तावेज़ AI द्वारा प्रोसेस किए जाएंगे। क्या आप सहमत हैं?',
    hinglish: 'Aapki awaaz, chehra, aur documents AI se process honge. Kya aap agree karte hain?',
    english: 'Your voice, face and documents will be processed by AI. Do you agree?',
  },
  whatToChange: {
    hindi: 'क्या बदलना है? नाम, उम्र, या फ़ोन नंबर?',
    hinglish: 'Kya change karna hai? Naam, umar, ya phone number?',
    english: 'What would you like to change? Name, age, or phone number?',
  },
  updated: {
    hindi: 'अपडेट हो गया! क्या अब सब सही है?',
    hinglish: 'Updated! Kya ab sab sahi hai?',
    english: 'Updated. Is everything correct now?',
  },
  noConsent: {
    hindi: 'ठीक है, बिना सहमति के आगे नहीं बढ़ा जा सकता।',
    hinglish: 'Theek hai, aap bina consent ke proceed nahi kar sakte.',
    english: 'That is alright — we cannot proceed without your consent.',
  },
}

const EDIT_PROMPT = {
  name: { hindi: 'अपना सही नाम बताइए।', hinglish: 'Apna sahi naam bataiye.', english: 'Please say your correct name.' },
  age: { hindi: 'अपनी सही उम्र बताइए।', hinglish: 'Apni sahi umar bataiye.', english: 'Please say your correct age.' },
  phone: { hindi: 'अपना सही फ़ोन नंबर बताइए।', hinglish: 'Apna sahi phone number bataiye.', english: 'Please say your correct phone number.' },
}

// hi-IN speech recognition returns Devanagari, so the old ASCII-only keyword
// checks ("haan", "nahi") never matched a Hindi speaker and the voice confirm
// path silently did nothing. Both scripts are accepted now.
const YES_WORDS = ['haan', 'han', 'yes', 'sahi', 'correct', 'theek', 'thik', 'ok', 'हाँ', 'हां', 'सही', 'ठीक', 'बिलकुल']
const NO_WORDS = ['nahi', 'nahin', 'no', 'change', 'galat', 'badal', 'नहीं', 'नही', 'गलत', 'बदल']
const NAME_WORDS = ['naam', 'name', 'नाम']
const AGE_WORDS = ['umar', 'age', 'उम्र', 'आयु']
const PHONE_WORDS = ['phone', 'number', 'mobile', 'फ़ोन', 'फोन', 'नंबर', 'मोबाइल']
const FEMALE_WORDS = ['female', 'mahila', 'aurat', 'woman', 'girl', 'महिला', 'औरत', 'स्त्री', 'लड़की', 'फीमेल', 'वुमन', 'गर्ल']
const MALE_WORDS = ['male', 'mail', 'purush', 'aadmi', 'man', 'boy', 'पुरुष', 'आदमी', 'मर्द', 'लड़का', 'मेल', 'मैन', 'बॉय']

const DEV_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' }
const digitsOnly = (s) => (s || '').replace(/[०-९]/g, d => DEV_DIGITS[d]).replace(/\D/g, '')
const hasAny = (text, words) => words.some(w => text.includes(w))

const promptFor = (step, lang) => {
  if (!step) return ''
  if (lang === 'english') return step.promptEn
  if (lang === 'hindi') return step.promptHi || step.prompt
  return step.prompt
}

const API = 'http://localhost:8080'

export default function RegistrationStep({ onComplete, onFlowStateChange }) {
  const [flowState, setFlowState] = useState('scanning') // scanning | returning | new_reg | consent
  const [form, setForm] = useState({
    name: '', age: '', gender: '', phone: '', abhaId: '', language: 'hinglish',
  })
  const [currentStep, setCurrentStep] = useState(0)
  const [faceState, setFaceState] = useState('idle') // idle | capturing | captured | unavailable
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [touchInput, setTouchInput] = useState('')
  const [returningPatient, setReturningPatient] = useState(null)
  const [editField, setEditField] = useState(null)
  const [facePreview, setFacePreview] = useState(null)
  const [inputError, setInputError] = useState('')
  const [voiceUnavailable, setVoiceUnavailable] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const captureTimerRef = useRef(null)
  const hasCapturedRef = useRef(false)
  // The captured frame has to be kept outside the DOM: the <canvas> lives in the
  // scanning view, which unmounts the moment the flow advances. confirmAndProceed
  // read canvasRef.current at the very end of the flow, found null, and every new
  // patient was registered with NO face image — so nobody could ever be matched.
  const faceBlobRef = useRef(null)

  const step = flowState === 'new_reg' ? REGISTRATION_STEPS[currentStep] : null
  const language = form.language

  // Callbacks handed to SpeechRecognition capture state at creation time, so the
  // language, flow state and edit target are mirrored into refs.
  const languageRef = useRef(language)
  useEffect(() => { languageRef.current = language }, [language])

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

  // Function declaration (not a const arrow) so the mount effect above can call
  // it without reading a binding that is still initializing.
  async function startCamera() {
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
      // 'captured' here used to light up the "Captured" badge with no frame behind it.
      setFaceState('unavailable')
      if (!hasCapturedRef.current) {
        hasCapturedRef.current = true
        speakPrompt(GREETING.noCamera[languageRef.current] || GREETING.noCamera.hinglish)
        setFlowState('new_reg')
      }
    }
  }

  const captureAndIdentify = async () => {
    if (hasCapturedRef.current) return
    hasCapturedRef.current = true

    let blob = null
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      canvasRef.current.width = 640
      canvasRef.current.height = 480
      ctx.drawImage(videoRef.current, 0, 0, 640, 480)
      blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.8))
      if (blob) {
        faceBlobRef.current = blob
        setFacePreview(canvasRef.current.toDataURL('image/jpeg', 0.8))
      }
    }
    setFaceState(blob ? 'captured' : 'unavailable')

    const lang = languageRef.current
    if (blob) {
      try {
        const formData = new FormData()
        formData.append('face_image', blob, 'face.jpg')

        const res = await fetch(`${API}/patient/identify`, { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          if (data.matched && data.patient_id) {
            const name = data.patient_name || 'Patient'
            const visits = data.past_visit_count || 0
            setReturningPatient({
              patientId: data.patient_id,
              name,
              confidence: data.confidence,
              pastVisitCount: visits,
            })
            speakPrompt((GREETING.returning[lang] || GREETING.returning.hinglish)(
              data.patient_name || '', visits))
            setFlowState('returning')
            setForm(prev => ({ ...prev, name: data.patient_name || prev.name }))
            return
          }
        }
      } catch (err) {
        console.warn('Face identify failed:', err.message)
      }
    }

    speakPrompt(GREETING.newPatient[lang] || GREETING.newPatient.hinglish)
    setFlowState('new_reg')
  }

  const currentAudioRef = useRef(null)

  // `language` was pinned to "hindi" here, so an English-speaking patient was read
  // Hindi prompts in a Hindi voice. The backend accepts hindi | hinglish | english.
  const speakPrompt = async (text, langOverride) => {
    const lang = langOverride || languageRef.current || 'hinglish'
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }
    setIsSpeaking(true)
    try {
      const res = await fetch(
        `${API}/tts?text=${encodeURIComponent(text)}&language=${encodeURIComponent(lang)}`,
        { method: 'POST' }
      )
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
      u.lang = lang === 'english' ? 'en-IN' : 'hi-IN'
      u.rate = 0.9
      u.onend = () => setIsSpeaking(false)
      u.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(u)
    } else { setIsSpeaking(false) }
  }

  const prevStepRef = useRef(-1)
  useEffect(() => {
    if (flowState === 'new_reg' && step && currentStep > 0 && currentStep !== prevStepRef.current) {
      prevStepRef.current = currentStep
      speakPrompt(promptFor(step, language))
    }
  }, [currentStep, flowState])

  const [liveTranscript, setLiveTranscript] = useState('')
  const liveTranscriptRef = useRef('')
  const silenceTimerRef = useRef(null)

  const setTranscript = (t) => { liveTranscriptRef.current = t; setLiveTranscript(t) }

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop()
    setIsListening(false)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
  }, [])

  // ── Voice routing ────────────────────────────────────────────────────────────

  const handleReturningVoice = (transcript) => {
    const lower = transcript.toLowerCase()
    // The 'choosing' branch has to be tested FIRST: "naam sahi karna hai" contains
    // "sahi", so the old ordering confirmed the record and started the interview
    // when the patient was trying to correct their name.
    if (editField === 'choosing') {
      if (hasAny(lower, NAME_WORDS)) { setEditField('name'); speakPrompt(EDIT_PROMPT.name[language] || EDIT_PROMPT.name.hinglish) }
      else if (hasAny(lower, AGE_WORDS)) { setEditField('age'); speakPrompt(EDIT_PROMPT.age[language] || EDIT_PROMPT.age.hinglish) }
      else if (hasAny(lower, PHONE_WORDS)) { setEditField('phone'); speakPrompt(EDIT_PROMPT.phone[language] || EDIT_PROMPT.phone.hinglish) }
      else speakPrompt(GREETING.whatToChange[language] || GREETING.whatToChange.hinglish)
      return
    }
    if (hasAny(lower, NO_WORDS)) {
      speakPrompt(GREETING.whatToChange[language] || GREETING.whatToChange.hinglish)
      setEditField('choosing')
    } else if (hasAny(lower, YES_WORDS)) {
      confirmAndProceed()
    }
  }

  const handleEditVoice = (transcript) => {
    if (editField === 'name') setForm(f => ({ ...f, name: transcript.trim() }))
    else if (editField === 'age') {
      const num = digitsOnly(transcript)
      if (!num || Number(num) < 1 || Number(num) > 120) {
        setInputError('Could not read a valid age. Please type it.')
        return
      }
      setForm(f => ({ ...f, age: num }))
    } else if (editField === 'phone') {
      const num = digitsOnly(transcript)
      if (num.length < 10) {
        setInputError('Could not read a full phone number. Please type it.')
        return
      }
      setForm(f => ({ ...f, phone: num }))
    }
    setInputError('')
    setEditField(null)
    speakPrompt(GREETING.updated[language] || GREETING.updated.hinglish)
  }

  // Typed correction on the returning-patient card. Same validation as the voice
  // path, so a typo cannot write "fifty" into the age field.
  const applyEdit = () => {
    const value = touchInput.trim()
    if (!value || !editField || editField === 'choosing') return
    if (editField === 'age') {
      const num = digitsOnly(value)
      if (!num || Number(num) < 1 || Number(num) > 120) {
        setInputError('Please enter an age between 1 and 120.')
        return
      }
      setForm(f => ({ ...f, age: num }))
    } else if (editField === 'phone') {
      const num = digitsOnly(value)
      if (num.length < 10) {
        setInputError('Please enter a 10-digit phone number.')
        return
      }
      setForm(f => ({ ...f, phone: num }))
    } else {
      setForm(f => ({ ...f, [editField]: value }))
    }
    setInputError('')
    setTouchInput('')
    setEditField(null)
    speakPrompt(GREETING.updated[language] || GREETING.updated.hinglish)
  }

  const handleNewRegVoice = (transcript) => {
    if (!step) return
    setInputError('')
    if (step.field === 'gender') {
      const l = transcript.toLowerCase()
      if (hasAny(l, FEMALE_WORDS)) setForm(f => ({ ...f, gender: 'female' }))
      else if (hasAny(l, MALE_WORDS)) setForm(f => ({ ...f, gender: 'male' }))
      else setForm(f => ({ ...f, gender: 'other' }))
      advanceReg()
    } else if (step.field === 'language') {
      const l = transcript.toLowerCase()
      if (l.includes('hinglish') || l.includes('हिंग्लिश')) setForm(f => ({ ...f, language: 'hinglish' }))
      else if (l.includes('hindi') || l.includes('हिंदी') || l.includes('हिन्दी')) setForm(f => ({ ...f, language: 'hindi' }))
      else if (l.includes('english') || l.includes('अंग्रेज़ी') || l.includes('अंग्रेजी') || l.includes('इंग्लिश')) setForm(f => ({ ...f, language: 'english' }))
      else setForm(f => ({ ...f, language: 'hinglish' }))
      advanceReg()
    } else if (step.field === 'age') {
      const num = digitsOnly(transcript)
      if (!num || Number(num) < 1 || Number(num) > 120) {
        setInputError('Could not hear a valid age — please type it, or say the number again.')
        return
      }
      setForm(f => ({ ...f, age: num }))
      advanceReg()
    } else if (step.field === 'phone') {
      const num = digitsOnly(transcript)
      if (num.length < 10) {
        setInputError('That did not sound like a complete phone number — please type it.')
        return
      }
      setForm(f => ({ ...f, phone: num }))
      advanceReg()
    } else if (step.field) {
      if (!transcript.trim()) return
      setForm(f => ({ ...f, [step.field]: transcript.trim() }))
      advanceReg()
    }
  }

  // Single routing entry point, mirrored into a ref so SpeechRecognition callbacks
  // always dispatch on the CURRENT flow state instead of the state that existed
  // when the microphone was opened.
  const routeVoice = (text) => {
    if (flowState === 'returning') {
      if (editField && editField !== 'choosing') handleEditVoice(text)
      else handleReturningVoice(text)
    } else if (flowState === 'consent') {
      const lower = text.toLowerCase()
      if (hasAny(lower, YES_WORDS)) confirmAndProceed()
      else if (hasAny(lower, NO_WORDS)) speakPrompt(GREETING.noConsent[language] || GREETING.noConsent.hinglish)
    } else {
      handleNewRegVoice(text)
    }
  }
  const routeVoiceRef = useRef(routeVoice)
  useEffect(() => { routeVoiceRef.current = routeVoice })

  const startListening = useCallback(() => {
    if (isListening) { stopListening(); return }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      // Failing silently left the patient tapping a dead microphone.
      setVoiceUnavailable(true)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = languageRef.current === 'english' ? 'en-IN' : 'hi-IN'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    setIsListening(true)
    setTranscript('')
    let finalTranscript = ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += t + ' '
        else interim += t
      }
      setTranscript((finalTranscript + interim).trim())
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => recognition.stop(), 2500)
    }

    recognition.onerror = () => { setIsListening(false); setTranscript('') }
    recognition.onend = () => {
      setIsListening(false)
      // Short answers ("haan", an age) often never reach isFinal, so the interim
      // buffer is the fallback — it used to be read from a stale closure and lost.
      const text = (finalTranscript || liveTranscriptRef.current || '').trim()
      setTranscript('')
      if (text) routeVoiceRef.current(text)
    }
    recognition.start()
  }, [isListening, stopListening])

  // ── Touch input ──────────────────────────────────────────────────────────────

  const handleTouchSubmit = () => {
    if (!step?.field) return
    const value = touchInput.trim()
    if (!value) return
    if (step.field === 'age') {
      const num = digitsOnly(value)
      if (!num || Number(num) < 1 || Number(num) > 120) {
        setInputError('Please enter an age between 1 and 120.')
        return
      }
      setForm(f => ({ ...f, age: num }))
    } else if (step.field === 'phone') {
      const num = digitsOnly(value)
      if (num.length < 10) {
        setInputError('Please enter a 10-digit phone number.')
        return
      }
      setForm(f => ({ ...f, phone: num }))
    } else {
      setForm(f => ({ ...f, [step.field]: value }))
    }
    setInputError('')
    setTouchInput('')
    advanceReg()
  }

  const handleOptionSelect = (option) => {
    if (step?.field === 'gender') setForm(f => ({ ...f, gender: option.toLowerCase() }))
    else if (step?.field === 'language') setForm(f => ({ ...f, language: option.toLowerCase() }))
    setInputError('')
    advanceReg()
  }

  const advanceReg = () => {
    if (currentStep < REGISTRATION_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      setFlowState('consent')
      // The language question is the last step, so read consent in the language
      // the patient just chose rather than in the default.
      setForm(f => {
        speakPrompt(GREETING.consent[f.language] || GREETING.consent.hinglish, f.language)
        return f
      })
    }
  }

  const confirmAndProceed = async () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    onComplete({
      ...form,
      // The frame captured on the identify screen, not a re-read of an unmounted
      // canvas. The backend derives the embedding from this image — the old
      // faceEmbedding: '[128-d vector]' placeholder was a literal string that
      // would have been stored as a patient's biometric had anything consumed it.
      faceBlob: faceBlobRef.current,
      faceCaptured: Boolean(faceBlobRef.current),
      patientId: returningPatient?.patientId || null,
      isReturning: !!returningPatient,
      pastVisitCount: returningPatient?.pastVisitCount || 0,
      registeredAt: new Date().toISOString(),
    })
  }

  const errorBanner = (inputError || voiceUnavailable) && (
    <div role="alert" style={{
      marginTop: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 13, color: '#fcd34d',
      display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
    }}>
      <AlertTriangle size={14} />
      {inputError || 'Voice input is not supported in this browser — please type your answer.'}
    </div>
  )

  const transcriptBanner = isListening && liveTranscript && (
    <div style={{
      marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 'var(--radius-md)', padding: '8px 16px', fontSize: 14,
      color: '#fca5a5', fontWeight: 500, textAlign: 'center',
    }}>
      "{liveTranscript}"
    </div>
  )

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
                  <div className="camera-fallback" style={{ display: (faceState === 'idle' || faceState === 'unavailable') ? 'flex' : 'none' }}>
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
                      {returningPatient ? <><Link2 size={14} /> Matched</> : <><Check size={14} /> Captured</>}
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
                  <Sparkles size={14} />
                  We'll only use this to find your care records.
                </p>

                {faceState === 'capturing' ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div className="scan-spinner" />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Looking up your face in our records…</p>
                  </div>
                ) : (
                  <button className="capture-button" onClick={() => { if (!hasCapturedRef.current) captureAndIdentify() }}>
                    <ScanFace size={18} /> Capture <kbd><CornerDownLeft size={12} /></kbd>
                  </button>
                )}

                <div className="language-box">
                  <span>YOUR LANGUAGE</span>
                  <div className="language-toggle" role="group" aria-label="Select language">
                    {LANGUAGE_CHOICES.map(({ label, value }) => (
                      <button
                        key={value}
                        className={language === value ? 'selected' : ''}
                        aria-pressed={language === value}
                        onClick={() => setForm(f => ({ ...f, language: value }))}
                      >
                        {label}
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
            language={language}
            currentStep={currentStep}
            totalSteps={REGISTRATION_STEPS.length}
            isSpeaking={isSpeaking}
            isListening={isListening}
            liveTranscript={liveTranscript}
            touchInput={touchInput}
            setTouchInput={setTouchInput}
            form={form}
            inputError={inputError}
            voiceUnavailable={voiceUnavailable}
            onOptionSelect={handleOptionSelect}
            onTouchSubmit={handleTouchSubmit}
            onMicClick={startListening}
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
            {/* An empty second <canvas> used to be mounted here — the capture was
                drawn on the scanning screen's canvas, which is already unmounted,
                so the "matched" photo was always blank. */}
            {facePreview ? (
              <img
                src={facePreview}
                alt="Captured photo"
                style={{
                  width: 140, height: 160, objectFit: 'cover', borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--accent-teal)', display: 'block', background: 'var(--bg-secondary)',
                }}
              />
            ) : (
              <div style={{
                width: 140, height: 160, borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-color)', background: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
              }}><User size={28} /></div>
            )}
            <div className="photo-tag"><span /> FACE MATCHED</div>
          </div>

          <div className="patient-profile">
            <div className="confidence">
              <span>{Math.round((returningPatient.confidence || 0) * 100)}%</span>
              <small>match confidence</small>
              <div className="confidence-bar-track">
                <div
                  className="confidence-bar-fill"
                  style={{ width: `${Math.round((returningPatient.confidence || 0) * 100)}%` }}
                />
              </div>
            </div>

            <span className="eyebrow">PATIENT RECORD</span>
            <h2>{form.name || returningPatient.name}</h2>

            <div className="profile-meta">
              <div><small>PATIENT ID</small><b style={{ fontFamily: 'monospace', color: 'var(--accent-teal)', fontSize: 13 }}>{returningPatient.patientId}</b></div>
              <div><small>PAST VISITS</small><b>{returningPatient.pastVisitCount} visits</b></div>
            </div>

            {editField === 'choosing' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['name', 'age', 'phone'].map(f => (
                  <button key={f} className="btn btn-secondary" onClick={() => {
                    setEditField(f)
                    speakPrompt(EDIT_PROMPT[f][language] || EDIT_PROMPT[f].hinglish)
                  }}>{f}</button>
                ))}
              </div>
            )}

            {editField && editField !== 'choosing' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder={`Enter new ${editField}`}
                  value={touchInput}
                  onChange={e => setTouchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyEdit() }}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={applyEdit}><Check size={16} /></button>
              </div>
            )}

            <div className="profile-actions">
              <button className="primary-action" onClick={confirmAndProceed}>
                {language === 'english' ? 'Yes, that\'s me' : 'Sahi hai'} <span>—</span> Start Interview
              </button>
              <button className="text-action" onClick={() => {
                setEditField('choosing')
                speakPrompt(GREETING.whatToChange[language] || GREETING.whatToChange.hinglish)
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
          ><Mic size={14} /></button>
          <span><b>Prefer to speak?</b> Tap the mic and say "Yes, this is me".</span>
        </div>

        {errorBanner}
        {transcriptBanner}
      </>
    )
  }

  // New reg with options (gender / language)
  if (flowState === 'new_reg' && step) {
    return (
      <NewRegView
        step={step}
        language={language}
        currentStep={currentStep}
        totalSteps={REGISTRATION_STEPS.length}
        isSpeaking={isSpeaking}
        isListening={isListening}
        liveTranscript={liveTranscript}
        touchInput={touchInput}
        setTouchInput={setTouchInput}
        form={form}
        inputError={inputError}
        voiceUnavailable={voiceUnavailable}
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
        language={language}
        faceCaptured={Boolean(facePreview)}
        onConfirm={confirmAndProceed}
        onMicClick={startListening}
        onDecline={() => speakPrompt(GREETING.noConsent[language] || GREETING.noConsent.hinglish)}
      />
    )
  }

  return null
}

// ── Sub-view: New Registration (chat style) ──────────────────────────────────
function NewRegView({ step, language, currentStep, totalSteps, isSpeaking, isListening, liveTranscript,
  touchInput, setTouchInput, form, inputError, voiceUnavailable,
  onOptionSelect, onTouchSubmit, onMicClick }) {

  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100)
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const spoken = promptFor(step, language)
  const gloss = language === 'english' ? null : step.promptEn

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
              {form.name && <span className="info-pill"><User size={13} /> {form.name}</span>}
              {form.age && <span className="info-pill"><Cake size={13} /> {form.age}y</span>}
              {form.gender && <span className="info-pill"><VenusAndMars size={13} /> {form.gender}</span>}
              {form.phone && <span className="info-pill"><Phone size={13} /> {form.phone}</span>}
            </div>
          )}
          <div className="message system">
            <span className="avatar ai-avatar">A</span>
            <div>
              <div className="message-bubble-inner">
                <p>Namaste! I'm Aarogya, your care assistant.</p>
                <p className="question" style={{ marginTop: 6 }}>{spoken}</p>
                {gloss && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{gloss}</p>}
              </div>
              <time className="message-time">{now}</time>
            </div>
          </div>
        </div>

        {step.options && (
          <div className="suggestions">
            {step.options.map(opt => (
              <button
                key={opt}
                className={step.field === 'language' && opt.toLowerCase() === form.language ? 'selected' : ''}
                onClick={() => onOptionSelect(opt)}
              >
                {opt}
                {step.field === 'language' && opt.toLowerCase() === form.language && ' ✓'}
              </button>
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
            <span><Mic size={20} /></span>
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
          <small>{isListening ? 'Listening…' : isSpeaking ? 'Speaking…' : 'Tap to speak'}</small>
        </div>
      </div>

      {(inputError || voiceUnavailable) && (
        <div role="alert" style={{
          marginTop: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 13, color: '#fcd34d',
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
        }}>
          <AlertTriangle size={14} />
          {inputError || 'Voice input is not supported in this browser — please type your answer.'}
        </div>
      )}

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
function ConsentView({ isSpeaking, isListening, liveTranscript, form, language, faceCaptured,
  onConfirm, onMicClick, onDecline }) {
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
          }}>A</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>
              {GREETING.consent[language] || GREETING.consent.hinglish}
            </div>
            {language !== 'english' && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 6 }}>
                Your voice, face, and documents will be processed by AI. Do you agree? (DPDP Act 2023 compliant)
              </div>
            )}
          </div>
        </div>

        {/* Collected summary */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {form.name && <span className="info-pill"><User size={13} /> {form.name}</span>}
          {form.age && <span className="info-pill"><Cake size={13} /> {form.age}y</span>}
          {form.gender && <span className="info-pill"><VenusAndMars size={13} /> {form.gender}</span>}
          {form.phone && <span className="info-pill"><Phone size={13} /> {form.phone}</span>}
          {form.language && <span className="info-pill"><Globe size={13} /> {form.language}</span>}
          <span className="info-pill">
            <ScanFace size={13} /> {faceCaptured ? 'face captured' : 'no face captured'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="primary-action btn-full" style={{ flex: 1 }} onClick={onConfirm}>
            <Check size={16} /> {language === 'english' ? 'I agree' : 'Haan, agree'} <span>—</span> Continue
          </button>
          <button className="text-action" style={{ flex: 0.5 }} onClick={onDecline}>
            {language === 'english' ? 'No' : 'Nahi'}
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button
            className={`large-mic${isListening ? ' is-listening' : ''}`}
            onClick={onMicClick}
            style={{ width: 44, height: 44, fontSize: 18 }}
            aria-label="Speak consent answer"
          >
            <span><Mic size={18} /></span>
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
