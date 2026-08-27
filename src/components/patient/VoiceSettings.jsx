import React from 'react'
import { Volume2, VolumeX, Globe } from 'lucide-react'
import { speechLanguages } from '../../data/speechLanguages'

export default function VoiceSettings({
  currentLanguage = 'en',
  onLanguageChange,
  isVoiceAssistanceEnabled = true,
  onToggleVoiceAssistance,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 border-b border-gray-200 text-xs">
      {/* Language Switcher */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-medical-600 flex-shrink-0" />
        <span className="font-semibold text-gray-700 hidden sm:inline">Language:</span>
        <div className="flex items-center gap-1">
          {Object.values(speechLanguages).map((lang) => {
            const isSelected = currentLanguage === lang.code
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => onLanguageChange(lang.code)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  isSelected
                    ? 'bg-medical-600 text-white shadow-2xs'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                {lang.nativeLabel}
              </button>
            )
          })}
        </div>
      </div>

      {/* Voice Output Toggle */}
      <button
        type="button"
        onClick={onToggleVoiceAssistance}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold border transition-all ${
          isVoiceAssistanceEnabled
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
        }`}
        title="Toggle automated speech readouts for questions"
      >
        {isVoiceAssistanceEnabled ? (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Voice Audio: ON</span>
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-gray-400" />
            <span>Voice Audio: OFF</span>
          </>
        )}
      </button>
    </div>
  )
}
