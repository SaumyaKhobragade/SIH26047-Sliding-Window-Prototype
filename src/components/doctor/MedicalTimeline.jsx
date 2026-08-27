import React from 'react'
import { Calendar, FileText, FlaskConical, Stethoscope, Activity, ArrowRight } from 'lucide-react'

export default function MedicalTimeline({ documents = [], onSelectDocument }) {
  if (!documents || documents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm">
        <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p>No previous digitized documents recorded for this patient.</p>
      </div>
    )
  }

  // Group by date
  const groupedByDate = documents.reduce((acc, doc) => {
    const data = doc.confirmedData || doc.extractedData || {}
    const dateKey = data.date || '12 Aug 2026'
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(doc)
    return acc
  }, {})

  const dates = Object.keys(groupedByDate).sort().reverse()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-medical-600" />
          <h3 className="font-bold text-gray-900 text-base">Medical History Timeline</h3>
        </div>
        <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded">
          {documents.length} Digitized Record{documents.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-6 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-gray-200">
        {dates.map((date, idx) => (
          <div key={idx} className="relative pl-7 space-y-3">
            {/* Dot */}
            <div className="absolute left-1 top-1 -translate-x-1/2 w-4 h-4 rounded-full bg-medical-600 ring-4 ring-white" />

            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-xs sm:text-sm">{date}</span>
            </div>

            <div className="space-y-2.5">
              {groupedByDate[date].map((doc) => {
                const isPrescription = doc.type === 'prescription'
                const data = doc.confirmedData || doc.extractedData || {}

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-medical-400 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`p-1 rounded ${isPrescription ? 'bg-sky-100 text-sky-700' : 'bg-teal-100 text-teal-700'}`}>
                          {isPrescription ? <FileText className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <span className="font-bold text-xs text-gray-900 capitalize">
                            {isPrescription ? 'Prescription' : 'Lab Report'}
                          </span>
                          <span className="text-[11px] text-gray-500 block">
                            {data.doctorName || data.labName || 'Clinical Record'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectDocument && onSelectDocument(doc)}
                        className="text-xs text-medical-600 hover:text-medical-800 font-semibold flex items-center gap-0.5"
                      >
                        Inspect <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Prescription Details */}
                    {isPrescription && data.medications && (
                      <div className="pl-6 text-xs text-gray-700 space-y-1">
                        {data.medications.map((m, mIdx) => (
                          <div key={mIdx} className="flex justify-between items-center bg-white px-2 py-1 rounded border border-gray-100">
                            <span className="font-medium text-gray-900">• {m.name}</span>
                            <span className="text-gray-500 font-mono">{m.dosage} — {m.frequency}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Lab Details */}
                    {!isPrescription && data.investigations && (
                      <div className="pl-6 text-xs text-gray-700 space-y-1">
                        {data.investigations.map((inv, invIdx) => (
                          <div key={invIdx} className="flex justify-between items-center bg-white px-2 py-1 rounded border border-gray-100">
                            <span className="font-medium text-gray-900">• {inv.name}</span>
                            <span className="font-bold text-medical-700">{inv.value} {inv.unit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
