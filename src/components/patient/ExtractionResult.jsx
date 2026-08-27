import React, { useState } from 'react'
import { CheckCircle2, Edit3, Plus, Trash2, ShieldCheck, AlertCircle, FileText, Calendar, UserCheck, Stethoscope } from 'lucide-react'

export default function ExtractionResult({ document, onConfirm, onCancel }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState(() => JSON.parse(JSON.stringify(document.extractedData || {})))

  const isPrescription = document.type === 'prescription'
  const isLabReport = document.type === 'lab_report'

  // Medication handlers for prescription
  const handleMedicationChange = (index, field, value) => {
    setEditedData((prev) => {
      const updated = { ...prev }
      const meds = [...(updated.medications || [])]
      meds[index] = { ...meds[index], [field]: value }
      updated.medications = meds
      return updated
    })
  }

  const handleAddMedication = () => {
    setEditedData((prev) => ({
      ...prev,
      medications: [
        ...(prev.medications || []),
        { name: '', dosage: '', frequency: '1-0-0', timing: '', duration: '', source: 'Previous Prescription' },
      ],
    }))
    setIsEditing(true)
  }

  const handleRemoveMedication = (index) => {
    setEditedData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }))
  }

  // Investigation handlers for lab report
  const handleInvestigationChange = (index, field, value) => {
    setEditedData((prev) => {
      const updated = { ...prev }
      const invs = [...(updated.investigations || [])]
      invs[index] = { ...invs[index], [field]: value }
      updated.investigations = invs
      return updated
    })
  }

  const handleAddInvestigation = () => {
    setEditedData((prev) => ({
      ...prev,
      investigations: [
        ...(prev.investigations || []),
        { name: '', value: '', unit: '', referenceRange: '', status: 'Unspecified', source: 'Previous Lab Report' },
      ],
    }))
    setIsEditing(true)
  }

  const handleRemoveInvestigation = (index) => {
    setEditedData((prev) => ({
      ...prev,
      investigations: prev.investigations.filter((_, i) => i !== index),
    }))
  }

  const handleConfirm = () => {
    onConfirm(editedData)
  }

  return (
    <div className="bg-white border-2 border-medical-500 rounded-xl shadow-lg overflow-hidden animate-fade-in">
      {/* Header Banner */}
      <div className="bg-medical-50 border-b border-medical-100 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 capitalize">
                {isPrescription ? 'Prescription' : isLabReport ? 'Laboratory Report' : 'Document'} Processed
              </h3>
              <span className="bg-success-100 text-success-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-success-200">
                OCR Confidence: {Math.round((document.ocrConfidence || 0.95) * 100)}%
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Review extracted medical information below before saving to your clinical record.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isEditing
              ? 'bg-medical-600 text-white border-medical-600 shadow-sm'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          {isEditing ? 'Done Editing' : 'Edit Details'}
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Document Meta Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-lg border border-gray-200 text-xs">
          <div>
            <span className="text-gray-500 block mb-0.5">Document Date:</span>
            {isEditing ? (
              <input
                type="text"
                value={editedData.date || ''}
                onChange={(e) => setEditedData({ ...editedData, date: e.target.value })}
                className="w-full px-2 py-1 bg-white border border-gray-300 rounded font-semibold text-gray-900"
                placeholder="YYYY-MM-DD or DD/MM/YYYY"
              />
            ) : (
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-medical-600" />
                {editedData.date || '12 August 2026'}
              </span>
            )}
          </div>

          <div>
            <span className="text-gray-500 block mb-0.5">
              {isPrescription ? 'Doctor / Clinic:' : 'Lab / Facility:'}
            </span>
            {isEditing ? (
              <input
                type="text"
                value={editedData.doctorName || editedData.labName || ''}
                onChange={(e) =>
                  setEditedData({
                    ...editedData,
                    [isPrescription ? 'doctorName' : 'labName']: e.target.value,
                  })
                }
                className="w-full px-2 py-1 bg-white border border-gray-300 rounded font-semibold text-gray-900"
                placeholder="Facility or Doctor Name"
              />
            ) : (
              <span className="font-bold text-gray-900 flex items-center gap-1.5 truncate">
                <Stethoscope className="w-3.5 h-3.5 text-medical-600" />
                {editedData.doctorName || editedData.labName || 'Dr. Anil Sharma (City Care Clinic)'}
              </span>
            )}
          </div>

          <div>
            <span className="text-gray-500 block mb-0.5">Patient Record:</span>
            <span className="font-bold text-gray-900 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-medical-600" />
              {editedData.patientName || 'Rahul Sharma (42 / M)'}
            </span>
          </div>
        </div>

        {/* Prescription: Extracted Medications List */}
        {isPrescription && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-medical-600" />
                Identified Medications ({editedData.medications?.length || 0})
              </h4>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center gap-1 text-xs font-semibold text-medical-600 hover:text-medical-700 bg-medical-50 px-2.5 py-1 rounded border border-medical-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Medication
                </button>
              )}
            </div>

            <div className="space-y-3">
              {editedData.medications?.map((med, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-gray-200 bg-white hover:border-medical-300 transition-colors shadow-sm"
                >
                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Medication Name</label>
                        <input
                          type="text"
                          value={med.name || ''}
                          onChange={(e) => handleMedicationChange(idx, 'name', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-bold"
                          placeholder="e.g. Amlodipine"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Dosage</label>
                        <input
                          type="text"
                          value={med.dosage || ''}
                          onChange={(e) => handleMedicationChange(idx, 'dosage', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          placeholder="e.g. 5 mg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Frequency</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={med.frequency || ''}
                            onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                            placeholder="e.g. 1-0-0 or SOS"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(idx)}
                            className="p-1.5 text-danger-500 hover:bg-danger-50 rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h5 className="font-bold text-gray-900 text-base">{med.name}</h5>
                          <span className="bg-medical-100 text-medical-800 text-xs font-bold px-2 py-0.5 rounded">
                            {med.dosage}
                          </span>
                          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">
                            {med.frequency}
                          </span>
                        </div>
                        {med.timing && (
                          <p className="text-xs text-gray-600 mt-1">
                            Timing: <span className="font-medium text-gray-800">{med.timing}</span>
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">
                        Prescription Source
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lab Report: Extracted Investigations Table */}
        {isLabReport && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-medical-600" />
                Extracted Laboratory Results ({editedData.investigations?.length || 0})
              </h4>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddInvestigation}
                  className="flex items-center gap-1 text-xs font-semibold text-medical-600 hover:text-medical-700 bg-medical-50 px-2.5 py-1 rounded border border-medical-200"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Test
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Test Name</th>
                    <th className="px-4 py-3">Observed Result</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Reference Range</th>
                    {isEditing && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {editedData.investigations?.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={inv.name || ''}
                            onChange={(e) => handleInvestigationChange(idx, 'name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-semibold"
                          />
                        ) : (
                          inv.name
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-medical-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={inv.value || ''}
                            onChange={(e) => handleInvestigationChange(idx, 'value', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs font-bold"
                          />
                        ) : (
                          <span>{inv.value}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={inv.unit || ''}
                            onChange={(e) => handleInvestigationChange(idx, 'unit', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          inv.unit
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            value={inv.referenceRange || ''}
                            onChange={(e) => handleInvestigationChange(idx, 'referenceRange', e.target.value)}
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                          />
                        ) : (
                          inv.referenceRange || '—'
                        )}
                      </td>
                      {isEditing && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveInvestigation(idx)}
                            className="p-1 text-danger-500 hover:bg-danger-50 rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Safety Disclaimer Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5 text-xs text-blue-900">
          <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p>
            <span className="font-bold">Patient Confirmation:</span> By confirming, these digitized records will be added to your current consultation session and made available in the clinical summary for your doctor's review.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-semibold transition-all"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-success-600 hover:bg-success-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm &amp; Save Information
          </button>
        </div>
      </div>
    </div>
  )
}
