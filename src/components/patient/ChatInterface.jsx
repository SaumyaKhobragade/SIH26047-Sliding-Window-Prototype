import { useState, useEffect, useRef } from 'react'
import { Send, ArrowLeft, Volume2, VolumeX, Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ChatMessage from './ChatMessage'
import QuickAnswerButtons from './QuickAnswerButtons'
import RedFlagAlert from './RedFlagAlert'
import VoiceButton from './VoiceButton'
import VoiceTranscript from './VoiceTranscript'
import VoiceSettings from './VoiceSettings'
import { getConversationEngine } from '../../services/conversationEngine'
import { getAIService } from '../../services/aiService'
import { getRedFlagDetector } from '../../services/redFlagService'
import { getSpeechService } from '../../services/speechService'
import { usePatient } from '../../context/PatientContext'
import { speechLanguages } from '../../data/speechLanguages'

export default function ChatInterface() {
  const navigate = useNavigate()
  const { patientHistory, updatePatientHistory } = usePatient()
  const conversationEngine = getConversationEngine()
  const aiService = getAIService()
  const redFlagDetector = getRedFlagDetector()
  const speechService = getSpeechService()

  // State
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversation, setConversation] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [redFlags, setRedFlags] = useState([])
  const [isComplete, setIsComplete] = useState(false)

  // Voice & Language state
  const [currentLanguage, setCurrentLanguage] = useState(
    () => localStorage.getItem('selectedLanguage') || 'en'
  )
  const [isListening, setIsListening] = useState(false)
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false)
  const [recognizedTranscript, setRecognizedTranscript] = useState(null)
  const [isVoiceAssistanceEnabled, setIsVoiceAssistanceEnabled] = useState(
    () => speechService.getVoiceAssistance()
  )

  const messagesEndRef = useRef(null)
  const langConfig = speechLanguages[currentLanguage] || speechLanguages.en

  // Speak question helper
  const speakCurrentQuestion = (questionText, lang = currentLanguage) => {
    if (isVoiceAssistanceEnabled && questionText) {
      speechService.speak(questionText, { language: lang })
    }
  }

  // Initialize conversation on mount
  useEffect(() => {
    const initConversation = () => {
      conversationEngine.init(
        patientHistory.patientInfo?.name || 'Patient',
        patientHistory.patientInfo?.age || 0,
        patientHistory.patientInfo?.gender || '',
        patientHistory.chiefComplaint || ''
      )

      const firstQuestion = conversationEngine.getCurrentQuestion()
      if (firstQuestion) {
        setCurrentQuestion(firstQuestion)
        setConversation([
          {
            message: firstQuestion.question,
            isPatient: false,
            timestamp: new Date(),
          },
        ])
        speakCurrentQuestion(firstQuestion.question)
      }

      updateProgress()
    }

    initConversation()

    return () => {
      speechService.cancelSpeech()
      speechService.stopListening()
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, recognizedTranscript])

  const updateProgress = () => {
    const prog = conversationEngine.getProgress()
    setProgress({
      current: prog.questionIndex,
      total: prog.totalQuestions,
    })
  }

  // Handle language change on-the-fly
  const handleLanguageChange = (newLang) => {
    setCurrentLanguage(newLang)
    localStorage.setItem('selectedLanguage', newLang)
    if (currentQuestion) {
      speakCurrentQuestion(currentQuestion.question, newLang)
    }
  }

  // Toggle voice assistance audio
  const handleToggleVoiceAssistance = () => {
    const newState = !isVoiceAssistanceEnabled
    setIsVoiceAssistanceEnabled(newState)
    speechService.setVoiceAssistance(newState)
    if (newState && currentQuestion) {
      speakCurrentQuestion(currentQuestion.question)
    }
  }

  // Start speech recognition
  const handleStartVoiceInput = () => {
    setRecognizedTranscript(null)
    setIsListening(true)

    speechService.startListening({
      language: currentLanguage,
      currentQuestionText: currentQuestion?.question || '',
      onResult: (transcript) => {
        setIsListening(false)
        setIsProcessingSpeech(false)
        setRecognizedTranscript(transcript)
      },
      onError: (err) => {
        console.warn('Voice input error:', err)
        setIsListening(false)
        setIsProcessingSpeech(false)
      },
      onEnd: () => {
        setIsListening(false)
        setIsProcessingSpeech(false)
      },
    })
  }

  // Stop listening
  const handleStopVoiceInput = () => {
    speechService.stopListening()
    setIsListening(false)
  }

  // Submit answer
  const handleAnswerSubmit = async (answerText) => {
    if (!answerText || !answerText.trim() || isLoading) return

    setIsLoading(true)
    setRecognizedTranscript(null)

    try {
      // Add patient message to conversation
      setConversation((prev) => [
        ...prev,
        {
          message: answerText.trim(),
          isPatient: true,
          timestamp: new Date(),
        },
      ])

      // Process answer through AI service
      const interpreted = await aiService.interpretAnswer(
        currentQuestion,
        answerText,
        patientHistory
      )

      // Record answer in conversation engine
      conversationEngine.recordAnswer(currentQuestion.id, interpreted)

      // Create updated history for red flag analysis
      const updatedHistory = JSON.parse(JSON.stringify(patientHistory))
      const keys = interpreted.fieldPath.split('.')
      let current = updatedHistory
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = interpreted.value

      // Check for red flags with updated history
      const newRedFlags = redFlagDetector.analyzeHistory(updatedHistory)
      updatePatientHistory('redFlags', newRedFlags)
      setRedFlags(newRedFlags)

      // Update patient history with structured data
      updatePatientHistory(interpreted.fieldPath, interpreted.value)

      // Get next question
      const nextQuestion = conversationEngine.getNextQuestion()

      if (!nextQuestion) {
        // Interview complete
        setIsComplete(true)
        const completeMsg = 'Thank you for providing this information. Your case summary is ready for the doctor.'
        setConversation((prev) => [
          ...prev,
          {
            message: completeMsg,
            isPatient: false,
            timestamp: new Date(),
          },
        ])
        speakCurrentQuestion(completeMsg)
      } else {
        // Add next question to conversation and speak aloud
        setCurrentQuestion(nextQuestion)
        setConversation((prev) => [
          ...prev,
          {
            message: nextQuestion.question,
            isPatient: false,
            timestamp: new Date(),
          },
        ])
        speakCurrentQuestion(nextQuestion.question)
      }

      updateProgress()
      setInputText('')
    } catch (error) {
      console.error('Error processing answer:', error)
      setConversation((prev) => [
        ...prev,
        {
          message: 'Sorry, there was an error processing your response. Please try again.',
          isPatient: false,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAnswer = (answer) => {
    handleAnswerSubmit(answer)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAnswerSubmit(inputText)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-medical-600 text-white px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="hover:bg-medical-700 p-1.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">Clinical Interview</h1>
              <p className="text-xs opacity-90">
                {patientHistory.patientInfo?.name || 'Patient'}, Age {patientHistory.patientInfo?.age || 42} • Mode: {patientHistory.clinicalMode === 'ayush' ? 'Ayurveda' : 'General'}
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">
            {progress.current} / {progress.total}
          </p>
          <p className="text-xs opacity-90">Questions</p>
        </div>
      </div>

      {/* Voice & Language Settings Bar */}
      <VoiceSettings
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        isVoiceAssistanceEnabled={isVoiceAssistanceEnabled}
        onToggleVoiceAssistance={handleToggleVoiceAssistance}
      />

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {/* Red Flag Alert */}
        {redFlags.length > 0 && <RedFlagAlert redFlags={redFlags} />}

        {/* Conversation Message Feed */}
        {conversation.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} isPatient={msg.isPatient} />
        ))}

        {/* Complete Button */}
        {isComplete && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => navigate('/patient/documents')}
              className="px-8 py-3.5 bg-medical-600 text-white rounded-xl font-bold hover:bg-medical-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              Continue to Medical Documents →
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isComplete && (
        <div className="border-t bg-white p-4 space-y-3 shadow-lg">
          {/* Recognized Voice Transcript Review (Before Final Submission) */}
          {recognizedTranscript && (
            <VoiceTranscript
              transcript={recognizedTranscript}
              onConfirm={(text) => handleAnswerSubmit(text)}
              onRetry={handleStartVoiceInput}
              onCancel={() => setRecognizedTranscript(null)}
              confirmLabel={langConfig.useThis || 'Use This Answer'}
              tryAgainLabel={langConfig.tryAgain || 'Try Again'}
            />
          )}

          {/* Quick Choice Buttons */}
          {currentQuestion && currentQuestion.options && !recognizedTranscript && (
            <QuickAnswerButtons
              options={currentQuestion.options}
              onSelect={handleQuickAnswer}
              isVisible={currentQuestion.type === 'choice'}
            />
          )}

          {/* Primary Dual Input: Text Box + Voice Button */}
          {!recognizedTranscript && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={langConfig.typeOrSpeak || 'Type your response or use microphone...'}
                  disabled={isLoading || isListening}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-medical-600 resize-none text-sm font-medium leading-relaxed"
                  rows="2"
                />

                <div className="flex flex-col gap-2">
                  <VoiceButton
                    isListening={isListening}
                    isProcessing={isProcessingSpeech}
                    onClick={isListening ? handleStopVoiceInput : handleStartVoiceInput}
                    disabled={isLoading}
                    label={langConfig.tapToSpeak || 'Speak'}
                    listeningLabel={langConfig.listeningPrompt || 'Listening...'}
                    size="md"
                  />

                  <button
                    onClick={() => handleAnswerSubmit(inputText)}
                    disabled={isLoading || !inputText.trim()}
                    className="px-4 py-2.5 bg-medical-600 text-white rounded-xl hover:bg-medical-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Helper footnote */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                <span>🎤 Tap microphone to speak in {langConfig.nativeLabel}</span>
                <span>⌨️ Press Enter to send text</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
