import React from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Header from '../components/Header'
import PageContainer from '../components/PageContainer'
import Card from '../components/Card'
import ProgressIndicator from '../components/ProgressIndicator'
import { ayushData } from '../data/ayush'

export default function AYUSHPage() {
  const navigate = useNavigate()
  const [assessments, setAssessments] = React.useState(ayushData.assessmentParameters)

  const handleParameterChange = (parameterId, newValue) => {
    setAssessments(
      assessments.map((param) =>
        param.id === parameterId ? { ...param, selected: newValue } : param
      )
    )
  }

  const handleContinue = () => {
    navigate('/patient/summary')
  }

  const handleBack = () => {
    navigate('/patient/documents')
  }

  return (
    <>
      <Header title="AYUSH Assessment" onBack={handleBack} />
      <ProgressIndicator
        currentStep={5}
        totalSteps={7}
        labels={['Welcome', 'Consent', 'Profile', 'History', 'Documents', 'AYUSH', 'Summary']}
      />
      <PageContainer>
        <div className="space-y-6">
          <Card>
            <p className="text-gray-700 mb-4">
              Please answer the following questions about your constitution and bodily functions according to Ayurvedic principles. These are indicative and will help us provide more personalized recommendations.
            </p>
          </Card>

          {assessments.map((param) => (
            <Card key={param.id}>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{param.label}</h3>
              <p className="text-sm text-gray-600 mb-4">{param.description}</p>

              <div className="space-y-3">
                {param.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleParameterChange(param.id, option.value)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      param.selected === option.value
                        ? 'border-medical-600 bg-medical-50'
                        : 'border-gray-200 bg-white hover:border-medical-300'
                    }`}
                  >
                    <h4 className="font-semibold text-gray-900">{option.label}</h4>
                    <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </Card>
          ))}

          <Card>
            <p className="text-xs text-gray-500">
              <span className="font-semibold">Note:</span> AYUSH assessment is supplementary and does not replace clinical evaluation. Your doctor will review and validate these selections based on professional assessment.
            </p>
          </Card>

          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleBack} size="lg" className="flex-1">
              Back
            </Button>
            <Button onClick={handleContinue} size="lg" className="flex-1">
              Continue to Summary
            </Button>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
