import React, { useState, useEffect } from 'react'
import { Check, RefreshCw, Edit3, MessageSquare, Sparkles } from 'lucide-react'

export default function VoiceTranscript({
  transcript = '',
  onConfirm,
  onRetry,
  onCancel,
  confirmLabel = 'Use This Answer',
  tryAgainLabel = 'Try Again',
}) {
  const [editedText, setEditedText] = useState(transcript)

  useEffect(() => {
    setEditedText(transcript)
  }, [transcript])

  return (
    <div className="bg-white rounded-2xl border-2 border-medical-500 p-5 shadow-lg space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-medical-100 text-medical-700 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900">Spoken Response Recognized</h4>
            <p className="text-[11px] text-gray-500">Review or adjust before confirming</p>
          </div>
        </div>

        <span className="bg-success-100 text-success-800 text-xs font-bold px-2 py-0.5 rounded-full border border-success-200">
          ✓ Speech-to-Text
        </span>
      </div>

      {/* Editable transcript box */}
      <div className="relative">
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={3}
          className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:border-medical-600 resize-none leading-relaxed"
          placeholder="Recognized speech will appear here..."
        />
        <span className="absolute bottom-2.5 right-3 text-[10px] text-gray-400 flex items-center gap-1 pointer-events-none">
          <Edit3 className="w-3 h-3" /> Editable text
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
          {tryAgainLabel}
        </button>

        <button
          type="button"
          onClick={() => onConfirm(editedText)}
          disabled={!editedText.trim()}
          className="px-6 py-2.5 bg-medical-600 hover:bg-medical-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
