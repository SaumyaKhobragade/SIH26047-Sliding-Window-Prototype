/**
 * Modular OCR Service
 * Abstracts document text extraction with support for Mock and Live OCR providers.
 */

import { demoPrescriptionText } from '../data/documents/demoPrescription'
import { demoLabReportText } from '../data/documents/demoLabReport'

const getEnv = (key) => (typeof process !== 'undefined' && process.env ? process.env[key] : undefined)

const OCR_MODE = getEnv('REACT_APP_OCR_MODE') || 'mock'

export class OCRService {
  constructor(mode = OCR_MODE) {
    this.mode = mode
    this.apiKey = getEnv('REACT_APP_OCR_API_KEY') || null
  }

  /**
   * Extract raw text from file or data URL
   * @param {File|Blob|string} file - Uploaded document file or image URL
   * @param {string} documentType - 'prescription' | 'lab_report' | 'other'
   * @returns {Promise<{text: string, confidence: number, mode: string, processingTimeMs: number}>}
   */
  async extractText(file, documentType = 'prescription') {
    const startTime = Date.now()

    if (this.mode === 'live' && this.apiKey) {
      try {
        return await this.extractTextLive(file, documentType, startTime)
      } catch (err) {
        console.warn('Live OCR provider failed, falling back to mock OCR mode:', err)
        return await this.extractTextMock(file, documentType, startTime)
      }
    }

    return await this.extractTextMock(file, documentType, startTime)
  }

  /**
   * Mock OCR text extraction
   * Simulates OCR latency and returns deterministic text matching the clinical document type
   */
  async extractTextMock(file, documentType, startTime) {
    // Realistic OCR latency simulation for UI feedback (600 - 1000ms)
    await new Promise((resolve) => setTimeout(resolve, 800))

    let text = ''
    let confidence = 0.96

    if (documentType === 'prescription') {
      text = demoPrescriptionText
      confidence = 0.96
    } else if (documentType === 'lab_report') {
      text = demoLabReportText
      confidence = 0.98
    } else {
      text = `General Medical Document\nPatient: Rahul Sharma\nDate: 12/08/2026\nClinical notes attached.`
      confidence = 0.92
    }

    const processingTimeMs = Date.now() - startTime

    return {
      text: text.trim(),
      confidence,
      mode: 'mock',
      processingTimeMs,
    }
  }

  /**
   * Live OCR provider interface (placeholder for Tesseract.js / cloud OCR)
   */
  async extractTextLive(file, documentType, startTime) {
    // In live mode, call actual OCR API endpoint or browser worker
    // For now, falls back gracefully if not configured
    throw new Error('Live OCR provider not configured. Switching to Mock mode.')
  }

  /**
   * Set service execution mode
   */
  setMode(mode) {
    if (['mock', 'live'].includes(mode)) {
      this.mode = mode
    }
  }

  getMode() {
    return this.mode
  }
}

// Singleton instance
let ocrServiceInstance = null

export function getOCRService() {
  if (!ocrServiceInstance) {
    ocrServiceInstance = new OCRService()
  }
  return ocrServiceInstance
}

export function initOCRService(mode = 'mock') {
  ocrServiceInstance = new OCRService(mode)
  return ocrServiceInstance
}
