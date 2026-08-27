import { Mic } from 'lucide-react'

export default function VoiceButton({ onVoiceClick, isListening = false }) {
  return (
    <button
      onClick={onVoiceClick}
      className={`p-4 rounded-full transition-all duration-200 ${
        isListening
          ? 'bg-danger-600 text-white shadow-lg scale-105'
          : 'bg-medical-600 text-white hover:bg-medical-700'
      }`}
      aria-label="Record voice input"
    >
      <Mic className="w-6 h-6" />
    </button>
  )
}
