import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Send } from 'lucide-react'
import Button from '../../components/Button'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import Card from '../../components/Card'
import VoiceButton from '../../components/VoiceButton'
import ProgressIndicator from '../../components/ProgressIndicator'
import { conversationData } from '../../data/conversations'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = React.useState(conversationData.chestPainScenario)
  const [inputValue, setInputValue] = React.useState('')
  const [isListening, setIsListening] = React.useState(false)
  const messagesEndRef = React.useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const newMessage = {
        id: messages.length + 1,
        type: 'patient',
        message: inputValue,
        timestamp: new Date(),
      }
      setMessages([...messages, newMessage])
      setInputValue('')
    }
  }

  const handleQuickResponse = (response) => {
    const newMessage = {
      id: messages.length + 1,
      type: 'patient',
      message: response,
      timestamp: new Date(),
    }
    setMessages([...messages, newMessage])
  }

  const handleVoiceClick = () => {
    setIsListening(!isListening)
  }

  const handleContinue = () => {
    navigate('/patient/documents')
  }

  const handleBack = () => {
    navigate('/patient/profile')
  }

  return (
    <>
      <Header title="Conversational History" onBack={handleBack} />
      <ProgressIndicator
        currentStep={3}
        totalSteps={7}
        labels={['Welcome', 'Consent', 'Profile', 'History', 'Documents', 'AYUSH', 'Summary']}
      />
      <PageContainer>
        <div className="space-y-6 flex flex-col h-[calc(100vh-300px)]">
          <Card className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      msg.type === 'patient'
                        ? 'bg-medical-600 text-white rounded-br-none'
                        : 'bg-gray-200 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className="text-xs mt-2 opacity-70">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </Card>

          <Card>
            <p className="font-semibold text-gray-900 mb-3">
              {conversationData.nextAIQuestion}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {conversationData.quickResponses.map((response) => (
                <button
                  key={response}
                  onClick={() => handleQuickResponse(response)}
                  className="px-3 py-2 text-sm bg-medical-50 text-medical-700 rounded-lg hover:bg-medical-100 transition-colors border border-medical-200"
                >
                  {response}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your response..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-transparent outline-none"
              />
              <VoiceButton onVoiceClick={handleVoiceClick} isListening={isListening} />
              <button
                onClick={handleSendMessage}
                className="p-3 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            {isListening && (
              <p className="text-sm text-danger-600 mt-2 animate-pulse">
                🎙️ Recording... Click mic to stop
              </p>
            )}
          </Card>

          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleBack} size="lg" className="flex-1">
              Back
            </Button>
            <Button onClick={handleContinue} size="lg" className="flex-1">
              Continue to Documents
            </Button>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
