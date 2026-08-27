import React, { useState } from 'react'
import { X, Save, Plus, Trash2, Edit3, ShieldAlert } from 'lucide-react'

export default function CaseEditModal({ isOpen, onClose, initialCase, onSave }) {
  if (!isOpen || !initialCase) return null

  const [formData, setFormData] = useState(() => {
    return {
      chiefComplaint: initialCase.chiefComplaint || '',
      hpiOnset: initialCase.clinicalHistory?.hpi?.onset || '',
      hpiCharacter: initialCase.clinicalHistory?.hpi?.character || '',
      hpiRadiation: initialCase.clinicalHistory?.hpi?.radiation || '',
      hpiSeverity: initialCase.clinicalHistory?.hpi?.severity || '7',
      hpiAssociated: (initialCase.clinicalHistory?.hpi?.associatedSymptoms || []).join(', '),
      pastMedicalHistory: Array.isArray(initialCase.clinicalHistory?.pastMedicalHistory)
        ? [...initialCase.clinicalHistory.pastMedicalHistory]
        : [],
      medications: Array.isArray(initialCase.medications)
        ? initialCase.medications.map((m) => ({ ...m }))
        : [],
      ayushPrakriti: initialCase.ayushAssessment?.prakriti || 'Pitta',
      ayushAgni: initialCase.ayushAssessment?.agni || 'Irregular',
      ayushKoshtha: initialCase.ayushAssessment?.koshtha || 'Sometimes irregular',
    }
  })

  // Medication handlers
  const handleMedChange = (index, field, val) => {
    const meds = [...formData.medications]
    meds[index] = { ...meds[index], [field]: val }
    setFormData({ ...formData, medications: meds })
  }

  const handleAddMed = () => {
    setFormData({
      ...formData,
      medications: [
        ...formData.medications,
        { name: '', dosage: '', frequency: 'Once daily', source: 'Physician Added' },
      ],
    })
  }

  const handleRemoveMed = (index) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter((_, i) => i !== index),
    })
  }

  // Past History handlers
  const handlePastHistoryChange = (index, val) => {
    const list = [...formData.pastMedicalHistory]
    list[index] = val
    setFormData({ ...formData, pastMedicalHistory: list })
  }

  const handleAddPastHistory = () => {
    setFormData({
      ...formData,
      pastMedicalHistory: [...formData.pastMedicalHistory, ''],
    })
  }

  const handleRemovePastHistory = (index) => {
    setFormData({
      ...formData,
      pastMedicalHistory: formData.pastMedicalHistory.filter((_, i) => i !== index),
    })
  }

  const handleSave = () => {
    onSave(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-medical-400" />
            <h3 className="font-bold text-base text-white">Edit Clinical Case — {initialCase.patient?.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 text-xs sm:text-sm">
          {/* Chief Complaint */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
            <label className="block font-bold text-gray-800 text-xs uppercase tracking-wider">
              Chief Complaint
            </label>
            <input
              type="text"
              value={formData.chiefComplaint}
              onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:border-medical-600"
            />
          </div>

          {/* History of Present Illness (HPI) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <label className="block font-bold text-gray-800 text-xs uppercase tracking-wider">
              History of Present Illness (HPI) Parameters
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-gray-500 block mb-1 text-xs">Onset:</span>
                <input
                  type="text"
                  value={formData.hpiOnset}
                  onChange={(e) => setFormData({ ...formData, hpiOnset: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-1 text-xs">Character:</span>
                <input
                  type="text"
                  value={formData.hpiCharacter}
                  onChange={(e) => setFormData({ ...formData, hpiCharacter: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-1 text-xs">Radiation:</span>
                <input
                  type="text"
                  value={formData.hpiRadiation}
                  onChange={(e) => setFormData({ ...formData, hpiRadiation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-1 text-xs">Severity (1-10):</span>
                <input
                  type="text"
                  value={formData.hpiSeverity}
                  onChange={(e) => setFormData({ ...formData, hpiSeverity: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Current Medications */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-800 text-xs uppercase tracking-wider">
                Current Medications ({formData.medications.length})
              </label>
              <button
                type="button"
                onClick={handleAddMed}
                className="text-xs text-medical-600 hover:text-medical-800 font-bold flex items-center gap-1 bg-medical-50 px-2.5 py-1 rounded border border-medical-200"
              >
                <Plus className="w-3.5 h-3.5" /> Add Drug
              </button>
            </div>

            <div className="space-y-2">
              {formData.medications.map((med, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={med.name || ''}
                    onChange={(e) => handleMedChange(idx, 'name', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Dosage"
                    value={med.dosage || ''}
                    onChange={(e) => handleMedChange(idx, 'dosage', e.target.value)}
                    className="w-24 px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Frequency"
                    value={med.frequency || ''}
                    onChange={(e) => handleMedChange(idx, 'frequency', e.target.value)}
                    className="w-24 px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMed(idx)}
                    className="p-1.5 text-danger-500 hover:bg-danger-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Past Medical History */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-800 text-xs uppercase tracking-wider">
                Past Medical History
              </label>
              <button
                type="button"
                onClick={handleAddPastHistory}
                className="text-xs text-medical-600 hover:text-medical-800 font-bold flex items-center gap-1 bg-medical-50 px-2.5 py-1 rounded border border-medical-200"
              >
                <Plus className="w-3.5 h-3.5" /> Add Condition
              </button>
            </div>

            <div className="space-y-2">
              {formData.pastMedicalHistory.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={typeof item === 'string' ? item : item.condition || ''}
                    onChange={(e) => handlePastHistoryChange(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePastHistory(idx)}
                    className="p-1.5 text-danger-500 hover:bg-danger-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* AYUSH Assessment Parameters */}
          <div className="bg-white p-4 rounded-xl border border-emerald-300 space-y-3">
            <label className="block font-bold text-emerald-900 text-xs uppercase tracking-wider">
              AYUSH Parameters (Physician Verified)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-gray-500 block mb-1 text-xs">Prakriti:</span>
                <input
                  type="text"
                  value={formData.ayushPrakriti}
                  onChange={(e) => setFormData({ ...formData, ayushPrakriti: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs font-bold"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-1 text-xs">Agni:</span>
                <input
                  type="text"
                  value={formData.ayushAgni}
                  onChange={(e) => setFormData({ ...formData, ayushAgni: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs font-bold"
                />
              </div>
              <div>
                <span className="text-gray-500 block mb-1 text-xs">Koshtha:</span>
                <input
                  type="text"
                  value={formData.ayushKoshtha}
                  onChange={(e) => setFormData({ ...formData, ayushKoshtha: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-medical-600 hover:bg-medical-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" /> Save Case Updates
          </button>
        </div>
      </div>
    </div>
  )
}
