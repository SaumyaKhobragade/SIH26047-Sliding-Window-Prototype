import { useState, useEffect, useRef } from 'react'
import { Mic, Send, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ChatMessage from './ChatMessage'
import QuickAnswerButtons from './QuickAnswerButtons'
import RedFlagAlert from './RedFlagAlert'
import { getConversationEngine } from '../../services/conversationEngine'
import { getAIService } from '../../services/aiService'
import { getRedFlagDetector } from '../../services/redFlagService'
import { usePatient } from '../../context/PatientContext'

export default function ChatInterface() {
  const navigate = useNavigate()
  const { patientHistory, updatePatientHistory } = usePatient()
  const conversationEngine = getConversationEngine()
  const aiService = getAIService()
  const redFlagDetector = getRedFlagDetector()

  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversation, setConversation] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [redFlags, setRedFlags] = useState([])
  const [isComplete, setIsComplete] = useState(false)
  const messagesEndRef = useRef(null)

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
      }

      updateProgress()
    }

    initConversation()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const updateProgress = () => {
    const prog = conversationEngine.getProgress()
    setProgress({
      current: prog.questionIndex,
      total: prog.totalQuestions,
    })
  }

  const handleAnswerSubmit = async (answerText) => {
    if (!answerText.trim() || isLoading) return

    setIsLoading(true)

    try {
      // Add patient message to conversation
      setConversation((prev) => [
        ...prev,
        {
          message: answerText,
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
        setConversation((prev) => [
          ...prev,
          {
            message:
              'Thank you for providing this information. Your case summary is ready for the doctor.',
            isPatient: false,
            timestamp: new Date(),
          },
        ])
      } else {
        // Add next question to conversation
        setCurrentQuestion(nextQuestion)
        setConversation((prev) => [
          ...prev,
          {
            message: nextQuestion.question,
            isPatient: false,
            timestamp: new Date(),
          },
        ])
      }

      updateProgress()
      setInputText('')
    } catch (error) {
      console.error('Error processing answer:', error)
      setConversation((prev) => [
        ...prev,
        {
          message:
            'Sorry, there was an error processing your response. Please try again.',
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

  const handleVoiceClick = () => {
    alert('Voice input will be enabled in the next prototype stage.')
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-medical-600 text-white px-4 py-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="hover:bg-medical-700 p-1 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">Clinical Interview</h1>
              <p className="text-xs opacity-90">
                {patientHistory.patientInfo?.name || 'Patient'}, Age{' '}
                {patientHistory.patientInfo?.age}
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            {progress.current} / {progress.total}
          </p>
          <p className="text-xs opacity-90">Questions</p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {/* Red Flag Alert */}
        {redFlags.length > 0 && <RedFlagAlert redFlags={redFlags} />}

        {/* Conversation */}
        {conversation.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} isPatient={msg.isPatient} />
        ))}

        {/* Complete Button */}
        {isComplete && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => navigate('/patient/documents')}
              className="px-8 py-3 bg-medical-600 text-white rounded-lg font-bold hover:bg-medical-700 transition-colors shadow-md flex items-center gap-2"
            >
              Continue to Medical Documents →
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isComplete && (
        <div className="border-t bg-white p-4 space-y-3">
          {/* Quick Answer Buttons */}
          {currentQuestion && currentQuestion.options && (
            <QuickAnswerButtons
              options={currentQuestion.options}
              onSelect={handleQuickAnswer}
              isVisible={currentQuestion.type === 'choice'}
            />
          )}

          {/* Input */}
          <div className="flex gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your response..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:border-medical-600 resize-none"
              rows="3"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handleVoiceClick}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 font-medium"
                title="Voice input"
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleAnswerSubmit(inputText)}
                disabled={isLoading || !inputText.trim()}
                className="px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 disabled:bg-gray-300 transition-colors flex items-center gap-2 font-medium"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
