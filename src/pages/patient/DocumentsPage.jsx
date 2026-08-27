import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, FlaskConical, Plus, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Clock } from 'lucide-react'
import Header from '../../components/Header'
import PageContainer from '../../components/PageContainer'
import ProgressIndicator from '../../components/ProgressIndicator'
import Card from '../../components/Card'
import Button from '../../components/Button'
import DocumentUploader from '../../components/patient/DocumentUploader'
import DocumentCard from '../../components/DocumentCard'
import DocumentPreview from '../../components/patient/DocumentPreview'
import ExtractionResult from '../../components/patient/ExtractionResult'
import DocumentTimeline from '../../components/patient/DocumentTimeline'
import { usePatient } from '../../context/PatientContext'
import { getDocumentService } from '../../services/documentService'

export default function DocumentsPage() {
  const navigate = useNavigate()
  const { patientHistory, updatePatientHistory } = usePatient()
  const documentService = getDocumentService()

  // Local state for documents
  const [documents, setDocuments] = useState(() => {
    return Array.isArray(patientHistory.documents) ? patientHistory.documents : []
  })

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [processingStep, setProcessingStep] = useState(1)

  // Review & Preview Modal States
  const [reviewingDoc, setReviewingDoc] = useState(null)
  const [previewingDoc, setPreviewingDoc] = useState(null)

  // Sync documents to patient context whenever documents change
  const syncDocumentsToContext = (updatedDocs) => {
    setDocuments(updatedDocs)
    updatePatientHistory('documents', updatedDocs)
  }

  const handleProcessDocument = async (fileOrDemo, documentType) => {
    setIsProcessing(true)
    setProcessingStatus('Starting document upload...')
    setProcessingStep(1)

    try {
      const processedDoc = await documentService.processDocument(
        fileOrDemo,
        documentType,
        (status, step) => {
          setProcessingStatus(status)
          setProcessingStep(step)
        }
      )

      // Add to list and open review dialog
      const updatedDocs = [processedDoc, ...documents]
      syncDocumentsToContext(updatedDocs)
      setReviewingDoc(processedDoc)
    } catch (error) {
      console.error('Document processing error:', error)
      throw error
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const handleConfirmExtraction = (confirmedData) => {
    if (!reviewingDoc) return

    const updatedDocs = documents.map((doc) => {
      if (doc.id === reviewingDoc.id) {
        return {
          ...doc,
          status: 'confirmed',
          confirmedData,
        }
      }
      return doc
    })

    syncDocumentsToContext(updatedDocs)
    setReviewingDoc(null)
  }

  const handleCancelReview = () => {
    setReviewingDoc(null)
  }

  const handleDeleteDocument = (docId) => {
    const updatedDocs = documents.filter((doc) => doc.id !== docId)
    syncDocumentsToContext(updatedDocs)
    if (reviewingDoc?.id === docId) {
      setReviewingDoc(null)
    }
  }

  const handleOpenReview = (doc) => {
    setReviewingDoc(doc)
  }

  const handleOpenPreview = (doc) => {
    setPreviewingDoc(doc)
  }

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

  const confirmedDocs = documents.filter((d) => d.status === 'confirmed')
  const pendingDocs = documents.filter((d) => d.status === 'review_pending')

  return (
    <>
      <Header title="Medical Document Digitization" onBack={handleBack} />
      <ProgressIndicator
        currentStep={4}
        totalSteps={7}
        labels={['Welcome', 'Consent', 'Profile', 'History', 'Documents', 'AYUSH', 'Summary']}
      />

      <PageContainer>
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Main Uploader */}
          <DocumentUploader
            onProcessDocument={handleProcessDocument}
            isProcessing={isProcessing}
            processingStatus={processingStatus}
            processingStep={processingStep}
          />

          {/* Active Review Screen (if user is reviewing a newly extracted document) */}
          {reviewingDoc && (
            <div id="extraction-review-section">
              <ExtractionResult
                document={reviewingDoc}
                onConfirm={handleConfirmExtraction}
                onCancel={handleCancelReview}
              />
            </div>
          )}

          {/* Uploaded Documents List */}
          {documents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Uploaded Documents ({documents.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    {confirmedDocs.length} confirmed • {pendingDocs.length} pending review
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onView={handleOpenPreview}
                    onReview={handleOpenReview}
                    onDelete={handleDeleteDocument}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Medical History Timeline (Chronological Organization) */}
          {confirmedDocs.length > 0 && (
            <DocumentTimeline documents={confirmedDocs} />
          )}

          {/* Helper Card */}
          <Card className="bg-medical-50/70 border border-medical-200">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-medical-600 text-white rounded-md mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs text-medical-900">
                <p className="font-bold mb-0.5">Ready to proceed?</p>
                <p className="text-medical-800">
                  You can upload additional prescriptions or lab reports anytime. When you are ready, click{' '}
                  <span className="font-semibold">Continue</span> to see your consolidated clinical summary.
                </p>
              </div>
            </div>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex gap-4 pt-2">
            <Button
              variant="secondary"
              onClick={handleBack}
              size="lg"
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to History
            </Button>
            <Button
              onClick={handleContinue}
              size="lg"
              className="flex-1"
            >
              Continue to {localStorage.getItem('selectedClinicalMode') === 'ayush' ? 'AYUSH Assessment' : 'Clinical Summary'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </PageContainer>

      {/* Full Document Inspector Modal */}
      <DocumentPreview
        document={previewingDoc}
        isOpen={Boolean(previewingDoc)}
        onClose={() => setPreviewingDoc(null)}
      />
    </>
  )
}
