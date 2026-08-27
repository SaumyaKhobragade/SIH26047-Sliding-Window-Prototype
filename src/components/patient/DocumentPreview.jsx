import React, { useState } from 'react'
import { X, FileText, FlaskConical, Calendar, Stethoscope, CheckCircle2, Copy, Check, Eye } from 'lucide-react'

export default function DocumentPreview({ document, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('extracted') // 'extracted' | 'ocr' | 'image'
  const [copied, setCopied] = useState(false)

  if (!isOpen || !document) return null

  const isPrescription = document.type === 'prescription'
  const isLabReport = document.type === 'lab_report'
  const data = document.confirmedData || document.extractedData || {}

  const handleCopyOCR = () => {
    if (document.ocrText) {
      navigator.clipboard.writeText(document.ocrText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              {isPrescription ? (
                <FileText className="w-5 h-5 text-sky-400" />
              ) : (
                <FlaskConical className="w-5 h-5 text-teal-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{document.fileName}</h3>
              <p className="text-xs text-gray-400">
                Uploaded: {new Date(document.uploadedAt || Date.now()).toLocaleDateString()} • {document.fileSize || '145 KB'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-2 gap-2 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('extracted')}
            className={`pb-3 px-4 border-b-2 transition-all ${
              activeTab === 'extracted'
                ? 'border-medical-600 text-medical-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Extracted Clinical Data
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`pb-3 px-4 border-b-2 transition-all ${
              activeTab === 'image'
                ? 'border-medical-600 text-medical-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Original Document Preview
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`pb-3 px-4 border-b-2 transition-all ${
              activeTab === 'ocr'
                ? 'border-medical-600 text-medical-700 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Raw OCR Text ({Math.round((document.ocrConfidence || 0.95) * 100)}%)
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {activeTab === 'extracted' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Document Type:</span>
                  <span className="font-bold text-gray-800 capitalize">{document.type?.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Date:</span>
                  <span className="font-bold text-gray-800">{data.date || '12/08/2026'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Doctor / Facility:</span>
                  <span className="font-bold text-gray-800">{data.doctorName || data.labName || 'Dr. Anil Sharma'}</span>
                </div>
              </div>

              {/* Prescription view */}
              {isPrescription && data.medications && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <h4 className="font-bold text-sm text-gray-900">Extracted Medications ({data.medications.length})</h4>
                  <div className="space-y-2">
                    {data.medications.map((m, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between border border-gray-100">
                        <div>
                          <p className="font-bold text-sm text-gray-900">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.timing || 'As instructed by doctor'}</p>
                        </div>
                        <div className="text-right">
                          <span className="bg-medical-100 text-medical-800 text-xs font-bold px-2 py-0.5 rounded mr-2">
                            {m.dosage}
                          </span>
                          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">
                            {m.frequency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab Report view */}
              {isLabReport && data.investigations && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <h4 className="font-bold text-sm text-gray-900">Laboratory Investigations ({data.investigations.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                          <th className="p-2.5">Investigation</th>
                          <th className="p-2.5">Observed Value</th>
                          <th className="p-2.5">Reference Range</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.investigations.map((inv, i) => (
                          <tr key={i}>
                            <td className="p-2.5 font-semibold text-gray-900">{inv.name}</td>
                            <td className="p-2.5 font-bold text-medical-800">{inv.value} {inv.unit}</td>
                            <td className="p-2.5 text-gray-500 font-mono">{inv.referenceRange || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'image' && (
            <div className="flex justify-center items-center bg-gray-900/10 p-4 rounded-xl border border-gray-200 min-h-[400px]">
              {document.previewUrl ? (
                <img
                  src={document.previewUrl}
                  alt={document.fileName}
                  className="max-h-[500px] object-contain rounded-lg shadow-md border border-gray-300 bg-white"
                />
              ) : (
                <div className="text-center text-gray-500 p-8">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Document preview image not available.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ocr' && (
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Raw Optical Character Recognition Output</span>
                <button
                  type="button"
                  onClick={handleCopyOCR}
                  className="flex items-center gap-1 text-xs text-medical-600 hover:text-medical-700 font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Text'}
                </button>
              </div>
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-96">
                {document.ocrText || 'No OCR text extracted.'}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
