import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/Button'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import PatientInfoCard from '../../components/PatientInfoCard'
import Card from '../../components/Card'
import { patients } from '../../data/patients'
import { usePatient } from '../../context/PatientContext'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { updatePatientHistory } = usePatient()
  const [clinicalMode, setClinicalMode] = React.useState('general')
  const patient = patients.demoPatient

  const handleContinue = () => {
    // Update patient context with patient info and chief complaint
    updatePatientHistory('patientInfo', {
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      abhaId: patient.abhaId,
    })
    updatePatientHistory('chiefComplaint', patient.chiefComplaint || '')
    
    localStorage.setItem('selectedClinicalMode', clinicalMode)
    navigate('/patient/history')
  }

  const handleBack = () => {
    navigate('/patient/consent')
  }

  return (
    <>
      <Header title="Your Information" onBack={handleBack} />
      <PageContainer>
        <div className="space-y-6">
          <PatientInfoCard patient={patient} />

          <Card>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Select Clinical Mode</h2>
            <p className="text-gray-600 mb-6">
              Which type of medical consultation are you seeking today?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setClinicalMode('general')}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  clinicalMode === 'general'
                    ? 'border-medical-600 bg-medical-50'
                    : 'border-gray-200 bg-white hover:border-medical-300'
                }`}
              >
                <h3 className="font-bold text-gray-900">General Medicine</h3>
                <p className="text-gray-600 text-sm mt-1">
                  For general health concerns and checkups
                </p>
              </button>

              <button
                onClick={() => setClinicalMode('ayush')}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  clinicalMode === 'ayush'
                    ? 'border-medical-600 bg-medical-50'
                    : 'border-gray-200 bg-white hover:border-medical-300'
                }`}
              >
                <h3 className="font-bold text-gray-900">Ayurveda / AYUSH</h3>
                <p className="text-gray-600 text-sm mt-1">
                  For traditional Indian medicine consultation
                </p>
              </button>
            </div>
          </Card>

          <Card>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Note:</span> If you select AYUSH mode, we'll collect additional information about your constitutional type and body functions after your clinical history.
            </p>
          </Card>

          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleBack} size="lg" className="flex-1">
              Back
            </Button>
            <Button onClick={handleContinue} size="lg" className="flex-1">
              Continue
            </Button>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
