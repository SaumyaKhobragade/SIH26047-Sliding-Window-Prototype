/**
 * AI Service
 * Abstracts LLM interaction for answer interpretation
 * Supports both mock and live modes
 */

const AI_MODE = process.env.REACT_APP_AI_MODE || 'mock'

export class AIService {
  constructor(mode = 'mock') {
    this.mode = mode
    this.apiKey = process.env.REACT_APP_OPENAI_API_KEY || null
  }

  /**
   * Interpret patient answer and extract structured data
   */
  async interpretAnswer(question, answerText, context = {}) {
    if (this.mode === 'mock') {
      return this.interpretAnswerMock(question, answerText)
    } else if (this.mode === 'live' && this.apiKey) {
      return this.interpretAnswerWithLLM(question, answerText, context)
    } else {
      // Fall back to mock if no API key
      return this.interpretAnswerMock(question, answerText)
    }
  }

  /**
   * Mock interpretation - deterministic extraction
   */
  interpretAnswerMock(question, answerText) {
    const extracted = {
      fieldPath: question.fieldPath,
      rawAnswer: answerText,
      confidence: 0.95,
    }

    // Parse based on question type
    if (question.type === 'choice') {
      // Direct mapping for choice questions
      extracted.value = answerText
      extracted.confidence = 1.0
    } else if (question.type === 'text') {
      // For text questions, extract relevant info
      if (question.parseAs) {
        // Special handling for certain fields
        extracted.value = answerText
        extracted.parseAs = question.parseAs
      } else if (question.fieldPath.includes('associatedSymptoms')) {
        // Parse yes/no responses for symptoms
        const isPositive = /yes|yep|yeah|positive|true|have|am|do/i.test(answerText)
        extracted.value = isPositive ? answerText : null
        extracted.isPositive = isPositive
      } else if (question.fieldPath.includes('Factors')) {
        // Extract aggravating/relieving factors
        extracted.value = answerText.split(/[,;]/).map((s) => s.trim())
      } else if (
        question.fieldPath.includes('MedicalHistory') ||
        question.fieldPath.includes('Medications') ||
        question.fieldPath.includes('allergies')
      ) {
        // Parse comma-separated items
        extracted.value = answerText
          .split(/[,;]|and/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      } else {
        extracted.value = answerText
      }
    }

    return extracted
  }

  /**
   * LLM-based interpretation (placeholder for future)
   */
  async interpretAnswerWithLLM(question, answerText, context) {
    // This would call OpenAI or similar LLM
    // For now, just use mock as fallback

    console.warn('LLM mode not yet fully implemented, using mock mode')
    return this.interpretAnswerMock(question, answerText)
  }

  /**
   * Generate clinical summary section from extracted answers
   */
  generateSummaryFromAnswers(completedQuestions, patientHistory) {
    const summary = {
      chiefComplaint: patientHistory.chiefComplaint || '',
      onset: patientHistory.historyOfPresentIllness?.onset || '',
      duration: patientHistory.historyOfPresentIllness?.duration || '',
      character: patientHistory.historyOfPresentIllness?.character || '',
      severity: patientHistory.historyOfPresentIllness?.severity || '',
      radiation: patientHistory.historyOfPresentIllness?.radiation || '',
      associatedSymptoms: patientHistory.historyOfPresentIllness?.associatedSymptoms || [],
      aggravatingFactors: patientHistory.historyOfPresentIllness?.aggravatingFactors || [],
      relievingFactors: patientHistory.historyOfPresentIllness?.relievingFactors || [],
      pastMedicalHistory: patientHistory.pastMedicalHistory || [],
      currentMedications: patientHistory.currentMedications || [],
      allergies: patientHistory.allergies || [],
    }

    return summary
  }

  /**
   * Check if LLM mode is available
   */
  isLiveMode() {
    return this.mode === 'live' && !!this.apiKey
  }

  /**
   * Set mode
   */
  setMode(mode) {
    if (['mock', 'live'].includes(mode)) {
      this.mode = mode
    }
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.mode
  }
}

// Singleton instance
let aiService = null

export function getAIService() {
  if (!aiService) {
    aiService = new AIService(AI_MODE)
  }
  return aiService
}

export function initAIService(mode = 'mock') {
  aiService = new AIService(mode)
  return aiService
}
