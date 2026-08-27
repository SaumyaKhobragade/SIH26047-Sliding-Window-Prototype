import React from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import ProgressIndicator from '../../components/ProgressIndicator'
import AyushAssessment from '../../components/patient/AyushAssessment'
import { usePatient } from '../../context/PatientContext'

export default function AYUSHPage() {
  const navigate = useNavigate()
  const { patientHistory, updatePatientHistory } = usePatient()

  const handleAssessmentComplete = (responses) => {
    // Save to patient session state
    updatePatientHistory('ayushAssessment', responses)
    navigate('/patient/summary')
  }

  const handleBack = () => {
    navigate('/patient/documents')
  }

  return (
    <>
      <Header title="Ayurvedic Clinical Assessment" onBack={handleBack} />
      <ProgressIndicator
        currentStep={5}
        totalSteps={7}
        labels={['Welcome', 'Consent', 'Profile', 'History', 'Documents', 'AYUSH', 'Summary']}
      />
      <PageContainer>
        <div className="max-w-3xl mx-auto">
          <AyushAssessment
            initialData={patientHistory.ayushAssessment || {}}
            onComplete={handleAssessmentComplete}
            onBack={handleBack}
          />
        </div>
      </PageContainer>
    </>
  )
}
