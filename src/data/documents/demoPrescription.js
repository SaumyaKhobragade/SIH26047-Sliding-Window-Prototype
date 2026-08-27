/**
 * Synthetic Demo Prescription for Rahul Sharma
 * Used for SIH Prototype demonstration & fallback
 */

export const demoPrescriptionText = `Dr. Anil Sharma (MD, General Medicine)
Reg No: MCI-2018-9942 | City Care Clinic, New Delhi
Phone: +91 11 2345 6789 | Email: dr.sharma@citycare.org
============================================================
Patient: Rahul Sharma          Age: 42 / Male
Date: 12/08/2026               ABHA ID: Demo-ABHA-001
Diagnosis: Primary Hypertension

Rx:
1. Tab. Amlodipine 5 mg
   1-0-0 (Morning after breakfast) - 30 days

2. Tab. Paracetamol 650 mg
   SOS (As needed for pain/headache, max 3/day) - 10 tabs

Advise:
- Low sodium diet (< 2g/day)
- Regular BP monitoring twice a week
- Review in 4 weeks with fresh lipid & glucose panel

[Signed: Dr. Anil Sharma, MD]
`

export const demoPrescriptionExtracted = {
  documentType: 'prescription',
  fileName: 'prescription_rahul_sharma_12aug.jpg',
  date: '2026-08-12',
  doctorName: 'Dr. Anil Sharma',
  clinicName: 'City Care Clinic, New Delhi',
  patientName: 'Rahul Sharma',
  diagnosis: 'Primary Hypertension',
  medications: [
    {
      name: 'Amlodipine',
      dosage: '5 mg',
      frequency: '1-0-0',
      timing: 'Morning after breakfast',
      duration: '30 days',
      source: 'Previous Prescription'
    },
    {
      name: 'Paracetamol',
      dosage: '650 mg',
      frequency: 'SOS',
      timing: 'As needed for headache/pain',
      duration: '10 tabs',
      source: 'Previous Prescription'
    }
  ],
  instructions: 'Low sodium diet, regular BP monitoring twice a week, review in 4 weeks.'
}

// Crisp synthetic SVG preview of a clinical prescription
export const demoPrescriptionImage = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="100%" height="100%">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Paper background -->
  <rect width="600" height="800" fill="#ffffff" rx="12" filter="url(#shadow)"/>
  <rect x="15" y="15" width="570" height="770" fill="none" stroke="#e2e8f0" stroke-width="1.5" rx="8"/>

  <!-- Top Clinic Header -->
  <rect x="15" y="15" width="570" height="90" fill="url(#headerGrad)" rx="8"/>
  <text x="40" y="52" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">CITY CARE CLINIC</text>
  <text x="40" y="74" font-family="Arial, sans-serif" font-size="12" fill="#e0f2fe">Comprehensive Healthcare &amp; Diagnostic Services</text>
  <text x="560" y="50" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="end">Dr. Anil Sharma, MD</text>
  <text x="560" y="70" font-family="Arial, sans-serif" font-size="11" fill="#bae6fd" text-anchor="end">Reg No: MCI-2018-9942</text>
  <text x="560" y="86" font-family="Arial, sans-serif" font-size="10" fill="#bae6fd" text-anchor="end">Phone: +91 11 2345 6789</text>

  <!-- Patient Details Bar -->
  <rect x="35" y="125" width="530" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="6"/>
  <text x="50" y="150" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">Patient Name:</text>
  <text x="145" y="150" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0284c7">Rahul Sharma</text>
  
  <text x="360" y="150" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">Date:</text>
  <text x="405" y="150" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">12/08/2026</text>

  <text x="50" y="172" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">Age / Gender:</text>
  <text x="145" y="172" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">42 Yrs / Male</text>

  <text x="360" y="172" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">Diagnosis:</text>
  <text x="435" y="172" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">Hypertension</text>

  <!-- Rx Symbol -->
  <text x="45" y="230" font-family="'Times New Roman', serif" font-size="34" font-weight="bold" font-style="italic" fill="#0284c7">Rx</text>
  <line x1="35" y1="245" x2="565" y2="245" stroke="#0284c7" stroke-width="1.5"/>

  <!-- Medication 1 -->
  <circle cx="55" cy="280" r="5" fill="#0284c7"/>
  <text x="75" y="284" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">Tab. Amlodipine 5 mg</text>
  <rect x="75" y="296" width="70" height="22" fill="#e0f2fe" rx="4"/>
  <text x="110" y="311" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0369a1" text-anchor="middle">1 - 0 - 0</text>
  <text x="160" y="312" font-family="Arial, sans-serif" font-size="13" fill="#475569">Morning after breakfast — 30 Days</text>

  <!-- Medication 2 -->
  <circle cx="55" cy="360" r="5" fill="#0284c7"/>
  <text x="75" y="364" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">Tab. Paracetamol 650 mg</text>
  <rect x="75" y="376" width="60" height="22" fill="#fef3c7" rx="4"/>
  <text x="105" y="391" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#b45309" text-anchor="middle">S O S</text>
  <text x="150" y="392" font-family="Arial, sans-serif" font-size="13" fill="#475569">When pain / headache occurs — 10 Tablets</text>

  <!-- Clinical Advice -->
  <line x1="35" y1="440" x2="565" y2="440" stroke="#e2e8f0" stroke-width="1"/>
  <text x="45" y="470" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#334155">General Advice &amp; Lifestyle:</text>
  <text x="65" y="498" font-family="Arial, sans-serif" font-size="13" fill="#475569">• Low sodium diet (avoid excess salt and fried items)</text>
  <text x="65" y="522" font-family="Arial, sans-serif" font-size="13" fill="#475569">• Monitor Blood Pressure weekly &amp; maintain log</text>
  <text x="65" y="546" font-family="Arial, sans-serif" font-size="13" fill="#475569">• Review after 4 weeks with fresh fasting glucose panel</text>

  <!-- Doctor Signature & Stamp -->
  <g transform="translate(380, 640)">
    <path d="M 10 30 Q 35 5, 60 25 T 110 20 T 150 35" fill="none" stroke="#1e293b" stroke-width="2"/>
    <text x="75" y="55" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="middle">Dr. Anil Sharma</text>
    <text x="75" y="70" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">MD, Internal Medicine</text>
    <rect x="10" y="0" width="130" height="80" fill="none" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,4" rx="6" opacity="0.6"/>
  </g>

  <!-- Footer Watermark -->
  <text x="300" y="770" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">SIH26047 MediKiosk • Synthetic Clinical Demonstration Document</text>
</svg>
`)}`
