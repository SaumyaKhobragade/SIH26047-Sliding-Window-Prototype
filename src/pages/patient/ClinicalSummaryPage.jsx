import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Heart } from 'lucide-react'
import Button from '../../components/Button'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import Card from '../../components/Card'
import ClinicalSummarySection from '../../components/ClinicalSummarySection'
import ProgressIndicator from '../../components/ProgressIndicator'
import { usePatient } from '../../context/PatientContext'

export default function PatientSummaryPage() {
  const navigate = useNavigate()
  const { patientHistory } = usePatient()

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

  const hpi = patientHistory.historyOfPresentIllness || {}
  const redFlags = patientHistory.redFlags || []

  // Format HPI as readable text
  const formatHPI = () => {
    const parts = []
    if (hpi.onset) parts.push(`Onset: ${hpi.onset}`)
    if (hpi.duration) parts.push(`Duration: ${hpi.duration}`)
    if (hpi.character) parts.push(`Character: ${hpi.character}`)
    if (hpi.severity) parts.push(`Severity: ${hpi.severity}/10`)
    if (hpi.location) parts.push(`Location: ${hpi.location}`)
    if (hpi.radiation) parts.push(`Radiation: ${hpi.radiation}`)
    if (hpi.aggravatingFactors && hpi.aggravatingFactors.length > 0)
      parts.push(`Aggravating factors: ${hpi.aggravatingFactors.join(', ')}`)
    if (hpi.relievingFactors && hpi.relievingFactors.length > 0)
      parts.push(`Relieving factors: ${hpi.relievingFactors.join(', ')}`)
    if (hpi.associatedSymptoms && hpi.associatedSymptoms.length > 0)
      parts.push(`Associated symptoms: ${hpi.associatedSymptoms.join(', ')}`)
    return parts.join(' | ')
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
                <p className="font-bold text-gray-900">{patientHistory.patientInfo?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Age</p>
                <p className="font-bold text-gray-900">{patientHistory.patientInfo?.age || 'N/A'} years</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Gender</p>
                <p className="font-bold text-gray-900">{patientHistory.patientInfo?.gender || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ABHA ID</p>
                <p className="font-mono text-medical-600">{patientHistory.patientInfo?.abhaId || 'Demo-ABHA-001'}</p>
              </div>
            </div>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="Chief Complaint">
            <p className="text-gray-900 font-semibold text-lg">
              {patientHistory.chiefComplaint || 'Not provided'}
            </p>
          </ClinicalSummarySection>

          <ClinicalSummarySection title="History of Present Illness">
            <p className="text-gray-700 leading-relaxed">
              {formatHPI() || 'Details not yet collected'}
            </p>
          </ClinicalSummarySection>

          {patientHistory.pastMedicalHistory && patientHistory.pastMedicalHistory.length > 0 && (
            <ClinicalSummarySection title="Past Medical History">
              <ul className="space-y-2">
                {patientHistory.pastMedicalHistory.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-medical-600">•</span>
                    <span className="text-gray-700">
                      {typeof item === 'string' ? item : item.condition || 'Unknown'}
                    </span>
                  </li>
                ))}
              </ul>
            </ClinicalSummarySection>
          )}

          {patientHistory.currentMedications && patientHistory.currentMedications.length > 0 && (
            <ClinicalSummarySection title="Current Medications">
              <div className="space-y-2">
                {patientHistory.currentMedications.map((med, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded">
                    <p className="font-semibold text-gray-900">
                      {typeof med === 'string' ? med : med.name || 'Unknown medication'}
                    </p>
                  </div>
                ))}
              </div>
            </ClinicalSummarySection>
          )}

          {patientHistory.allergies && patientHistory.allergies.length > 0 && (
            <ClinicalSummarySection title="Allergies">
              <div className="space-y-2">
                {patientHistory.allergies.map((allergy, i) => (
                  <div key={i} className="bg-danger-50 border border-danger-200 p-3 rounded">
                    <p className="font-semibold text-danger-900">
                      {typeof allergy === 'string' ? allergy : allergy.allergen || 'Unknown'}
                    </p>
                  </div>
                ))}
              </div>
            </ClinicalSummarySection>
          )}

          {patientHistory.personalHistory && (
            <ClinicalSummarySection title="Personal & Lifestyle History">
              <div className="grid grid-cols-2 gap-3">
                {patientHistory.personalHistory.smoking && (
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Smoking</p>
                    <p className="font-semibold text-gray-900">{patientHistory.personalHistory.smoking}</p>
                  </div>
                )}
                {patientHistory.personalHistory.alcohol && (
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Alcohol</p>
                    <p className="font-semibold text-gray-900">{patientHistory.personalHistory.alcohol}</p>
                  </div>
                )}
                {patientHistory.personalHistory.diet && (
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Diet</p>
                    <p className="font-semibold text-gray-900">{patientHistory.personalHistory.diet}</p>
                  </div>
                )}
                {patientHistory.personalHistory.sleep && (
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Sleep</p>
                    <p className="font-semibold text-gray-900">{patientHistory.personalHistory.sleep}</p>
                  </div>
                )}
              </div>
            </ClinicalSummarySection>
          )}

          {patientHistory.ayushAssessment && Object.keys(patientHistory.ayushAssessment).length > 0 && (
            <ClinicalSummarySection title="AYUSH Assessment">
              <div className="grid grid-cols-2 gap-3">
                {patientHistory.ayushAssessment.prakriti && (
                  <div className="bg-medical-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Prakriti</p>
                    <p className="font-semibold text-gray-900">{patientHistory.ayushAssessment.prakriti}</p>
                  </div>
                )}
                {patientHistory.ayushAssessment.agni && (
                  <div className="bg-medical-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Agni</p>
                    <p className="font-semibold text-gray-900">{patientHistory.ayushAssessment.agni}</p>
                  </div>
                )}
              </div>
            </ClinicalSummarySection>
          )}

          {redFlags && redFlags.length > 0 && (
            <Card className="border-l-4 border-danger-600 bg-danger-50">
              <div className="flex gap-3">
                <AlertCircle className="w-6 h-6 text-danger-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-danger-900 mb-2">Red Flag Alerts</h3>
                  <ul className="space-y-1">
                    {redFlags.map((flag, i) => (
                      <li key={i} className="text-danger-800 text-sm flex gap-2">
                        <span>⚠️</span>
                        <span>{flag.message || flag}</span>
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
