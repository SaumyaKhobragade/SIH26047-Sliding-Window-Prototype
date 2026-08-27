/**
 * Unified Clinical Case Summary Service
 * Aggregates all patient intake facets (Conversation, Documents, Labs, AYUSH, Red Flags) into a single structured clinical case.
 */

import { buildMedicalTimeline } from '../utils/timelineBuilder'
import { demoPrescriptionExtracted, demoPrescriptionImage, demoPrescriptionText } from '../data/documents/demoPrescription'
import { demoLabReportExtracted, demoLabReportImage, demoLabReportText } from '../data/documents/demoLabReport'
import { demoAyushResponses } from '../data/clinical/ayushQuestions'

export class CaseSummaryService {
  /**
   * Build complete unified case object from patient history state
   */
  buildUnifiedCase(patientHistory = {}) {
    const info = patientHistory.patientInfo || {}
    const hpi = patientHistory.historyOfPresentIllness || {}
    const rawDocs = Array.isArray(patientHistory.documents) && patientHistory.documents.length > 0
      ? patientHistory.documents
      : this.getDefaultDemoDocuments()

    const confirmedDocs = rawDocs.filter((d) => d.status === 'confirmed' || d.status === 'processed')

    // 1. Consolidated Medications (Interview + Previous Prescriptions)
    const medications = this.consolidateMedications(patientHistory.currentMedications, confirmedDocs)

    // 2. Extracted Lab Investigations
    const investigations = this.extractInvestigations(confirmedDocs)

    // 3. AYUSH Assessment
    const ayushAssessment = patientHistory.ayushAssessment && (patientHistory.ayushAssessment.prakriti || patientHistory.ayushAssessment.agni)
      ? patientHistory.ayushAssessment
      : demoAyushResponses

    // 4. Red Flags
    const redFlags = Array.isArray(patientHistory.redFlags) && patientHistory.redFlags.length > 0
      ? patientHistory.redFlags
      : [
          'Potential red-flag symptoms detected: Shortness of breath with central chest pain.',
          'Priority triage recommended: Risk profile for acute coronary syndrome evaluation.',
        ]

    // 5. Case Status Determination
    const hasRedFlags = redFlags.length > 0
    let caseStatus = patientHistory.caseStatus || (hasRedFlags ? 'priority' : 'ready')

    // 6. Dynamic Medical Timeline
    const medicalTimeline = buildMedicalTimeline(confirmedDocs, patientHistory)

    // 7. Clinical Narrative Generation
    const clinicalNarrative = this.generateClinicalNarrative(info, patientHistory.chiefComplaint, hpi, redFlags, medications)

    return {
      patient: {
        name: info.name || 'Rahul Sharma',
        age: info.age || 42,
        gender: info.gender || 'Male',
        abhaId: info.abhaId || 'Demo-ABHA-001',
        phone: info.phone || '+91 98765 43210',
        clinicalMode: localStorage.getItem('selectedClinicalMode') || 'ayush',
      },
      chiefComplaint: patientHistory.chiefComplaint || 'Chest pain',
      clinicalHistory: {
        hpi: {
          onset: hpi.onset || 'Yesterday evening',
          duration: hpi.duration || 'Since yesterday',
          location: hpi.location || 'Central chest',
          character: hpi.character || 'Pressure-like',
          severity: hpi.severity || '7',
          radiation: hpi.radiation || 'Left shoulder & upper chest',
          aggravatingFactors: hpi.aggravatingFactors || ['Physical exertion', 'Walking uphill'],
          relievingFactors: hpi.relievingFactors || ['None with rest'],
          associatedSymptoms: hpi.associatedSymptoms || ['Shortness of breath', 'Mild perspiration'],
        },
        pastMedicalHistory: Array.isArray(patientHistory.pastMedicalHistory) && patientHistory.pastMedicalHistory.length > 0
          ? patientHistory.pastMedicalHistory
          : ['Hypertension (diagnosed 5 years ago)', 'No diabetes', 'No prior cardiac events'],
        pastSurgicalHistory: patientHistory.pastSurgicalHistory || ['None reported'],
        allergies: Array.isArray(patientHistory.allergies) && patientHistory.allergies.length > 0
          ? patientHistory.allergies
          : [{ allergen: 'Penicillin', reaction: 'Skin rash & hives' }],
        personalHistory: patientHistory.personalHistory || {
          smoking: 'Non-smoker',
          alcohol: 'Occasional social',
          diet: 'Mixed',
          sleep: '6-7 hours, sometimes broken',
          activity: 'Moderately active',
        },
      },
      redFlags,
      documents: rawDocs,
      medications,
      investigations,
      ayushAssessment,
      medicalTimeline,
      caseStatus, // 'draft' | 'ready' | 'priority' | 'reviewed'
      clinicalNarrative,
      updatedAt: new Date().toISOString(),
    }
  }

  /**
   * Consolidate medications from interview and uploaded documents with deduplication and source tags
   */
  consolidateMedications(interviewMeds = [], confirmedDocs = []) {
    const list = []
    const seenNames = new Set()

    // 1. Process prescription documents first (usually have exact dosage and frequency)
    confirmedDocs
      .filter((d) => d.type === 'prescription')
      .forEach((doc) => {
        const data = doc.confirmedData || doc.extractedData || {}
        if (Array.isArray(data.medications)) {
          data.medications.forEach((med) => {
            const key = med.name.toLowerCase().trim()
            seenNames.add(key)
            list.push({
              name: med.name,
              dosage: med.dosage || '5 mg',
              frequency: med.frequency || '1-0-0',
              timing: med.timing || 'Morning after food',
              source: `Previous Prescription (${data.date || '12 Aug 2026'})`,
              isPrescription: true,
            })
          })
        }
      })

    // 2. Process interview medications
    if (Array.isArray(interviewMeds)) {
      interviewMeds.forEach((m) => {
        const name = typeof m === 'string' ? m : m.name
        if (!name) return
        const key = name.toLowerCase().trim()

        if (seenNames.has(key)) {
          // If already in list from prescription, enhance source tag to indicate both
          const existing = list.find((item) => item.name.toLowerCase().trim() === key)
          if (existing) {
            existing.source = 'Patient Interview + Previous Prescription'
          }
        } else {
          seenNames.add(key)
          list.push({
            name,
            dosage: typeof m === 'object' && m.dosage ? m.dosage : 'As reported',
            frequency: typeof m === 'object' && m.frequency ? m.frequency : 'Once daily',
            source: 'Patient Interview',
            isPrescription: false,
          })
        }
      })
    }

    if (list.length === 0) {
      list.push(
        { name: 'Amlodipine', dosage: '5 mg', frequency: '1-0-0', timing: 'Morning', source: 'Patient Interview + Previous Prescription' },
        { name: 'Paracetamol', dosage: '650 mg', frequency: 'SOS', timing: 'When pain occurs', source: 'Previous Prescription (12 Aug 2026)' }
      )
    }

    return list
  }

  /**
   * Extract investigations from lab report documents
   */
  extractInvestigations(confirmedDocs = []) {
    const list = []

    confirmedDocs
      .filter((d) => d.type === 'lab_report')
      .forEach((doc) => {
        const data = doc.confirmedData || doc.extractedData || {}
        if (Array.isArray(data.investigations)) {
          data.investigations.forEach((inv) => {
            list.push({
              name: inv.name,
              value: inv.value,
              unit: inv.unit,
              referenceRange: inv.referenceRange || '—',
              status: inv.status || 'Normal',
              date: data.date || '12/08/2026',
              labName: data.labName || 'City Diagnostic Center',
              source: `Laboratory Report (${data.date || '12 Aug 2026'})`,
            })
          })
        }
      })

    if (list.length === 0) {
      list.push(
        { name: 'Hemoglobin', value: '13.2', unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Normal', date: '12/08/2026', source: 'Laboratory Report' },
        { name: 'WBC Count', value: '7800', unit: '/µL', referenceRange: '4000 - 11000', status: 'Normal', date: '12/08/2026', source: 'Laboratory Report' },
        { name: 'Platelets', value: '2.4 lakh', unit: '/µL', referenceRange: '1.5 - 4.5 lakh', status: 'Normal', date: '12/08/2026', source: 'Laboratory Report' },
        { name: 'Fasting Blood Glucose', value: '118', unit: 'mg/dL', referenceRange: '70 - 100', status: 'Borderline High', date: '12/08/2026', source: 'Laboratory Report' }
      )
    }

    return list
  }

  /**
   * Concise clinical narrative draft generator
   */
  generateClinicalNarrative(patient, chiefComplaint, hpi, redFlags, medications) {
    const age = patient.age || 42
    const gender = patient.gender || 'male'
    const cc = chiefComplaint || 'chest pain'
    const onset = hpi.onset || 'yesterday evening'
    const char = hpi.character || 'pressure-like'
    const rad = hpi.radiation || 'left shoulder'
    const assoc = (hpi.associatedSymptoms || ['shortness of breath']).join(', ')

    return `${patient.name || 'Patient'} (${age}Y/${gender.charAt(0).toUpperCase()}) presents with acute ${cc} since ${onset}. Pain is characterized as ${char}, radiating to ${rad}, and accompanied by ${assoc}. Known history of hypertension managed on ${medications.map(m => m.name).join(', ')}. Red-flag symptoms identified for priority physician evaluation.`
  }

  /**
   * Default synthetic demo documents for Rahul Sharma
   */
  getDefaultDemoDocuments() {
    return [
      {
        id: 'doc_demo_rx_01',
        type: 'prescription',
        fileName: 'Prescription_DrAnilSharma_12Aug.jpg',
        fileSize: '184 KB',
        uploadedAt: '2026-08-12T10:30:00.000Z',
        status: 'confirmed',
        previewUrl: demoPrescriptionImage,
        ocrText: demoPrescriptionText,
        ocrConfidence: 0.96,
        confirmedData: demoPrescriptionExtracted,
        extractedData: demoPrescriptionExtracted,
      },
      {
        id: 'doc_demo_lab_02',
        type: 'lab_report',
        fileName: 'LabReport_CityDiagnostic_12Aug.jpg',
        fileSize: '210 KB',
        uploadedAt: '2026-08-12T16:15:00.000Z',
        status: 'confirmed',
        previewUrl: demoLabReportImage,
        ocrText: demoLabReportText,
        ocrConfidence: 0.98,
        confirmedData: demoLabReportExtracted,
        extractedData: demoLabReportExtracted,
      },
    ]
  }
}

// Singleton
let caseSummaryServiceInstance = null

export function getCaseSummaryService() {
  if (!caseSummaryServiceInstance) {
    caseSummaryServiceInstance = new CaseSummaryService()
  }
  return caseSummaryServiceInstance
}
