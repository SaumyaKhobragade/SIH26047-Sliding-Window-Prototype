export const commonQuestions = {
  pastMedicalHistory: {
    question: 'Do you have any past medical conditions? (e.g., hypertension, diabetes, heart disease)',
    type: 'text',
    fieldPath: 'pastMedicalHistory',
    category: 'past_medical_history',
  },
  currentMedications: {
    question: 'What medications are you currently taking?',
    type: 'text',
    fieldPath: 'currentMedications',
    category: 'medications',
  },
  allergies: {
    question: 'Do you have any allergies to medications or foods?',
    type: 'text',
    fieldPath: 'allergies',
    category: 'allergies',
  },
  smoking: {
    question: 'Do you smoke?',
    type: 'choice',
    options: ['Never', 'Former smoker', 'Current smoker'],
    fieldPath: 'personalHistory.smoking',
    category: 'lifestyle',
  },
  alcohol: {
    question: 'Do you consume alcohol?',
    type: 'choice',
    options: ['Never', 'Occasionally', 'Regularly'],
    fieldPath: 'personalHistory.alcohol',
    category: 'lifestyle',
  },
}

export const baselineQuestions = [
  {
    id: 'cc_1',
    question: 'What brings you here today? What is bothering you?',
    type: 'text',
    fieldPath: 'chiefComplaint',
    category: 'chief_complaint',
    required: true,
  },
]
