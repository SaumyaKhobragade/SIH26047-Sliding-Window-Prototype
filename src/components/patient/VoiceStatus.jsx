import React from 'react'
import { Mic, MicOff, AlertCircle, Volume2, CheckCircle2 } from 'lucide-react'

export default function VoiceStatus({
  isSupported = true,
  isListening = false,
  language = 'en',
  hasError = false,
  errorMessage = '',
}) {
  if (!isSupported) {
    return (
      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>Voice input isn't available in this browser. You can continue using text.</span>
      </div>
    )
  }

  if (hasError && errorMessage) {
    return (
      <div className="p-2.5 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-800 flex items-center gap-2 animate-fade-in">
        <MicOff className="w-4 h-4 text-danger-600 flex-shrink-0" />
        <span>{errorMessage}</span>
      </div>
    )
  }

  if (isListening) {
    return (
      <div className="p-2.5 bg-danger-50 border border-danger-300 rounded-xl text-xs text-danger-900 flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-2 font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-danger-600 animate-ping" />
          <span>Microphone Active • Listening...</span>
        </div>
        <span className="text-[11px] text-danger-700">Speak naturally</span>
      </div>
    )
  }

  return null
}
