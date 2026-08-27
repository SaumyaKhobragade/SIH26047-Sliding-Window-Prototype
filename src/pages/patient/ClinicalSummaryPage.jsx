import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Heart,
  Pill,
  FlaskConical,
  FileText,
  Calendar,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Utensils,
  Eye,
  ArrowLeft,
  Send,
  Edit3,
  Check,
} from 'lucide-react'
import Button from '../../components/Button'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import Card from '../../components/Card'
import ClinicalSummarySection from '../../components/ClinicalSummarySection'
import ProgressIndicator from '../../components/ProgressIndicator'
import DocumentTimeline from '../../components/patient/DocumentTimeline'
import DocumentPreview from '../../components/patient/DocumentPreview'
import SourceBadge from '../../components/summary/SourceBadge'
import { usePatient } from '../../context/PatientContext'
import { getCaseSummaryService } from '../../services/caseSummaryService'
import {
  formatPrakriti,
  formatAgni,
  formatKoshtha,
  formatAharaShakti,
  formatVyayamaShakti,
  formatAharaVihara,
} from '../../utils/ayushFormatter'

export default function PatientSummaryPage() {
  const navigate = useNavigate()
  const { patientHistory, updatePatientHistory } = usePatient()
  const caseService = getCaseSummaryService()

  const [previewDoc, setPreviewDoc] = useState(null)
  const [isSent, setIsSent] = useState(false)

  // Build unified case derived from state
  const unifiedCase = caseService.buildUnifiedCase(patientHistory)
  const isAyushMode = localStorage.getItem('selectedClinicalMode') === 'ayush' || Boolean(unifiedCase.ayushAssessment?.prakriti)

  const handleSendToDoctor = () => {
    // Mark status as ready/priority in session
    updatePatientHistory('caseStatus', unifiedCase.redFlags.length > 0 ? 'priority' : 'ready')
    setIsSent(true)

    // Smooth transition to Doctor Dashboard
    setTimeout(() => {
      navigate('/doctor')
    }, 1200)
  }

  const handleBack = () => {
    if (isAyushMode) {
      navigate('/patient/ayush')
    } else {
      navigate('/patient/documents')
    }
  }

  const handleEditInformation = () => {
    navigate('/patient/history')
  }

  const hpi = unifiedCase.clinicalHistory.hpi || {}
  const aharaVihara = formatAharaVihara(unifiedCase.ayushAssessment?.aharaVihara)

  return (
    <>
      <Header title="Clinical Intake Case Summary" onBack={handleBack} />
      <ProgressIndicator
        currentStep={6}
        totalSteps={7}
        labels={['Welcome', 'Consent', 'Profile', 'History', 'Documents', 'AYUSH', 'Summary']}
      />

      <PageContainer>
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
          {/* AI-Generated Draft Notice */}
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-l-4 border-warning-500 rounded-xl p-5 shadow-xs flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">AI-Generated Clinical Case Draft</h3>
                <span className="bg-warning-100 text-warning-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-warning-300">
                  Pre-Consultation Intake
                </span>
              </div>
              <p className="text-gray-700 text-xs sm:text-sm mt-1 leading-relaxed">
                This case organizes your conversational interview, uploaded records, and Ayurvedic parameters. Your physician will review, verify, and validate all information before consultation.
              </p>
            </div>
          </div>

          {/* SECTION 1: PATIENT INFORMATION */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
              <Heart className="w-5 h-5 text-medical-600" />
              <h3 className="font-bold text-gray-900 text-base uppercase tracking-wider">Patient Information</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-gray-500 text-xs block">Patient Name</span>
                <span className="font-bold text-gray-900 text-base">{unifiedCase.patient.name}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Age / Gender</span>
                <span className="font-bold text-gray-900">{unifiedCase.patient.age} years • {unifiedCase.patient.gender}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Patient ID (ABHA)</span>
                <span className="font-mono font-bold text-medical-600">{unifiedCase.patient.abhaId}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Clinical Mode</span>
                <span className={`inline-block font-bold text-xs px-2.5 py-1 rounded-full ${
                  isAyushMode ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-800'
                }`}>
                  {isAyushMode ? 'Ayurveda / AYUSH' : 'General Medicine'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: CHIEF COMPLAINT */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-base uppercase tracking-wider">Chief Complaint</h3>
              <SourceBadge source="Patient Interview" />
            </div>

            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-extrabold text-gray-900">{unifiedCase.chiefComplaint}</p>
                <p className="text-xs text-gray-500 mt-1">Duration: <span className="font-semibold text-gray-800">{hpi.duration || 'Since yesterday'}</span></p>
              </div>
            </div>
          </div>

          {/* SECTION 3: HISTORY OF PRESENT ILLNESS (HPI) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-base uppercase tracking-wider">History of Present Illness (HPI)</h3>
              <SourceBadge source="Patient Interview" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-500 block mb-0.5">Onset:</span>
                <span className="font-bold text-gray-900 text-sm">{hpi.onset}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-500 block mb-0.5">Character:</span>
                <span className="font-bold text-gray-900 text-sm">{hpi.character}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-500 block mb-0.5">Radiation:</span>
                <span className="font-bold text-gray-900 text-sm">{hpi.radiation}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-500 block mb-0.5">Severity Score:</span>
                <span className="font-bold text-medical-700 text-sm">{hpi.severity} / 10</span>
              </div>
            </div>

            {hpi.associatedSymptoms?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs">
                <span className="text-gray-500 font-medium">Associated Symptoms: </span>
                <span className="font-bold text-gray-900">{hpi.associatedSymptoms.join(', ')}</span>
              </div>
            )}
          </div>

          {/* SECTION 4: PAST MEDICAL HISTORY */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-gray-900 text-base uppercase tracking-wider">Past Medical History</h3>
              <SourceBadge source="Patient Interview" />
            </div>

            <ul className="space-y-2 text-xs sm:text-sm">
              {unifiedCase.clinicalHistory.pastMedicalHistory.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-gray-800">
                  <span className="text-medical-600 font-bold">•</span>
                  <span className="font-medium">{typeof item === 'string' ? item : item.condition}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION 5: CURRENT MEDICATIONS */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-medical-600" />
                <h3 className="font-bold text-gray-900 text-base uppercase tracking-wider">Current Medications</h3>
              </div>
              <span className="text-xs text-gray-500 font-semibold">{unifiedCase.medications.length} Active Prescriptions</span>
            </div>

            <div className="space-y-3">
              {unifiedCase.medications.map((med, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-gray-900 text-base">{med.name}</span>
                      <span className="bg-sky-200 text-sky-900 text-xs font-bold px-2 py-0.5 rounded">
                        {med.dosage}
                      </span>
                      <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded">
                        {med.frequency}
                      </span>
                    </div>
                    {med.timing && <p className="text-xs text-gray-600 mt-1">{med.timing}</p>}
                  </div>

                  <SourceBadge source={med.source} />
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 6: PREVIOUS INVESTIGATIONS */}
          {unifiedCase.investigations.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-teal-600" />
                  <h3 className="font-bold text-gray-900 text-base uppercase tracking-wider">Previous Investigations</h3>
                </div>
                <SourceBadge source="Laboratory Report (12 Aug 2026)" />
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Investigation</th>
                      <th className="px-4 py-3">Result</th>
                      <th className="px-4 py-3">Reference Range</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {unifiedCase.investigations.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3 font-semibold text-gray-900">{inv.name}</td>
                        <td className="px-4 py-3 font-bold text-medical-900">{inv.value} {inv.unit}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">{inv.referenceRange || '—'}</td>
                        <td className="px-4 py-3">
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
          )}

          {/* SECTION 7: AYUSH ASSESSMENT */}
          {isAyushMode && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-gray-900 text-base uppercase tracking-wider">AYUSH / Ayurvedic Assessment</h3>
                </div>
                <SourceBadge source="Patient AYUSH Assessment" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-1">Prakriti</span>
                  <span className="font-bold text-gray-900 text-sm">{formatPrakriti(unifiedCase.ayushAssessment?.prakriti)}</span>
                </div>
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-1">Agni (Digestion)</span>
                  <span className="font-bold text-gray-900 text-sm">{formatAgni(unifiedCase.ayushAssessment?.agni)}</span>
                </div>
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-1">Koshtha (Bowel Pattern)</span>
                  <span className="font-bold text-gray-900 text-sm">{formatKoshtha(unifiedCase.ayushAssessment?.koshtha)}</span>
                </div>
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-1">Ahara Shakti (Appetite)</span>
                  <span className="font-bold text-gray-900 text-sm">{formatAharaShakti(unifiedCase.ayushAssessment?.aharaShakti)}</span>
                </div>
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-1">Vyayama Shakti (Stamina)</span>
                  <span className="font-bold text-gray-900 text-sm">{formatVyayamaShakti(unifiedCase.ayushAssessment?.vyayamaShakti)}</span>
                </div>
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-emerald-800 font-bold block mb-1">Reported Symptoms (Vikriti)</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {unifiedCase.ayushAssessment?.vikritiSymptoms?.join(', ') || 'Digestive discomfort'}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs">
                <span className="font-bold text-gray-700 block mb-1">Ahara-Vihara (Diet &amp; Routine):</span>
                <p className="text-gray-700">
                  Diet: <strong className="text-gray-900">{aharaVihara.diet}</strong> • Sleep: <strong className="text-gray-900">{aharaVihara.sleep}</strong> • Activity: <strong className="text-gray-900">{aharaVihara.activity}</strong>
                </p>
              </div>
            </div>
          )}

          {/* SECTION 8: RED FLAGS */}
          {unifiedCase.redFlags?.length > 0 && (
            <div className="bg-danger-50 border-l-4 border-danger-600 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-danger-600" />
                <h3 className="font-extrabold text-danger-900 text-base uppercase tracking-wider">
                  ⚠️ Potential Red-Flag Symptoms Detected
                </h3>
              </div>

              <p className="text-xs sm:text-sm font-semibold text-danger-800">
                Shortness of breath reported in conjunction with central pressure chest pain. Priority triage recommended for clinical evaluation.
              </p>

              <div className="bg-white/80 p-3 rounded-lg border border-danger-200 text-xs text-danger-900">
                <p className="font-bold">Important Clinical Safety Note:</p>
                <p className="text-danger-800 mt-0.5">
                  This triage indicator flags symptoms for physician attention and does NOT constitute a diagnosis.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 9: MEDICAL HISTORY TIMELINE */}
          {unifiedCase.documents?.length > 0 && (
            <DocumentTimeline documents={unifiedCase.documents} />
          )}

          {/* Bottom Action Footer */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-semibold">Ready to proceed to your doctor?</p>
              <p className="text-sm font-bold text-gray-800">
                Clicking "Send to Doctor" compiles your case into the physician's triage queue.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleEditInformation}
                className="flex-1 sm:flex-none px-5 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4 text-gray-500" />
                Edit Information
              </button>

              <button
                type="button"
                onClick={handleSendToDoctor}
                disabled={isSent}
                className={`flex-1 sm:flex-none px-7 py-3 font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${
                  isSent
                    ? 'bg-success-600 text-white cursor-default'
                    : 'bg-medical-600 hover:bg-medical-700 text-white hover:shadow-lg'
                }`}
              >
                {isSent ? (
                  <>
                    <Check className="w-5 h-5 animate-bounce" />
                    Case Sent to Doctor!
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send to Doctor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Full Document Inspector Modal */}
      <DocumentPreview
        document={previewDoc}
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
      />
    </>
  )
}
