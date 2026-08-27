import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  FileText,
  Clock,
  CheckCircle,
  User,
  Phone,
  Pill,
  FlaskConical,
  Activity,
  Eye,
  Sparkles,
  Stethoscope,
  Edit3,
  Calendar,
  Layers,
  Heart,
  ShieldCheck,
  Check,
} from 'lucide-react'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import Card from '../../components/Card'
import ClinicalSummarySection from '../../components/ClinicalSummarySection'
import PatientQueue, { defaultMockQueue } from '../../components/doctor/PatientQueue'
import CaseActions from '../../components/doctor/CaseActions'
import CaseEditModal from '../../components/doctor/CaseEditModal'
import PreviousRecords from '../../components/doctor/PreviousRecords'
import MedicalTimeline from '../../components/doctor/MedicalTimeline'
import AyushSummary from '../../components/doctor/AyushSummary'
import DocumentPreview from '../../components/patient/DocumentPreview'
import SourceBadge from '../../components/summary/SourceBadge'
import { usePatient } from '../../context/PatientContext'
import { getCaseSummaryService } from '../../services/caseSummaryService'
import { createEmptyHistory } from '../../data/clinicalSchema'

export default function DoctorDashboardPage() {
  const navigate = useNavigate()
  const { patientHistory, setPatientHistory, updatePatientHistory, resetPatientHistory } = usePatient()
  const caseService = getCaseSummaryService()

  // Selected queue patient
  const [selectedPatient, setSelectedPatient] = useState(defaultMockQueue[0])
  const [inspectingDoc, setInspectingDoc] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isConsultationActive, setIsConsultationActive] = useState(false)

  // Derive current case
  const isRahul = selectedPatient.id === 'ABHA_00001234567890'
  const currentCase = caseService.buildUnifiedCase(patientHistory)
  const caseStatus = patientHistory.caseStatus || currentCase.caseStatus

  // Doctor Action Handlers
  const handleAcceptCase = () => {
    updatePatientHistory('caseStatus', 'reviewed')
  }

  const handleStartConsultation = () => {
    setIsConsultationActive(true)
  }

  const handleOpenEdit = () => {
    setIsEditModalOpen(true)
  }

  const handleSaveEditedCase = (editedFields) => {
    // Update fields in session state
    updatePatientHistory('chiefComplaint', editedFields.chiefComplaint)
    updatePatientHistory('historyOfPresentIllness.onset', editedFields.hpiOnset)
    updatePatientHistory('historyOfPresentIllness.character', editedFields.hpiCharacter)
    updatePatientHistory('historyOfPresentIllness.radiation', editedFields.hpiRadiation)
    updatePatientHistory('historyOfPresentIllness.severity', editedFields.hpiSeverity)
    updatePatientHistory('currentMedications', editedFields.medications)
    updatePatientHistory('pastMedicalHistory', editedFields.pastMedicalHistory)
    updatePatientHistory('ayushAssessment.prakriti', editedFields.ayushPrakriti)
    updatePatientHistory('ayushAssessment.agni', editedFields.ayushAgni)
    updatePatientHistory('ayushAssessment.koshtha', editedFields.ayushKoshtha)
  }

  const handleResetDemo = () => {
    resetPatientHistory()
    setSelectedPatient(defaultMockQueue[0])
    setIsConsultationActive(false)
  }

  const hpi = currentCase.clinicalHistory?.hpi || {}
  const isAyushMode = currentCase.patient?.clinicalMode === 'ayush' || Boolean(currentCase.ayushAssessment?.prakriti)

  return (
    <>
      <Header title="MediKiosk Doctor Clinical Workstation" />
      <PageContainer>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12">
          {/* LEFT COLUMN: Patient Queue (3 cols) */}
          <div className="lg:col-span-3">
            <PatientQueue
              selectedPatientId={selectedPatient.id}
              onSelectPatient={(p) => {
                setSelectedPatient(p)
                setIsConsultationActive(false)
              }}
              onResetDemo={handleResetDemo}
              caseStatus={caseStatus}
            />
          </div>

          {/* CENTER COLUMN: Complete Structured Case (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Consultation Active Alert */}
            {isConsultationActive && (
              <div className="bg-medical-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-white animate-ping" />
                  <div>
                    <h4 className="font-bold text-sm">Consultation Active</h4>
                    <p className="text-xs text-medical-100">Reviewing {currentCase.patient.name}'s verified intake record</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Prescription & Consultation summary generated!')}
                  className="px-3.5 py-1.5 bg-white text-medical-700 hover:bg-medical-50 text-xs font-bold rounded-lg shadow-sm"
                >
                  Complete Consultation
                </button>
              </div>
            )}

            {/* Case Header Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-gray-900">{selectedPatient.name}</h2>
                    <span className="text-xs text-gray-500 font-semibold">• {selectedPatient.age}y / {selectedPatient.gender}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">ABHA ID: {selectedPatient.id}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                    caseStatus === 'reviewed'
                      ? 'bg-success-100 text-success-800 border-success-300'
                      : selectedPatient.redFlags
                      ? 'bg-danger-100 text-danger-800 border-danger-300 animate-pulse'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {caseStatus === 'reviewed' ? '✓ Case Reviewed' : selectedPatient.redFlags ? '🔴 Priority Triage' : 'AI Draft'}
                  </span>

                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    isAyushMode ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>
                    {isAyushMode ? 'Ayurveda / AYUSH' : 'Allopathy'}
                  </span>
                </div>
              </div>

              {/* Red Flag Alert */}
              {selectedPatient.redFlags && (
                <div className="mb-4 bg-danger-50 border-l-4 border-danger-600 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-danger-900 text-xs sm:text-sm">
                      ⚠️ Potential Red-Flag Symptoms Detected
                    </h4>
                    <p className="text-xs text-danger-800 mt-1 font-medium leading-relaxed">
                      Shortness of breath reported in conjunction with central pressure chest pain. Risk profile flagged for acute cardiac triage evaluation.
                    </p>
                  </div>
                </div>
              )}

              {/* AI Clinical Narrative Summary */}
              <div className="bg-gradient-to-r from-medical-50/70 to-blue-50/70 p-4 rounded-xl border border-medical-200 text-xs leading-relaxed text-medical-950">
                <span className="font-bold text-medical-900 block mb-1">AI Clinical Intake Synthesis:</span>
                <p>{currentCase.clinicalNarrative}</p>
              </div>
            </div>

            {/* Case Overview & HPI */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                  Clinical History (HPI)
                </h3>
                <SourceBadge source="Patient Interview" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-gray-500 block mb-0.5">Chief Complaint:</span>
                  <span className="font-bold text-gray-900 text-sm">{currentCase.chiefComplaint}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-gray-500 block mb-0.5">Onset / Duration:</span>
                  <span className="font-bold text-gray-900 text-sm">{hpi.onset}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-gray-500 block mb-0.5">Pain Character:</span>
                  <span className="font-bold text-gray-900 text-sm">{hpi.character}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-gray-500 block mb-0.5">Radiation:</span>
                  <span className="font-bold text-gray-900 text-sm">{hpi.radiation}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-gray-500 block mb-1 font-semibold">Aggravating / Relieving Factors:</span>
                  <p className="text-gray-800">
                    Aggravating: <strong className="text-gray-900">{(hpi.aggravatingFactors || ['Exertion']).join(', ')}</strong> • Relieving: <strong className="text-gray-900">{(hpi.relievingFactors || ['None with rest']).join(', ')}</strong>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1 font-semibold">Associated Symptoms:</span>
                  <p className="text-gray-800 font-bold">
                    {(hpi.associatedSymptoms || ['Shortness of breath', 'Mild perspiration']).join(', ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Medical History & Current Medications */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-medical-600" />
                  <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                    Medications &amp; Past Conditions
                  </h3>
                </div>
                <span className="text-xs font-semibold text-gray-500">Cross-Referenced</span>
              </div>

              {/* Past History */}
              <div className="text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Past Medical History:</span>
                <div className="flex flex-wrap gap-2">
                  {currentCase.clinicalHistory.pastMedicalHistory.map((item, i) => (
                    <span key={i} className="bg-gray-100 text-gray-800 font-semibold px-2.5 py-1 rounded-lg border border-gray-200">
                      {typeof item === 'string' ? item : item.condition}
                    </span>
                  ))}
                </div>
              </div>

              {/* Medications List */}
              <div className="space-y-2 pt-2">
                <span className="text-gray-500 font-bold uppercase tracking-wider block text-xs mb-1.5">Active Medications:</span>
                {currentCase.medications.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-sky-50/60 rounded-xl border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{med.name}</span>
                        <span className="bg-sky-200 text-sky-900 font-bold px-2 py-0.5 rounded text-[11px]">
                          {med.dosage}
                        </span>
                        <span className="bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {med.frequency}
                        </span>
                      </div>
                      {med.timing && <p className="text-gray-600 mt-0.5">{med.timing}</p>}
                    </div>

                    <SourceBadge source={med.source} />
                  </div>
                ))}
              </div>
            </div>

            {/* AYUSH ASSESSMENT (STEP 4 & 5 INTEGRATION) */}
            {isAyushMode && (
              <AyushSummary ayushAssessment={currentCase.ayushAssessment} />
            )}

            {/* PREVIOUS RECORDS & OCR INSPECTION (STEP 3 & 5) */}
            <PreviousRecords documents={currentCase.documents} />

            {/* DYNAMIC MEDICAL HISTORY TIMELINE */}
            <MedicalTimeline
              documents={currentCase.documents}
              onSelectDocument={(doc) => setInspectingDoc(doc)}
            />

            {/* PREVIOUS LABORATORY INVESTIGATIONS TABLE */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-teal-600" />
                  <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                    Laboratory Investigations Summary
                  </h3>
                </div>
                <SourceBadge source="Laboratory Report (12 Aug 2026)" />
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3">Investigation</th>
                      <th className="p-3">Result</th>
                      <th className="p-3">Reference Range</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {currentCase.investigations.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 font-semibold text-gray-900">{inv.name}</td>
                        <td className="p-3 font-bold text-medical-900">{inv.value} {inv.unit}</td>
                        <td className="p-3 text-gray-500 font-mono">{inv.referenceRange || '—'}</td>
                        <td className="p-3 text-gray-500">{inv.date || '12/08/2026'}</td>
                        <td className="p-3">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            inv.status === 'Normal' ? 'bg-success-100 text-success-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {inv.status || 'Reported'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Doctor Actions & Case Governance (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <CaseActions
              caseStatus={caseStatus}
              onAcceptCase={handleAcceptCase}
              onEditCase={handleOpenEdit}
              onStartConsultation={handleStartConsultation}
              isConsultationActive={isConsultationActive}
            />

            {/* Quick Diagnostic Triage Guidance */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3 text-xs text-gray-700">
              <div className="flex items-center gap-2 font-bold text-gray-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Clinical Triage Checklist</span>
              </div>
              <ul className="space-y-1.5 text-gray-600">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-success-600 flex-shrink-0 mt-0.5" />
                  <span>Pre-consultation history complete</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-success-600 flex-shrink-0 mt-0.5" />
                  <span>Prescription &amp; labs digitized</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-success-600 flex-shrink-0 mt-0.5" />
                  <span>AYUSH Dashavidha Pariksha recorded</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-danger-600 flex-shrink-0 mt-0.5" />
                  <span className="text-danger-800 font-semibold">Priority chest pain triage</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Case Edit Modal */}
      <CaseEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialCase={currentCase}
        onSave={handleSaveEditedCase}
      />

      {/* Document Inspector Modal */}
      <DocumentPreview
        document={inspectingDoc}
        isOpen={Boolean(inspectingDoc)}
        onClose={() => setInspectingDoc(null)}
      />
    </>
  )
}
