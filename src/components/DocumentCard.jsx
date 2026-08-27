import React from 'react'
import { FileText, FlaskConical, CheckCircle2, Clock, Eye, AlertCircle, Trash2 } from 'lucide-react'

export default function DocumentCard({ document, onView, onReview, onDelete }) {
  const isPrescription = document.type === 'prescription'
  const isLabReport = document.type === 'lab_report'
  const isConfirmed = document.status === 'confirmed'
  const isReviewPending = document.status === 'review_pending'
  const isProcessing = document.status === 'processing' || document.status === 'uploading'

  const data = document.confirmedData || document.extractedData || {}
  const medCount = data.medications?.length || 0
  const invCount = data.investigations?.length || 0

  return (
    <div className={`bg-white rounded-xl border transition-all p-4 shadow-sm ${
      isReviewPending
        ? 'border-amber-400 ring-2 ring-amber-100'
        : isConfirmed
        ? 'border-gray-200 hover:border-medical-400'
        : 'border-gray-200'
    }`}>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Thumbnail Preview */}
        <div className="w-full sm:w-28 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-center relative group">
          {document.previewUrl ? (
            <img
              src={document.previewUrl}
              alt={document.fileName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="text-gray-400 text-center p-2">
              {isPrescription ? <FileText className="w-8 h-8 mx-auto" /> : <FlaskConical className="w-8 h-8 mx-auto" />}
              <span className="text-[10px] block mt-1">Preview</span>
            </div>
          )}

          {/* Quick Preview Hover Action */}
          <button
            type="button"
            onClick={() => onView && onView(document)}
            className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold gap-1"
          >
            <Eye className="w-4 h-4" /> View
          </button>
        </div>

        {/* Content Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={`p-1 rounded ${isPrescription ? 'bg-sky-100 text-sky-700' : 'bg-teal-100 text-teal-700'}`}>
                  {isPrescription ? <FileText className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
                </span>
                <h4 className="font-bold text-gray-900 text-sm truncate max-w-[240px] sm:max-w-md">
                  {document.fileName}
                </h4>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isPrescription ? 'Prescription' : 'Laboratory Report'} • Date: {data.date || '12 Aug 2026'}
              </p>
            </div>

            {/* Status Pill */}
            <div>
              {isConfirmed && (
                <span className="inline-flex items-center gap-1 bg-success-50 text-success-700 border border-success-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                </span>
              )}
              {isReviewPending && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Review Pending
                </span>
              )}
              {isProcessing && (
                <span className="inline-flex items-center gap-1 bg-medical-50 text-medical-700 border border-medical-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Processing...
                </span>
              )}
            </div>
          </div>

          {/* Extracted Highlights */}
          <div className="mt-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-xs text-gray-700">
            {isPrescription && medCount > 0 && (
              <p className="font-medium">
                ✓ <span className="font-bold text-gray-900">{medCount} medications identified:</span>{' '}
                {data.medications?.map((m) => `${m.name} (${m.dosage})`).join(', ')}
              </p>
            )}
            {isLabReport && invCount > 0 && (
              <p className="font-medium">
                ✓ <span className="font-bold text-gray-900">{invCount} investigations extracted:</span>{' '}
                {data.investigations?.map((inv) => `${inv.name}: ${inv.value} ${inv.unit}`).join(' | ')}
              </p>
            )}
          </div>

          {/* Action Row */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onView && onView(document)}
                className="text-xs font-semibold text-medical-600 hover:text-medical-800 hover:underline flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> View Extracted Information
              </button>

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(document.id)}
                  className="text-xs text-gray-400 hover:text-danger-600 p-1 transition-colors"
                  title="Remove document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isReviewPending && onReview && (
              <button
                type="button"
                onClick={() => onReview(document)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
              >
                Review &amp; Confirm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
