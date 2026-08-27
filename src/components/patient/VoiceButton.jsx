import React from 'react'
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react'

export default function VoiceButton({
  isListening = false,
  isProcessing = false,
  onClick,
  disabled = false,
  label = 'Tap to Speak',
  listeningLabel = 'Listening... Speak now',
  size = 'md', // 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-xs sm:text-sm',
    lg: 'px-6 py-4 text-base',
  }

  return (
    <div className="relative inline-flex items-center">
      {/* Pulsing ring animation when listening */}
      {isListening && (
        <span className="absolute -inset-1 rounded-2xl bg-danger-400/40 animate-ping pointer-events-none" />
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isProcessing}
        className={`relative flex items-center justify-center gap-2.5 font-bold rounded-xl transition-all shadow-sm ${
          sizeClasses[size]
        } ${
          isListening
            ? 'bg-danger-600 hover:bg-danger-700 text-white ring-4 ring-danger-200 animate-pulse'
            : isProcessing
            ? 'bg-amber-500 text-white cursor-wait'
            : 'bg-medical-600 hover:bg-medical-700 text-white hover:shadow-md'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Voice input button"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing speech...</span>
          </>
        ) : isListening ? (
          <>
            <span className="w-3 h-3 rounded-full bg-white animate-ping" />
            <Mic className="w-5 h-5 text-white" />
            <span>{listeningLabel}</span>
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" />
            <span>{label}</span>
          </>
        )}
      </button>
    </div>
  )
}
