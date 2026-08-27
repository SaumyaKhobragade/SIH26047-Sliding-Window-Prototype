import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle, Heart, FileText } from 'lucide-react'
import Button from '../components/Button'
import Header from '../components/Header'
import PageContainer from '../components/PageContainer'
import Card from '../components/Card'
import ClinicalSummarySection from '../components/ClinicalSummarySection'
import ProgressIndicator from '../components/ProgressIndicator'
import { summaryData } from '../data/summary'

export default function PatientSummaryPage() {
  const navigate = useNavigate()
  const summary = summaryData.clinicalSummary

  const handleSendToDoctor = () => {
    navigate('/doctor')
  }

  const handleBack = () => {
    const clinicalMode = localStorage.getItem('selectedClinicalMode') || 'general'
    if (clinicalMode === 'ayush') {
      navigate('/patient/ayush')
    } else {
      navigate('/patient/documents')
    }
  }

  return (
    <>
      <Header title="Clinical Summary" onBack={handleBack} />
      <ProgressIndicator
        currentStep={6}
        totalSteps={7}
        labels={['Welcome', 'Consent', 'Profile', 'History', 'Documents', 'AYUSH', 'Summary']}
      />
      <PageContainer>
        <div className="space-y-6">
          <Card className="bg-blue-50 border-l-4 border-warning-500">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-warning-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-gray-900">AI-Generated Draft</p>
                <p className="text-gray-700 text-sm mt-1">
                  This summary is an AI-generated draft and has NOT been reviewed by a physician. Your doctor will review and validate all information before proceeding with consultation.
                </p>
              </div>
            </div>
          </Card>

          <ClinicalSummarySection title="Patient Information" icon={Heart}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-bold text-gray-900">{summary.patientInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ABHA ID</p>
                <p className="font-mono text-medical-600">{summary.patientInfo.abhaId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Age</p>
                <p className="font-bold text-gray-900">{summary.patientInfo.age} years</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Gender</p>
                <p className="font-bold text-gray-900">{summary.patientInfo.gender}</p>
              </div>
            </div>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="Chief Complaint">
            <p className="text-gray-900 font-semibold text-lg">{summary.chiefComplaint}</p>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="History of Present Illness">
            <p className="text-gray-700 leading-relaxed">{summary.historyOfPresentIllness}</p>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="Past Medical History">
            <ul className="space-y-2">
              {summary.pastMedicalHistory.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-medical-600">•</span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="Current Medications">
            <div className="space-y-2">
              {summary.currentMedications.map((med, i) => (
                <div key={i} className="bg-gray-50 p-3 rounded">
                  <p className="font-semibold text-gray-900">{med.name}</p>
                  <p className="text-sm text-gray-600">
                    {med.dosage} • {med.frequency}
                  </p>
                </div>
              ))}
            </div>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="Allergies">
            <div className="space-y-2">
              {summary.allergies.map((allergy, i) => (
                <div key={i} className="bg-danger-50 border border-danger-200 p-3 rounded">
                  <p className="font-semibold text-danger-900">{allergy.allergen}</p>
                  <p className="text-sm text-danger-700">Reaction: {allergy.reaction}</p>
                </div>
              ))}
            </div>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="Previous Investigations">
            <div className="space-y-2">
              {summary.previousInvestigations.map((inv, i) => (
                <div key={i} className="bg-gray-50 p-3 rounded">
                  <p className="font-semibold text-gray-900">{inv.test}</p>
                  <p className="text-sm text-gray-600">
                    {inv.value} • {inv.status} • {inv.date}
                  </p>
                </div>
              ))}
            </div>
          </ClinicalSummarySection>

          {summary.ayushAssessment && (
            <ClinicalSummarySection title="AYUSH Assessment">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-medical-50 p-3 rounded">
                  <p className="text-xs text-gray-600">Prakriti</p>
                  <p className="font-semibold text-gray-900">{summary.ayushAssessment.prakrti}</p>
                </div>
                <div className="bg-medical-50 p-3 rounded">
                  <p className="text-xs text-gray-600">Agni</p>
                  <p className="font-semibold text-gray-900">{summary.ayushAssessment.agni}</p>
                </div>
                <div className="bg-medical-50 p-3 rounded">
                  <p className="text-xs text-gray-600">Koshtha</p>
                  <p className="font-semibold text-gray-900">{summary.ayushAssessment.koshtha}</p>
                </div>
                <div className="bg-medical-50 p-3 rounded">
                  <p className="text-xs text-gray-600">Ahara Shakti</p>
                  <p className="font-semibold text-gray-900">{summary.ayushAssessment.aharaShakti}</p>
                </div>
              </div>
            </ClinicalSummarySection>
          )}

          {summary.redFlags.length > 0 && (
            <Card className="border-l-4 border-danger-600 bg-danger-50">
              <div className="flex gap-3">
                <AlertCircle className="w-6 h-6 text-danger-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-danger-900 mb-2">Red Flag Alerts</h3>
                  <ul className="space-y-1">
                    {summary.redFlags.map((flag, i) => (
                      <li key={i} className="text-danger-800 text-sm flex gap-2">
                        <span>⚠️</span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-danger-700 mt-3 font-semibold">
                    These flags will be highlighted to the doctor for priority review.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleBack} size="lg" className="flex-1">
              Back
            </Button>
            <Button onClick={handleSendToDoctor} size="lg" className="flex-1">
              Send to Doctor
            </Button>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
