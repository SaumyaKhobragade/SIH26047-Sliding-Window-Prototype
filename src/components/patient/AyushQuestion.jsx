import React from 'react'
import AyushOptionCard from './AyushOptionCard'
import { Sparkles, HelpCircle, Utensils, Moon, Activity } from 'lucide-react'

export default function AyushQuestion({ questionConfig, value, onChange }) {
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

    // If selecting another option, remove 'None of these'
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Question Header Card */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-emerald-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>{questionConfig.title}</span>
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
