/**
 * Clinical History Schema
 * Structured representation of patient history data
 */

export function createEmptyHistory() {
  return {
    patientInfo: {
      name: '',
      age: '',
      gender: '',
      abhaId: '',
    },
    chiefComplaint: '',
    historyOfPresentIllness: {
      onset: '',
      duration: '',
      location: '',
      character: '',
      severity: '',
      radiation: '',
      aggravatingFactors: [],
      relievingFactors: [],
      associatedSymptoms: [],
    },
    pastMedicalHistory: [],
    pastSurgicalHistory: [],
    currentMedications: [],
    allergies: [],
    familyHistory: [],
    personalHistory: {
      diet: '',
      sleep: '',
      smoking: '',
      alcohol: '',
      activity: '',
    },
    reviewOfSystems: {},
    ayushAssessment: {},
    redFlags: [],
    interviewProgress: {
      currentSection: 'chief_complaint',
      completedSections: [],
      questionsAnswered: 0,
      totalQuestions: 0,
    },
  }
}

export function updateHistory(history, path, value) {
  const keys = path.split('.')
  let current = history

  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]]
  }

  current[keys[keys.length - 1]] = value
  return history
}

export function getFromHistory(history, path) {
  const keys = path.split('.')
  let current = history

  for (let key of keys) {
    current = current[key]
    if (current === undefined) return undefined
  }

  return current
}

export function isHistoryComplete(history) {
  return (
    history.chiefComplaint &&
    history.historyOfPresentIllness.onset &&
    history.historyOfPresentIllness.character &&
    history.pastMedicalHistory.length >= 0 &&
    history.currentMedications.length >= 0
  )
}
