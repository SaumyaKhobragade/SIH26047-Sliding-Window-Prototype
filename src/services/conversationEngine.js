/**
 * Conversation Engine Service
 * Manages the clinical interview flow, question sequencing, and answer interpretation
 */

import { chestPainQuestions } from '../data/clinical/chestPainQuestions'
import { commonQuestions, baselineQuestions } from '../data/clinical/commonQuestions'

export class ConversationEngine {
  constructor() {
    this.conversationHistory = []
    this.currentQuestionIndex = 0
    this.allQuestions = []
    this.completedQuestions = []
    this.chiefComplaint = null
    this.clinicalMode = 'general'
  }

  /**
   * Initialize conversation with patient info
   */
  init(patientName, patientAge, patientGender, clinicalMode = 'general') {
    this.conversationHistory = []
    this.currentQuestionIndex = 0
    this.completedQuestions = []
    this.chiefComplaint = null
    this.clinicalMode = clinicalMode

    // Start with baseline questions
    this.allQuestions = [...baselineQuestions]

    this.conversationHistory.push({
      id: `ai_${Date.now()}`,
      type: 'ai',
      message: `Hello ${patientName}. I'm here to help collect information about your health. Let's start with why you're here today.`,
      timestamp: new Date(),
    })

    return this.getCurrentQuestion()
  }

  /**
   * Get the current question
   */
  getCurrentQuestion() {
    if (this.currentQuestionIndex < this.allQuestions.length) {
      return this.allQuestions[this.currentQuestionIndex]
    }
    return null
  }

  /**
   * Process patient answer and move to next question
   */
  async recordAnswer(answerText) {
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) return null

    // Add patient response to conversation
    this.conversationHistory.push({
      id: `patient_${Date.now()}`,
      type: 'patient',
      message: answerText,
      timestamp: new Date(),
    })

    // Extract and store the answer
    const extractedData = await this.interpretAnswer(currentQuestion, answerText)

    this.completedQuestions.push({
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      answer: answerText,
      extracted: extractedData,
    })

    // Update chief complaint if this is it
    if (currentQuestion.fieldPath === 'chiefComplaint') {
      this.chiefComplaint = answerText

      // Build complaint-specific questions
      this.buildComplaintSpecificFlow(answerText)
    }

    // Move to next question
    this.currentQuestionIndex += 1

    // Add follow-up based on answer
    const nextQuestion = this.getCurrentQuestion()
    if (nextQuestion) {
      this.conversationHistory.push({
        id: `ai_${Date.now()}`,
        type: 'ai',
        message: nextQuestion.question,
        timestamp: new Date(),
      })
    } else {
      // Interview complete
      this.conversationHistory.push({
        id: `ai_${Date.now()}`,
        type: 'ai',
        message: 'Thank you for providing this information. Let me summarize and prepare your clinical summary.',
        timestamp: new Date(),
      })
    }

    return {
      nextQuestion,
      extracted: extractedData,
      isComplete: !nextQuestion,
      progress: this.getProgress(),
    }
  }

  /**
   * Build complaint-specific question flow
   */
  buildComplaintSpecificFlow(complaint) {
    const lowerComplaint = complaint.toLowerCase()

    // Detect complaint type and add appropriate questions
    if (
      lowerComplaint.includes('chest') ||
      lowerComplaint.includes('pain') ||
      lowerComplaint.includes('pressure')
    ) {
      // Add chest pain specific questions
      this.allQuestions.push(...chestPainQuestions)
    } else if (lowerComplaint.includes('fever') || lowerComplaint.includes('temperature')) {
      // Could add fever-specific questions later
    }

    // Add common questions at the end
    this.allQuestions.push(
      commonQuestions.pastMedicalHistory,
      commonQuestions.currentMedications,
      commonQuestions.allergies,
      commonQuestions.smoking,
      commonQuestions.alcohol
    )
  }

  /**
   * Interpret and extract data from answer
   * This can use AI or mock logic
   */
  async interpretAnswer(question, answerText) {
    // In mock mode, do deterministic extraction
    const extracted = {
      fieldPath: question.fieldPath,
      value: answerText,
      confidence: 0.9,
    }

    // Handle special parsing
    if (question.parseAs) {
      extracted.parseAs = question.parseAs
    }

    return extracted
  }

  /**
   * Get progress metrics
   */
  getProgress() {
    const totalQuestions = this.allQuestions.length || 15 // Estimate
    const answered = this.completedQuestions.length
    const percentage = Math.round((answered / totalQuestions) * 100)

    return {
      answered,
      total: totalQuestions,
      percentage,
      section: this.getCurrentSection(),
    }
  }

  /**
   * Get current section name
   */
  getCurrentSection() {
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) return 'Complete'

    const categoryMap = {
      chief_complaint: 'Chief Complaint',
      hpi: 'Present Illness',
      past_medical_history: 'Medical History',
      medications: 'Medications',
      allergies: 'Allergies',
      lifestyle: 'Lifestyle',
    }

    return categoryMap[currentQuestion.category] || 'Interview'
  }

  /**
   * Get conversation history
   */
  getConversationHistory() {
    return this.conversationHistory
  }

  /**
   * Get completed questions with answers
   */
  getCompletedQuestions() {
    return this.completedQuestions
  }

  /**
   * Check if interview is complete
   */
  isComplete() {
    return this.currentQuestionIndex >= this.allQuestions.length
  }

  /**
   * Get current question index
   */
  getCurrentQuestionIndex() {
    return this.currentQuestionIndex
  }

  /**
   * Get total questions
   */
  getTotalQuestions() {
    return this.allQuestions.length
  }
}

// Singleton instance
let conversationEngine = null

export function getConversationEngine() {
  if (!conversationEngine) {
    conversationEngine = new ConversationEngine()
  }
  return conversationEngine
}

export function resetConversationEngine() {
  conversationEngine = new ConversationEngine()
  return conversationEngine
}
