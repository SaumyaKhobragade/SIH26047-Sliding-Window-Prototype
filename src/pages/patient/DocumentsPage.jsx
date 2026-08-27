import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText } from 'lucide-react'
import Button from '../../components/Button'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import Card from '../../components/Card'
import DocumentCard from '../../components/DocumentCard'
import ProgressIndicator from '../../components/ProgressIndicator'
import { documentsData } from '../../data/documents'

export default function DocumentsPage() {
  const navigate = useNavigate()
  const [uploadedDocs, setUploadedDocs] = React.useState(documentsData.uploadedDocuments)

  const handleContinue = () => {
    const clinicalMode = localStorage.getItem('selectedClinicalMode') || 'general'
    if (clinicalMode === 'ayush') {
      navigate('/patient/ayush')
    } else {
      navigate('/patient/summary')
    }
  }

  const handleBack = () => {
    navigate('/patient/history')
  }

  return (
    <>
      <Header title="Medical Documents" onBack={handleBack} />
      <ProgressIndicator
        currentStep={4}
        totalSteps={7}
        labels={['Welcome', 'Consent', 'Profile', 'History', 'Documents', 'AYUSH', 'Summary']}
      />
      <PageContainer>
        <div className="space-y-6">
          <Card className="border-2 border-dashed border-medical-300 bg-medical-50 p-8 text-center">
            <div className="flex justify-center mb-4">
              <Upload className="w-12 h-12 text-medical-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Upload Medical Documents</h3>
            <p className="text-gray-600 mb-4">
              You can upload prescriptions, lab reports, and other medical documents to help your doctor better understand your health.
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button className="px-6 py-3 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors font-semibold">
                📸 Take Photo / Scan
              </button>
              <button className="px-6 py-3 bg-white border-2 border-medical-600 text-medical-600 rounded-lg hover:bg-medical-50 transition-colors font-semibold">
                📁 Upload from Gallery
              </button>
            </div>
          </Card>

          {uploadedDocs.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Uploaded Documents ({uploadedDocs.length})
              </h2>
              <div className="space-y-4">
                {uploadedDocs.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            </div>
          )}

          <Card>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Optional:</span> You don't need to upload documents to continue. If you have any, uploading them helps us provide better analysis. All documents are kept confidential.
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
