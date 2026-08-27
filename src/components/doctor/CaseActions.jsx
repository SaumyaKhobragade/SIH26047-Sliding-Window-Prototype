import React from 'react'
import { CheckCircle2, Edit3, Stethoscope, AlertCircle, ShieldCheck, Clock, FileCheck } from 'lucide-react'

export default function CaseActions({
  caseStatus = 'priority',
  onAcceptCase,
  onEditCase,
  onStartConsultation,
  isConsultationActive = false,
}) {
  const isReviewed = caseStatus === 'reviewed'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-gray-900">Clinical Case Actions</h3>
        <span
          className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${
            isReviewed
              ? 'bg-success-100 text-success-800 border-success-300'
              : caseStatus === 'priority'
              ? 'bg-danger-100 text-danger-800 border-danger-300'
              : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}
        >
          {isReviewed ? '✓ Case Reviewed & Accepted' : caseStatus === 'priority' ? '🔴 Priority Review' : 'AI Draft'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onEditCase}
          className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 hover:border-gray-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs"
        >
          <Edit3 className="w-4 h-4 text-medical-600" />
          Edit / Correct Case Details
        </button>

        <button
          type="button"
          onClick={onAcceptCase}
          disabled={isReviewed}
          className={`w-full py-2.5 px-4 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 ${
            isReviewed
              ? 'bg-success-50 text-success-700 border border-success-200 cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {isReviewed ? 'Case Verified by Physician' : 'Accept & Verify Case'}
        </button>

        <button
          type="button"
          onClick={onStartConsultation}
          className={`w-full py-3 px-4 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 ${
            isConsultationActive
              ? 'bg-medical-700 text-white ring-2 ring-medical-300'
              : 'bg-medical-600 hover:bg-medical-700 text-white shadow-md'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          {isConsultationActive ? 'Consultation in Progress' : 'Start Patient Consultation'}
        </button>
      </div>

      {/* Physician Authority Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-600 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-gray-800">
          <ShieldCheck className="w-3.5 h-3.5 text-medical-600" />
          <span>Physician Governance</span>
        </div>
        <p className="leading-relaxed">
          MediKiosk prepares structured draft information from patient intake. Clinical evaluation and treatment decisions remain the sole responsibility of the attending physician.
        </p>
      </div>
    </div>
  )
}
