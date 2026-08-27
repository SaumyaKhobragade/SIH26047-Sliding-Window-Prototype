/**
 * Test suite for conversation engine and related services
 * This file can be run with: node src/services/test.js
 */

import { ConversationEngine, getConversationEngine, resetConversationEngine } from './conversationEngine.js'
import { RedFlagDetector, getRedFlagDetector } from './redFlagService.js'
import { getAIService } from './aiService.js'
import { createEmptyHistory, updateHistory } from '../data/clinicalSchema.js'

console.log('=== MediKiosk Conversation Engine Test Suite ===\n')

// Test 1: Conversation Engine Initialization
console.log('Test 1: Conversation Engine Initialization')
try {
  resetConversationEngine()
  const engine = getConversationEngine()
  engine.init('Rahul Sharma', 42, 'Male', 'Chest pain')
  
  const firstQuestion = engine.getCurrentQuestion()
  console.log('✓ Engine initialized')
  console.log('  First question:', firstQuestion?.question)
  
  const progress = engine.getProgress()
  console.log('  Progress:', `${progress.questionIndex}/${progress.totalQuestions}`)
} catch (error) {
  console.log('✗ Error:', error.message)
}

// Test 2: AI Service Mock Mode
console.log('\nTest 2: AI Service Mock Mode')
try {
  const aiService = getAIService()
  console.log('  Current mode:', aiService.getMode())
  
  const mockQuestion = {
    id: 'onset',
    question: 'When did the pain start?',
    type: 'text',
    fieldPath: 'historyOfPresentIllness.onset',
  }
  
  const result = aiService.interpretAnswerMock(mockQuestion, 'Yesterday evening')
  console.log('✓ Mock interpretation:')
  console.log('  Field path:', result.fieldPath)
  console.log('  Value:', result.value)
  console.log('  Confidence:', result.confidence)
} catch (error) {
  console.log('✗ Error:', error.message)
}

// Test 3: Red Flag Detection
console.log('\nTest 3: Red Flag Detection')
try {
  const detector = getRedFlagDetector()
  
  // Create a history with concerning symptoms
  const testHistory = createEmptyHistory()
  testHistory.chiefComplaint = 'Chest pain'
  testHistory.historyOfPresentIllness.severity = '9'
  testHistory.historyOfPresentIllness.associatedSymptoms = ['Shortness of breath', 'Sweating']
  testHistory.historyOfPresentIllness.radiation = 'Left arm and shoulder'
  
  const flags = detector.analyzeHistory(testHistory)
  console.log('✓ Red flags detected:', flags.length)
  flags.forEach((flag) => {
    console.log(`  - [${flag.severity}] ${flag.message}`)
  })
} catch (error) {
  console.log('✗ Error:', error.message)
}

// Test 4: Conversation Flow
console.log('\nTest 4: Conversation Flow (Simulated)')
try {
  resetConversationEngine()
  const engine = getConversationEngine()
  const aiService = getAIService()
  const detector = getRedFlagDetector()
  
  engine.init('Rahul Sharma', 42, 'Male', 'Chest pain')
  
  const conversationLog = []
  let currentQuestion = engine.getCurrentQuestion()
  let stepCount = 0
  const maxSteps = 5 // Limit to 5 steps for testing
  
  while (currentQuestion && stepCount < maxSteps) {
    conversationLog.push({ step: stepCount + 1, question: currentQuestion.question })
    
    // Simulate answer
    let answer = ''
    if (currentQuestion.id === 'duration') answer = 'Since yesterday'
    else if (currentQuestion.id === 'character') answer = 'Pressure'
    else if (currentQuestion.id === 'dyspnea') answer = 'Yes, I have difficulty breathing'
    else if (currentQuestion.id === 'location') answer = 'Center of chest'
    else answer = 'Yes'
    
    const interpreted = aiService.interpretAnswerMock(currentQuestion, answer)
    engine.recordAnswer(currentQuestion.id, interpreted)
    
    conversationLog.push({ step: stepCount + 1, answer })
    
    currentQuestion = engine.getNextQuestion()
    stepCount++
  }
  
  console.log('✓ Conversation flow completed:')
  conversationLog.forEach((log) => {
    const prefix = log.question ? 'Q' : 'A'
    console.log(`  ${prefix}: ${log.question || log.answer}`)
  })
} catch (error) {
  console.log('✗ Error:', error.message)
}

console.log('\n=== All tests completed ===')
