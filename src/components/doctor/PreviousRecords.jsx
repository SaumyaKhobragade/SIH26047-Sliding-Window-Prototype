import React, { useState } from 'react'
import { FileText, FlaskConical, Eye, Calendar, Clock, CheckCircle2, ArrowUpRight } from 'lucide-react'
import DocumentPreview from '../patient/DocumentPreview'

export default function PreviousRecords({ documents = [] }) {
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const handleOpenPreview = (doc) => {
    setSelectedDoc(doc)
    setIsPreviewOpen(true)
  }

  const handleClosePreview = () => {
    setIsPreviewOpen(false)
    setSelectedDoc(null)
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm">
        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p>No previous digitized records uploaded.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-medical-600" />
            <h3 className="font-bold text-gray-900 text-base">Previous Records</h3>
          </div>
          <span className="text-xs bg-medical-50 text-medical-700 font-semibold px-2.5 py-0.5 rounded-full border border-medical-200">
            {documents.length} Uploaded Record{documents.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const isPrescription = doc.type === 'prescription'
            const isLabReport = doc.type === 'lab_report'
            const data = doc.confirmedData || doc.extractedData || {}
            const medCount = data.medications?.length || 0
            const invCount = data.investigations?.length || 0

            return (
              <div
                key={doc.id}
                className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-white hover:border-medical-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${isPrescription ? 'bg-sky-100 text-sky-700' : 'bg-teal-100 text-teal-700'}`}>
                      {isPrescription ? <FileText className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 capitalize">
                          {isPrescription ? 'Prescription' : 'Lab Report'}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          • {data.date || '12 Aug 2026'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 font-medium">
                        {isPrescription && `${medCount} medications extracted`}
                        {isLabReport && `${invCount} investigations extracted`}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1 truncate max-w-[200px]">
                        {data.doctorName || data.labName || doc.fileName}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPreview(doc)}
                    className="px-3 py-1.5 bg-white hover:bg-medical-50 text-medical-700 border border-gray-300 hover:border-medical-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Document Inspector Modal */}
      <DocumentPreview
        document={selectedDoc}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
      />
    </>
  )
}
