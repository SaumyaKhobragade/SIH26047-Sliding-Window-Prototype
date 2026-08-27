import React, { useState, useRef } from 'react'
import { Upload, FileText, FlaskConical, FileCheck2, AlertCircle, Sparkles, Loader2 } from 'lucide-react'

export default function DocumentUploader({ onProcessDocument, isProcessing, processingStatus, processingStep }) {
  const [selectedType, setSelectedType] = useState('prescription')
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    setErrorMessage('')
    const file = e.target.files?.[0]
    if (file) {
      processFile(file, selectedType)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setErrorMessage('')
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0], selectedType)
    }
  }

  const processFile = async (file, type) => {
    try {
      setErrorMessage('')
      await onProcessDocument(file, type)
    } catch (err) {
      setErrorMessage(err.message || 'We could not reliably read this document. Please try uploading a clearer image.')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleLoadDemo = async (type) => {
    try {
      setErrorMessage('')
      setSelectedType(type)
      await onProcessDocument({ isDemo: true }, type)
    } catch (err) {
      setErrorMessage(err.message || 'Error loading demo document.')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-medical-600 to-medical-700 p-6 text-white">
        <h2 className="text-xl font-bold mb-1">Previous Medical Records</h2>
        <p className="text-medical-100 text-sm">
          Upload your previous prescriptions and laboratory test reports to automatically digitize and build your clinical history timeline.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Document Type Selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Document Type to Upload:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSelectedType('prescription')}
              disabled={isProcessing}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selectedType === 'prescription'
                  ? 'border-medical-600 bg-medical-50 text-medical-900 shadow-sm'
                  : 'border-gray-200 hover:border-medical-300 text-gray-700'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${selectedType === 'prescription' ? 'bg-medical-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm">Prescription</p>
                <p className="text-xs text-gray-500">Doctor Rx &amp; Medicines</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('lab_report')}
              disabled={isProcessing}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                selectedType === 'lab_report'
                  ? 'border-medical-600 bg-medical-50 text-medical-900 shadow-sm'
                  : 'border-gray-200 hover:border-medical-300 text-gray-700'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${selectedType === 'lab_report' ? 'bg-medical-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <FlaskConical className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm">Lab Report</p>
                <p className="text-xs text-gray-500">Blood, Urine, Biochemistry</p>
              </div>
            </button>

            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-80">
              <div className="p-2.5 rounded-lg bg-gray-200 text-gray-400">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-gray-500">Discharge Summary</p>
                </div>
                <span className="inline-block text-[10px] uppercase tracking-wider bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-semibold mt-0.5">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-danger-50 border-l-4 border-danger-500 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-danger-900">Upload Issue</p>
              <p className="text-xs text-danger-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Drag & Drop Upload Zone */}
        {!isProcessing ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? 'border-medical-600 bg-medical-50 ring-4 ring-medical-100'
                : 'border-gray-300 hover:border-medical-400 bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileChange}
              className="hidden"
              id="medical-doc-upload"
            />

            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-medical-100 flex items-center justify-center text-medical-600">
                <Upload className="w-7 h-7" />
              </div>
            </div>

            <h3 className="text-base font-bold text-gray-900 mb-1">
              Upload your {selectedType === 'prescription' ? 'Prescription' : 'Lab Report'}
            </h3>
            <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">
              Drag and drop your document here, or browse from your device. Supported formats: JPG, PNG, WEBP, PDF (Max 10MB).
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <label
                htmlFor="medical-doc-upload"
                className="px-5 py-2.5 bg-medical-600 hover:bg-medical-700 text-white rounded-lg font-semibold text-sm cursor-pointer shadow-sm transition-all"
              >
                📁 Select File from Device
              </label>

              <button
                type="button"
                onClick={() => handleLoadDemo(selectedType)}
                className="px-5 py-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                Load Sample {selectedType === 'prescription' ? 'Prescription' : 'Lab Report'}
              </button>
            </div>
          </div>
        ) : (
          /* Processing State Animation */
          <div className="border-2 border-medical-200 bg-medical-50/60 rounded-xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-medical-200 border-t-medical-600 animate-spin flex items-center justify-center" />
                <Loader2 className="w-8 h-8 text-medical-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-medical-900 mb-2">
              Digitizing Medical Document
            </h3>
            <p className="text-sm font-medium text-medical-700 mb-4">
              {processingStatus || 'Processing document...'}
            </p>

            {/* Stepper Pill Indicators */}
            <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
              <div className={`h-2 flex-1 rounded-full transition-all duration-300 ${processingStep >= 1 ? 'bg-medical-600' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded-full transition-all duration-300 ${processingStep >= 2 ? 'bg-medical-600' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded-full transition-all duration-300 ${processingStep >= 3 ? 'bg-medical-600' : 'bg-gray-200'}`} />
              <div className={`h-2 flex-1 rounded-full transition-all duration-300 ${processingStep >= 4 ? 'bg-medical-600' : 'bg-gray-200'}`} />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 max-w-sm mx-auto mt-1.5 px-1">
              <span>Upload</span>
              <span>OCR</span>
              <span>Extraction</span>
              <span>Review</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
