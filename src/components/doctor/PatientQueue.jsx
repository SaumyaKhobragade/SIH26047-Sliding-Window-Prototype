import React from 'react'
import { AlertCircle, User, RefreshCw, Clock, CheckCircle2, Search } from 'lucide-react'

export const defaultMockQueue = [
  {
    id: 'ABHA_00001234567890',
    name: 'Rahul Sharma',
    age: 42,
    gender: 'Male',
    chief_complaint: 'Chest pain',
    duration: 'Since yesterday',
    priority: 'high',
    status: 'waiting',
    redFlags: true,
    clinicalMode: 'ayush',
    time: '10:15 AM',
  },
  {
    id: 'ABHA_00002345678901',
    name: 'Amit Patil',
    age: 36,
    gender: 'Male',
    chief_complaint: 'Fever & body ache',
    duration: '2 days',
    priority: 'low',
    status: 'ready',
    redFlags: false,
    clinicalMode: 'general',
    time: '10:30 AM',
  },
  {
    id: 'ABHA_00003456789012',
    name: 'Priya Singh',
    age: 51,
    gender: 'Female',
    chief_complaint: 'Joint pain & stiffness',
    duration: '3 weeks',
    priority: 'medium',
    status: 'ready',
    redFlags: false,
    clinicalMode: 'ayush',
    time: '10:45 AM',
  },
]

export default function PatientQueue({
  selectedPatientId,
  onSelectPatient,
  onResetDemo,
  caseStatus = 'priority',
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-white">OPD Triage Queue</h3>
          <p className="text-[11px] text-gray-400">3 Patients Checked In</p>
        </div>

        <button
          type="button"
          onClick={onResetDemo}
          className="p-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
          title="Reset Demo Case to default Rahul Sharma intake state"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset Demo</span>
        </button>
      </div>

      {/* Patient List */}
      <div className="p-3 space-y-2.5 overflow-y-auto flex-1">
        {defaultMockQueue.map((patient) => {
          const isSelected = selectedPatientId === patient.id
          const isRahul = patient.id === 'ABHA_00001234567890'
          const displayStatus = isRahul ? caseStatus : patient.status

          return (
            <button
              key={patient.id}
              type="button"
              onClick={() => onSelectPatient(patient)}
              className={`w-full p-3.5 rounded-xl text-left transition-all border-2 ${
                isSelected
                  ? 'border-medical-600 bg-medical-50/80 shadow-md ring-2 ring-medical-100'
                  : 'border-gray-200 bg-white hover:border-medical-300 hover:bg-gray-50/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {patient.redFlags ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-danger-500 animate-pulse flex-shrink-0" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-success-500 flex-shrink-0" />
                    )}
                    <h4 className="font-bold text-sm text-gray-900 truncate">{patient.name}</h4>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {patient.age}y • {patient.gender} • <span className="font-medium text-gray-800">{patient.chief_complaint}</span>
                  </p>
                </div>

                <span className="text-[11px] text-gray-400 font-mono">{patient.time}</span>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                {patient.redFlags ? (
                  <span className="bg-danger-100 text-danger-800 font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-danger-200">
                    <AlertCircle className="w-3 h-3 text-danger-600" />
                    Priority Case
                  </span>
                ) : (
                  <span className="bg-success-50 text-success-700 font-semibold px-2 py-0.5 rounded border border-success-200">
                    Ready
                  </span>
                )}

                <span className={`capitalize font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                  displayStatus === 'reviewed'
                    ? 'bg-purple-100 text-purple-800 font-bold'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {displayStatus === 'reviewed' ? '✓ Reviewed' : 'AI Draft'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-500 text-center">
        <span>Click a patient to load complete structured case</span>
      </div>
    </div>
  )
}
