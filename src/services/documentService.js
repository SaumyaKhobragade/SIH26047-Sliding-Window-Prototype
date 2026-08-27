/**
 * Document Orchestration Service
 * Connects file ingestion, OCR pipeline, clinical entity extraction, and state lifecycle.
 */

import { getOCRService } from './ocrService'
import { getDocumentExtractionService } from './documentExtractionService'
import { demoPrescriptionImage, demoPrescriptionExtracted } from '../data/documents/demoPrescription'
import { demoLabReportImage, demoLabReportExtracted } from '../data/documents/demoLabReport'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']

export class DocumentService {
  constructor() {
    this.ocrService = getOCRService()
    this.extractionService = getDocumentExtractionService()
  }

  /**
   * Validate uploaded file properties
   */
  validateFile(file) {
    if (!file) {
      throw new Error('No file selected for upload.')
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('File size exceeds the 10MB limit. Please upload a smaller image.')
    }

    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      throw new Error('Unsupported file format. Please upload a JPG, PNG, WEBP, or PDF document.')
    }

    return true
  }

  /**
   * Convert file to data URL for preview
   */
  async readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Failed to read document file.'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Process a real uploaded file or synthetic demo document through full OCR & Extraction pipeline
   * @param {File|Object} fileOrDemo - File object or demo flag
   * @param {'prescription'|'lab_report'} documentType
   * @param {Function} onProgress - Status callback: (statusMessage, stepNumber) => void
   * @returns {Promise<Object>} Processed document object
   */
  async processDocument(fileOrDemo, documentType, onProgress = () => {}) {
    const isDemo = fileOrDemo?.isDemo || !fileOrDemo?.name
    let fileName = isDemo
      ? documentType === 'prescription'
        ? 'Demo_Prescription_Rahul_Sharma.jpg'
        : 'Demo_Lab_Report_Rahul_Sharma.jpg'
      : fileOrDemo.name

    let previewUrl = ''

    if (isDemo) {
      previewUrl = documentType === 'prescription' ? demoPrescriptionImage : demoLabReportImage
    } else {
      try {
        this.validateFile(fileOrDemo)
        previewUrl = await this.readFileAsDataURL(fileOrDemo)
      } catch (err) {
        throw err
      }
    }

    // Step 1: Uploading
    onProgress('Uploading document...', 1)
    await new Promise((r) => setTimeout(r, 400))

    // Step 2: Optical Character Recognition (OCR)
    onProgress('Reading document text with OCR...', 2)
    const ocrResult = await this.ocrService.extractText(
      isDemo ? previewUrl : fileOrDemo,
      documentType
    )

    if (!ocrResult || !ocrResult.text) {
      throw new Error("We couldn't reliably read this document. Please try uploading a clearer image.")
    }

    // Step 3: Medical Intelligence Entity Extraction
    onProgress('Extracting structured medical information...', 3)
    await new Promise((r) => setTimeout(r, 600))
    const extractedData = await this.extractionService.extractMedicalInformation(
      ocrResult.text,
      documentType
    )

    // Construct Document Record
    const documentRecord = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: documentType,
      fileName,
      fileSize: fileOrDemo?.size ? `${(fileOrDemo.size / 1024).toFixed(1)} KB` : '145 KB',
      uploadedAt: new Date().toISOString(),
      status: 'review_pending', // 'uploading' | 'processing' | 'review_pending' | 'confirmed'
      previewUrl,
      ocrText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      extractedData,
      confirmedData: JSON.parse(JSON.stringify(extractedData)),
      isDemo,
    }

    onProgress('Extraction complete. Ready for review.', 4)
    return documentRecord
  }

  /**
   * Helper to instantiate a demo document instantly
   */
  async loadDemoDocument(documentType, onProgress = () => {}) {
    return this.processDocument({ isDemo: true }, documentType, onProgress)
  }
}

// Singleton instance
let documentServiceInstance = null

export function getDocumentService() {
  if (!documentServiceInstance) {
    documentServiceInstance = new DocumentService()
  }
  return documentServiceInstance
}
