import React, { useState } from 'react'
import { ayushQuestions, demoAyushResponses } from '../../data/clinical/ayushQuestions'
import AyushProgress from './AyushProgress'
import AyushQuestion from './AyushQuestion'
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react'

export default function AyushAssessment({ initialData = {}, onComplete, onBack }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [formData, setFormData] = useState(() => {
    return {
      prakriti: initialData.prakriti || '',
      vikritiSymptoms: Array.isArray(initialData.vikritiSymptoms) ? initialData.vikritiSymptoms : [],
      agni: initialData.agni || '',
      koshtha: initialData.koshtha || '',
      aharaShakti: initialData.aharaShakti || '',
      vyayamaShakti: initialData.vyayamaShakti || '',
      aharaVihara: initialData.aharaVihara || {
        diet: '',
        sleep: '',
        activity: '',
      },
    }
  })
  const [validationError, setValidationError] = useState('')

  const currentQuestion = ayushQuestions[currentStepIndex]
  const totalSteps = ayushQuestions.length

  const handleValueChange = (val) => {
    setValidationError('')
    setFormData((prev) => ({
      ...prev,
      [currentQuestion.id]: val,
    }))
  }

  // Validate current step before advancing
  const validateCurrentStep = () => {
    const val = formData[currentQuestion.id]

    if (currentQuestion.type === 'single') {
      if (!val) {
        setValidationError('Please select an option to continue.')
        return false
      }
    } else if (currentQuestion.type === 'multi') {
      if (!Array.isArray(val) || val.length === 0) {
        setValidationError('Please select at least one symptom or "None of the above" to continue.')
        return false
      }
    } else if (currentQuestion.type === 'lifestyle-group') {
      if (!val || !val.diet || !val.sleep || !val.activity) {
        setValidationError('Please answer all 3 lifestyle questions (Diet, Sleep, Activity) to continue.')
        return false
      }
    }

    setValidationError('')
    return true
  }

  const handleNext = () => {
    if (!validateCurrentStep()) return

    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Completed all 7 questions!
      onComplete(formData)
    }
  }

  const handlePrev = () => {
    setValidationError('')
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      onBack()
    }
  }

  // Quick Demo Auto-Fill
  const handleLoadDemo = () => {
    setFormData(JSON.parse(JSON.stringify(demoAyushResponses)))
    setValidationError('')
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Framework Description */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/30 text-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
              Ayurveda / AYUSH Intake Mode
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1">Ayurvedic Clinical Assessment</h2>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1 max-w-xl">
            Collecting structured Dashavidha Pariksha &amp; Ahara-Vihara parameters to assist the Ayurvedic physician during your consultation.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadDemo}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-white/20 transition-all flex-shrink-0"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          Load Demo Responses
        </button>
      </div>

      {/* Stepper Progress Bar */}
      <AyushProgress
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        currentTitle={currentQuestion.title}
        sanskritTerm={currentQuestion.sanskritTerm}
      />

      {/* Active Question Card */}
      <AyushQuestion
        questionConfig={currentQuestion}
        value={formData[currentQuestion.id]}
        onChange={handleValueChange}
      />

      {/* Validation Error Alert */}
      {validationError && (
        <div className="p-4 rounded-xl bg-danger-50 border-l-4 border-danger-500 flex items-start gap-3 animate-shake">
          <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs sm:text-sm font-bold text-danger-900">Selection Required</p>
            <p className="text-xs text-danger-700 mt-0.5">{validationError}</p>
          </div>
        </div>
      )}

      {/* Safety & Non-Diagnostic Disclaimer */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p>
          <strong className="font-semibold">Clinical Information Notice:</strong> All responses are recorded as patient-reported observational history for the physician's diagnostic evaluation. No automated diagnosis or treatment recommendations are made.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={handlePrev}
          className="flex-1 py-3 px-6 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {currentStepIndex === 0 ? 'Back to Documents' : 'Previous Question'}
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <span>{currentStepIndex === totalSteps - 1 ? 'Save & View Summary' : 'Next Question'}</span>
          {currentStepIndex === totalSteps - 1 ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
