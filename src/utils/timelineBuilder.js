/**
 * Timeline Builder Utility
 * Dynamically builds a chronological timeline combining past documents and current intake consultation.
 */

export function buildMedicalTimeline(documents = [], patientHistory = {}) {
  const eventsByDate = {}

  // 1. Process confirmed or uploaded documents
  if (Array.isArray(documents)) {
    documents.forEach((doc) => {
      const data = doc.confirmedData || doc.extractedData || {}
      const dateKey = data.date || '12 Aug 2026'

      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = []
      }

      if (doc.type === 'prescription') {
        eventsByDate[dateKey].push({
          id: doc.id || `rx_${dateKey}`,
          type: 'prescription',
          title: 'Prescription',
          facility: data.doctorName || data.clinicName || 'Attending Physician',
          items: (data.medications || []).map((m) => `${m.name} ${m.dosage || ''} (${m.frequency || ''})`.trim()),
          rawDoc: doc,
        })
      } else if (doc.type === 'lab_report') {
        eventsByDate[dateKey].push({
          id: doc.id || `lab_${dateKey}`,
          type: 'lab_report',
          title: 'Laboratory Report',
          facility: data.labName || 'Diagnostic Laboratory',
          items: (data.investigations || []).map((inv) => `${inv.name}: ${inv.value} ${inv.unit || ''}`.trim()),
          rawDoc: doc,
        })
      }
    })
  }

  // 2. Add Current Intake Consultation Node
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const currentChiefComplaint = patientHistory.chiefComplaint || 'Chest pain'
  const currentSymptoms = []

  if (patientHistory.historyOfPresentIllness?.onset) {
    currentSymptoms.push(`Onset: ${patientHistory.historyOfPresentIllness.onset}`)
  }
  if (patientHistory.historyOfPresentIllness?.character) {
    currentSymptoms.push(`Character: ${patientHistory.historyOfPresentIllness.character}`)
  }
  if (patientHistory.historyOfPresentIllness?.associatedSymptoms?.length > 0) {
    currentSymptoms.push(`Associated: ${patientHistory.historyOfPresentIllness.associatedSymptoms.join(', ')}`)
  }
  if (patientHistory.redFlags?.length > 0) {
    currentSymptoms.push(`Priority Alert: Red-flag symptoms identified`)
  }

  if (!eventsByDate[todayFormatted]) {
    eventsByDate[todayFormatted] = []
  }

  eventsByDate[todayFormatted].unshift({
    id: 'current_intake_consultation',
    type: 'consultation',
    title: 'Current Intake Consultation',
    facility: 'MediKiosk Automated Intake',
    chiefComplaint: currentChiefComplaint,
    items: currentSymptoms.length > 0 ? currentSymptoms : ['Intake history recorded via MediKiosk'],
    isCurrent: true,
  })

  // Return sorted dates (newest first or chronologically structured)
  const sortedDates = Object.keys(eventsByDate).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime()
  })

  return sortedDates.map((date) => ({
    date,
    events: eventsByDate[date],
  }))
}
