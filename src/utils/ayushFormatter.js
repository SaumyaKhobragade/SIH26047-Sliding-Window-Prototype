/**
 * AYUSH Data Formatter Utility
 * Formats patient responses into structured labels with clinical context.
 */

export function formatPrakriti(value) {
  if (!value) return 'Not assessed'
  if (value === 'not_sure') return 'Unsure / Mixed (Pending physician review)'
  return `Patient-reported: ${value}`
}

export function formatAgni(value) {
  if (!value) return 'Not assessed'
  const mapping = {
    'Slow': 'Slow / Heavy (Manda Agni)',
    'Moderate': 'Balanced (Sama Agni)',
    'Strong': 'Intense / Rapid (Tikshna Agni)',
    'Irregular': 'Variable / Irregular (Visham Agni)'
  }
  return mapping[value] || value
}

export function formatKoshtha(value) {
  if (!value) return 'Not assessed'
  const mapping = {
    'Easy / regular': 'Easy & Regular (Mridu/Madhya Koshtha)',
    'Sometimes irregular': 'Variable / Sensitive (Madhyama Koshtha)',
    'Usually difficult': 'Constipation-Prone (Krura Koshtha)'
  }
  return mapping[value] || value
}

export function formatAharaShakti(value) {
  if (!value) return 'Not assessed'
  const mapping = {
    'Low': 'Low Capacity (Avara Ahara Shakti)',
    'Moderate': 'Moderate Capacity (Madhyama Ahara Shakti)',
    'Good': 'Strong / Good Capacity (Pravara Ahara Shakti)'
  }
  return mapping[value] || value
}

export function formatVyayamaShakti(value) {
  if (!value) return 'Not assessed'
  const mapping = {
    'Low': 'Low Stamina (Avara Vyayama Shakti)',
    'Moderate': 'Moderate Stamina (Madhyama Vyayama Shakti)',
    'High': 'High Stamina (Pravara Vyayama Shakti)'
  }
  return mapping[value] || value
}

export function formatAharaVihara(aharaVihara) {
  if (!aharaVihara || typeof aharaVihara !== 'object') {
    return { diet: 'Not provided', sleep: 'Not provided', activity: 'Not provided' }
  }
  return {
    diet: aharaVihara.diet || 'Not provided',
    sleep: aharaVihara.sleep || 'Not provided',
    activity: aharaVihara.activity || 'Not provided'
  }
}
