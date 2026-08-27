export const summaryData = {
  clinicalSummary: {
    patientInfo: {
      name: 'Rahul Sharma',
      age: 42,
      gender: 'Male',
      abhaId: 'ABHA_00001234567890',
      dateOfCapture: new Date(),
    },
    chiefComplaint: 'Chest pain',
    historyOfPresentIllness: 'Patient reports sudden onset of chest pain since yesterday evening. The pain is described as pressure-like, located centrally in the chest, and is associated with shortness of breath, especially on exertion. The patient reports no relief with rest. No radiation of pain to the arms or jaw. Associated with mild perspiration.',
    pastMedicalHistory: [
      'Hypertension (diagnosed 5 years ago)',
      'No diabetes',
      'No thyroid disorder',
      'No history of cardiac disease'
    ],
    currentMedications: [
      { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
      { name: 'Aspirin', dosage: '75mg', frequency: 'Once daily' }
    ],
    allergies: [
      { allergen: 'Penicillin', reaction: 'Rash' }
    ],
    previousInvestigations: [
      { test: 'Blood Pressure', value: '145/92 mmHg', status: 'Elevated', date: '2024-02-15' },
      { test: 'Total Cholesterol', value: '198 mg/dL', status: 'Borderline High', date: '2024-02-15' },
      { test: 'Hemoglobin', value: '14.2 g/dL', status: 'Normal', date: '2024-02-15' }
    ],
    ayushAssessment: {
      prakrti: 'Pitta',
      agni: 'Sama Agni',
      koshtha: 'Madhya Koshtha',
      aharaShakti: 'Strong',
      vyayamaShakti: 'Moderate'
    },
    redFlags: [
      'Central chest pain with pressure quality',
      'Associated dyspnea on exertion',
      'Hypertension history',
      'Age and gender risk profile for acute coronary syndrome'
    ]
  }
}
