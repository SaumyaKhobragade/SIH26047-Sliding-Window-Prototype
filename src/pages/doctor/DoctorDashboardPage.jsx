import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, FileText, Clock, CheckCircle, User, Phone } from 'lucide-react'
import Button from '../../components/Button'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import Card from '../../components/Card'
import ClinicalSummarySection from '../../components/ClinicalSummarySection'
import StatusBadge from '../../components/StatusBadge'
import { patients } from '../../data/patients'
import { summaryData } from '../../data/summary'

export default function DoctorDashboardPage() {
  const navigate = useNavigate()
  const [selectedPatient, setSelectedPatient] = React.useState(patients.mockPatients[0])
  const summary = summaryData.clinicalSummary

  const handleEditSummary = () => {
    alert('Edit functionality will be available in the next phase.')
  }

  const handleAcceptSummary = () => {
    alert('Summary accepted. Proceeding with consultation...')
  }

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient)
  }

  return (
    <>
      <Header title="Doctor Dashboard - Patient Queue" />
      <PageContainer>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Queue */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Patient Queue</h2>
            <div className="space-y-3">
              {patients.mockPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className={`w-full p-4 rounded-lg text-left transition-all border-2 ${
                    selectedPatient.id === patient.id
                      ? 'border-medical-600 bg-medical-50'
                      : 'border-gray-200 bg-white hover:border-medical-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{patient.age}y • {patient.gender}</p>
                      <p className="text-xs text-gray-600 mt-1 font-mono">{patient.id}</p>
                    </div>
                    {patient.redFlags && (
                      <span className="text-lg">⚠️</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <StatusBadge status={patient.status} priority={patient.priority} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Patient Summary */}
          <div className="lg:col-span-2">
            {selectedPatient.redFlags && (
              <Card className="mb-4 border-l-4 border-danger-600 bg-danger-50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-danger-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-danger-900 text-lg">
                      🚨 Potential Red-Flag Symptoms Detected
                    </p>
                    <p className="text-danger-800 text-sm mt-2 font-semibold">
                      Priority triage recommended
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-danger-800">
                      {summary.redFlags.map((flag, i) => (
                        <li key={i}>• {flag}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            <ClinicalSummarySection title="Patient Information" icon={User}>
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

            <Card>
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-semibold">Note:</span> This summary was generated by AI and requires your professional review and validation before proceeding with consultation.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleEditSummary}>
                  ✏️ Edit Summary
                </Button>
                <Button onClick={handleAcceptSummary}>
                  ✅ Accept & Proceed
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
