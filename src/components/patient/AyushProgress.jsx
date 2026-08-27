import React from 'react'

export default function AyushProgress({ currentStep, totalSteps, currentTitle, sanskritTerm }) {
  const percentage = Math.round(((currentStep + 1) / totalSteps) * 100)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold">
        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
            Question {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-gray-500 hidden sm:inline">•</span>
          <span className="text-gray-700 font-bold hidden sm:inline">{currentTitle}</span>
        </div>
        <span className="text-emerald-700 font-bold">{percentage}% Completed</span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {sanskritTerm && (
        <div className="text-[11px] text-gray-500 flex items-center justify-between pt-0.5">
          <span>Clinical Framework: <strong className="text-emerald-900">{sanskritTerm}</strong></span>
          <span className="text-gray-400">Dashavidha Pariksha Subset</span>
        </div>
      )}
    </div>
  )
}
