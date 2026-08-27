import React, { useState } from 'react'
import AyushOptionCard from './AyushOptionCard'
import VoiceButton from './VoiceButton'
import { Sparkles, HelpCircle, Utensils, Moon, Activity, Volume2 } from 'lucide-react'
import { getSpeechService } from '../../services/speechService'

export default function AyushQuestion({ questionConfig, value, onChange }) {
  const speechService = getSpeechService()
  const [isListening, setIsListening] = useState(false)
  const [speechFeedback, setSpeechFeedback] = useState('')

  if (!questionConfig) return null

  // Handler for single select
  const handleSingleSelect = (val) => {
    onChange(val)
  }

  // Handler for multi select (Vikriti symptoms)
  const handleMultiSelect = (val) => {
    const currentList = Array.isArray(value) ? [...value] : []

    if (val === 'None of these') {
      onChange(['None of these'])
      return
    }

    let updated = currentList.filter((item) => item !== 'None of these')

    if (updated.includes(val)) {
      updated = updated.filter((item) => item !== val)
    } else {
      updated.push(val)
    }

    onChange(updated.length === 0 ? [] : updated)
  }

  // Handler for lifestyle sub-questions (Ahara-Vihara)
  const handleLifestyleChange = (field, val) => {
    const currentGroup = typeof value === 'object' && value !== null ? { ...value } : {}
    onChange({
      ...currentGroup,
      [field]: val,
    })
  }

  // Voice handler for AYUSH question
  const handleVoiceAnswer = () => {
    setIsListening(true)
    setSpeechFeedback('Listening...')

    speechService.startListening({
      language: localStorage.getItem('selectedLanguage') || 'en',
      currentQuestionText: questionConfig.question,
      onResult: (transcript) => {
        setIsListening(false)
        setSpeechFeedback(`Recognized: "${transcript}"`)

        // Match speech to options
        const lower = transcript.toLowerCase()

        if (questionConfig.type === 'single' && Array.isArray(questionConfig.options)) {
          for (const opt of questionConfig.options) {
            if (
              lower.includes(opt.value.toLowerCase()) ||
              lower.includes(opt.label.toLowerCase()) ||
              (opt.value === 'Pitta' && lower.includes('pitta')) ||
              (opt.value === 'Vata' && lower.includes('vata')) ||
              (opt.value === 'Kapha' && lower.includes('kapha')) ||
              (opt.value === 'Irregular' && (lower.includes('irregular') || lower.includes('visham'))) ||
              (opt.value === 'Moderate' && (lower.includes('moderate') || lower.includes('sama') || lower.includes('madhya'))) ||
              (opt.value === 'Slow' && (lower.includes('slow') || lower.includes('manda'))) ||
              (opt.value === 'Strong' && (lower.includes('strong') || lower.includes('tikshna') || lower.includes('good')))
            ) {
              onChange(opt.value)
              break
            }
          }
        } else if (questionConfig.type === 'multi') {
          if (lower.includes('none') || lower.includes('nothing')) {
            onChange(['None of these'])
          } else {
            const found = []
            if (lower.includes('digest') || lower.includes('acidity') || lower.includes('bloat')) found.push('Digestive discomfort')
            if (lower.includes('fatigue') || lower.includes('tired')) found.push('Fatigue')
            if (lower.includes('sleep') || lower.includes('insomnia')) found.push('Irregular sleep')
            if (lower.includes('skin') || lower.includes('rash')) found.push('Skin changes')
            if (lower.includes('appetite') || lower.includes('hunger')) found.push('Appetite changes')
            if (found.length > 0) onChange(found)
          }
        }
      },
      onError: () => {
        setIsListening(false)
        setSpeechFeedback('')
      },
      onEnd: () => {
        setIsListening(false)
      },
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Question Header Card */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-emerald-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{questionConfig.title}</span>
          </div>

          <VoiceButton
            isListening={isListening}
            onClick={handleVoiceAnswer}
            label="Speak Answer"
            size="sm"
          />
        </div>

        <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-snug">
          {questionConfig.question}
        </h3>

        {questionConfig.hint && (
          <p className="text-xs sm:text-sm text-gray-600 mt-2 flex items-start gap-1.5">
            <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>{questionConfig.hint}</span>
          </p>
        )}

        {speechFeedback && (
          <p className="text-xs text-emerald-800 font-semibold mt-2.5 bg-emerald-100/70 px-2.5 py-1 rounded-lg inline-block">
            🎤 {speechFeedback}
          </p>
        )}
      </div>

      {/* Options List based on Question Type */}
      {questionConfig.type === 'single' && (
        <div className="space-y-3">
          {questionConfig.options.map((opt) => (
            <AyushOptionCard
              key={opt.value}
              option={opt}
              isSelected={value === opt.value}
              onClick={() => handleSingleSelect(opt.value)}
            />
          ))}
        </div>
      )}

      {questionConfig.type === 'multi' && (
        <div className="space-y-3">
          {questionConfig.options.map((opt) => {
            const isSelected = Array.isArray(value) && value.includes(opt.value)
            return (
              <AyushOptionCard
                key={opt.value}
                option={opt}
                isSelected={isSelected}
                isMulti={true}
                onClick={() => handleMultiSelect(opt.value)}
              />
            )
          })}
        </div>
      )}

      {questionConfig.type === 'lifestyle-group' && (
        <div className="space-y-5">
          {questionConfig.subQuestions.map((subQ) => {
            const currentSubVal = value?.[subQ.id] || ''

            const subIcons = {
              diet: Utensils,
              sleep: Moon,
              activity: Activity,
            }
            const SubIcon = subIcons[subQ.id] || Sparkles

            return (
              <div key={subQ.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <SubIcon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">{subQ.label}</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {subQ.options.map((opt) => {
                    const isSelected = currentSubVal === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleLifestyleChange(subQ.id, opt)}
                        className={`p-3.5 rounded-xl border-2 text-sm font-bold transition-all text-center ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-200'
                            : 'border-gray-200 bg-gray-50/60 hover:bg-white text-gray-700 hover:border-emerald-300'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
