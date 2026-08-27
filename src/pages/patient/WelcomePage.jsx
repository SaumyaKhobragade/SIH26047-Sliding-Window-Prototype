import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Globe } from 'lucide-react'
import Button from '../../components/Button'
import PageContainer from '../../components/PageContainer'

export default function WelcomePage() {
  const navigate = useNavigate()
  const [selectedLanguage, setSelectedLanguage] = React.useState('en')

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' },
    { code: 'ta', name: 'தமிழ்' },
    { code: 'te', name: 'తెలుగు' },
  ]

  const handleStart = () => {
    localStorage.setItem('selectedLanguage', selectedLanguage)
    navigate('/patient/consent')
  }

  return (
    <PageContainer>
      <div className="text-center space-y-8 py-12">
        <div className="flex justify-center">
          <div className="p-6 bg-medical-50 rounded-full">
            <Heart className="w-16 h-16 text-medical-600" />
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">MediKiosk</h1>
          <p className="text-xl text-gray-600">AI-Powered Patient Case-Taking System</p>
        </div>

        <div className="bg-blue-50 border border-medical-200 rounded-lg p-6 max-w-2xl mx-auto">
          <p className="text-gray-700 leading-relaxed">
            Welcome to MediKiosk. Before meeting with your doctor, we'll collect some important information about your health. This process helps your doctor better understand your medical history and concerns.
          </p>
          <p className="text-gray-600 text-sm mt-4">
            The entire process takes about 5-10 minutes and is completely confidential.
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-gray-700 font-semibold mb-4">
            <Globe className="w-5 h-5 text-medical-600" />
            Select Your Language:
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`p-4 rounded-lg font-semibold transition-all ${
                  selectedLanguage === lang.code
                    ? 'bg-medical-600 text-white border-2 border-medical-600'
                    : 'bg-white border-2 border-gray-200 text-gray-900 hover:border-medical-300'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleStart}
          size="lg"
          className="w-full md:w-auto"
        >
          Start Case Taking
        </Button>

        <p className="text-gray-500 text-sm">
          Secure • Confidential • AI-Assisted
        </p>
      </div>
    </PageContainer>
  )
}
