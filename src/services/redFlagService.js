/**
 * Red Flag Detection Service
 * Identifies potentially concerning symptom combinations
 */

export class RedFlagDetector {
  constructor() {
    this.redFlags = []
  }

  /**
   * Analyze patient history for red flags
   */
  analyzeHistory(history) {
    this.redFlags = []

    // Check for chest pain red flags
    if (history.chiefComplaint && history.chiefComplaint.toLowerCase().includes('chest')) {
      this.checkChestPainRedFlags(history)
    }

    return this.redFlags
  }

  /**
   * Check chest pain specific red flags
   */
  checkChestPainRedFlags(history) {
    const hpi = history.historyOfPresentIllness

    // Red flag: Severe chest pain
    if (
      hpi.severity &&
      (hpi.severity.includes('9') || hpi.severity.includes('10') || hpi.severity.includes('8'))
    ) {
      this.addRedFlag({
        type: 'severe_pain',
        severity: 'high',
        message: 'Severe chest pain (8-10/10 severity)',
      })
    }

    // Red flag: Chest pain + dyspnea
    if (
      hpi.associatedSymptoms &&
      hpi.associatedSymptoms.some(
        (s) =>
          s.toLowerCase().includes('dyspnea') ||
          s.toLowerCase().includes('breath') ||
          s.toLowerCase().includes('breathing')
      )
    ) {
      this.addRedFlag({
        type: 'chest_pain_with_dyspnea',
        severity: 'high',
        message: 'Chest pain with shortness of breath',
      })
    }

    // Red flag: Radiation to arm/shoulder/jaw
    if (
      hpi.radiation &&
      (hpi.radiation.toLowerCase().includes('arm') ||
        hpi.radiation.toLowerCase().includes('shoulder') ||
        hpi.radiation.toLowerCase().includes('jaw'))
    ) {
      this.addRedFlag({
        type: 'pain_radiation',
        severity: 'high',
        message: 'Pain radiating to arm, shoulder, or jaw',
      })
    }

    // Red flag: Associated sweating or nausea
    if (
      hpi.associatedSymptoms &&
      hpi.associatedSymptoms.some(
        (s) =>
          s.toLowerCase().includes('sweat') ||
          s.toLowerCase().includes('nausea') ||
          s.toLowerCase().includes('vomit')
      )
    ) {
      this.addRedFlag({
        type: 'constitutional_symptoms',
        severity: 'high',
        message: 'Chest pain with sweating and/or nausea',
      })
    }

    // Red flag: Prolonged duration (>6 hours)
    if (
      hpi.duration &&
      (hpi.duration.toLowerCase().includes('6-24') || hpi.duration.toLowerCase().includes('more'))
    ) {
      this.addRedFlag({
        type: 'prolonged_duration',
        severity: 'medium',
        message: 'Chest pain lasting more than 6 hours',
      })
    }

    // Red flag: Risk factors + chest pain
    if (history.pastMedicalHistory && history.pastMedicalHistory.length > 0) {
      const risks = history.pastMedicalHistory.join(' ').toLowerCase()
      if (
        risks.includes('hypertension') ||
        risks.includes('diabetes') ||
        risks.includes('heart') ||
        risks.includes('smoking')
      ) {
        this.addRedFlag({
          type: 'cardiac_risk_factors',
          severity: 'high',
          message: 'Chest pain with significant cardiac risk factors',
        })
      }
    }
  }

  /**
   * Add a red flag
   */
  addRedFlag(flag) {
    // Avoid duplicates
    if (!this.redFlags.some((f) => f.type === flag.type)) {
      this.redFlags.push({
        ...flag,
        timestamp: new Date(),
      })
    }
  }

  /**
   * Get all red flags
   */
  getRedFlags() {
    return this.redFlags
  }

  /**
   * Check if any high-severity flags exist
   */
  hasHighSeverityFlags() {
    return this.redFlags.some((f) => f.severity === 'high')
  }

  /**
   * Clear red flags
   */
  clear() {
    this.redFlags = []
  }
}

// Singleton instance
let detector = null

export function getRedFlagDetector() {
  if (!detector) {
    detector = new RedFlagDetector()
  }
  return detector
}

export function resetRedFlagDetector() {
  detector = new RedFlagDetector()
  return detector
}
