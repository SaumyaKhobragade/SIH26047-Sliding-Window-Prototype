import React from 'react'
import { Calendar, FileText, FlaskConical, Stethoscope, Activity, CheckCircle2 } from 'lucide-react'

export default function DocumentTimeline({ documents = [] }) {
  if (!documents || documents.length === 0) {
    return null
  }

  // Group confirmed or extracted documents by date
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
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-medical-600" />
        <h3 className="text-base font-bold text-gray-900">Medical History Timeline</h3>
        <span className="text-xs bg-medical-50 text-medical-700 px-2 py-0.5 rounded font-semibold border border-medical-200">
          Chronological Summary
        </span>
      </div>

      <div className="space-y-8 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-medical-200">
        {dates.map((date, dateIdx) => (
          <div key={dateIdx} className="relative pl-8 space-y-4">
            {/* Timeline Node Icon */}
            <div className="absolute left-1.5 top-0.5 -translate-x-1/2 w-6 h-6 rounded-full bg-medical-600 text-white flex items-center justify-center shadow-sm ring-4 ring-white">
              <Calendar className="w-3.5 h-3.5" />
            </div>

            {/* Date Heading */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">{date}</span>
              <span className="text-xs text-gray-400">
                ({groupedByDate[date].length} record{groupedByDate[date].length > 1 ? 's' : ''})
              </span>
            </div>

            {/* Grouped Documents under this date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedByDate[date].map((doc) => {
                const isPrescription = doc.type === 'prescription'
                const data = doc.confirmedData || doc.extractedData || {}

                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`p-1.5 rounded-lg ${isPrescription ? 'bg-sky-100 text-sky-700' : 'bg-teal-100 text-teal-700'}`}>
                        {isPrescription ? <FileText className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wide">
                          {isPrescription ? 'Prescription' : 'Laboratory Report'}
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          {data.doctorName || data.labName || 'Medical Facility'}
                        </p>
                      </div>
                    </div>

                    {/* Prescription Item List */}
                    {isPrescription && data.medications && (
                      <ul className="space-y-1.5 text-xs text-gray-700">
                        {data.medications.map((m, idx) => (
                          <li key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-gray-100">
                            <span className="font-semibold text-gray-900">• {m.name}</span>
                            <span className="text-gray-500 font-mono">{m.dosage} ({m.frequency})</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Lab Report Item List */}
                    {!isPrescription && data.investigations && (
                      <ul className="space-y-1.5 text-xs text-gray-700">
                        {data.investigations.map((inv, idx) => (
                          <li key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-gray-100">
                            <span className="font-semibold text-gray-900">• {inv.name}</span>
                            <span className="text-medical-700 font-bold">{inv.value} {inv.unit}</span>
                          </li>
                        ))}
                      </ul>
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
