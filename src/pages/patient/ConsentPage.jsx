import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock } from 'lucide-react'
import Button from '../components/Button'
import Header from '../components/Header'
import PageContainer from '../components/PageContainer'
import Card from '../components/Card'

export default function ConsentPage() {
  const navigate = useNavigate()
  const [agreedToConsent, setAgreedToConsent] = React.useState(false)

  const handleContinue = () => {
    if (agreedToConsent) {
      navigate('/patient/profile')
    }
  }

  const handleBack = () => {
    navigate('/patient')
  }

  return (
    <>
      <Header title="Patient Consent & Privacy" onBack={handleBack} />
      <PageContainer>
        <div className="space-y-6">
          <Card>
            <div className="flex items-start gap-4 mb-4">
              <Shield className="w-8 h-8 text-medical-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Privacy Matters</h2>
                <p className="text-gray-600">
                  We take your health information seriously and protect it with the highest standards of care.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-4">What information will we collect?</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-medical-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">Your personal health history and current medical concerns</span>
              </li>
              <li className="flex gap-3">
                <span className="text-medical-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">Current medications and any drug allergies</span>
              </li>
              <li className="flex gap-3">
                <span className="text-medical-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">Previous medical reports and investigations</span>
              </li>
              <li className="flex gap-3">
                <span className="text-medical-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">Your AYUSH-related assessment if applicable</span>
              </li>
            </ul>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-4">How will your information be used?</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-medical-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">To help your doctor better understand your medical conditions</span>
              </li>
              <li className="flex gap-3">
                <span className="text-medical-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">To create a comprehensive clinical summary for review</span>
              </li>
              <li className="flex gap-3">
                <span className="text-medical-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">To improve the quality of patient care</span>
              </li>
            </ul>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <Lock className="w-6 h-6 text-success-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Your data is protected</h3>
                <p className="text-gray-600">
                  Your health information is encrypted and stored securely. Only authorized healthcare professionals have access to your data in accordance with privacy regulations.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToConsent}
                onChange={(e) => setAgreedToConsent(e.target.checked)}
                className="w-5 h-5 mt-1 accent-medical-600 cursor-pointer"
              />
              <span className="text-gray-700">
                I have read and understand the above information. I consent to the collection and use of my health information as described.
              </span>
            </label>
          </Card>

          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleBack} size="lg" className="flex-1">
              Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!agreedToConsent}
              size="lg"
              className="flex-1"
            >
              I Understand & Continue
            </Button>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
