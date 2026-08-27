/**
 * Synthetic Demo Laboratory Report for Rahul Sharma
 * Used for SIH Prototype demonstration & fallback
 */

export const demoLabReportText = `City Diagnostic Center & Pathology Laboratory
NABL Accredited ISO 15189 | Reg No: LAB-DL-2024-882
Main Ring Road, South Extension, New Delhi - 110049
Phone: +91 11 4567 8900 | Web: www.citydiagnostic.org
================================================================================
PATIENT NAME : Rahul Sharma                 PATIENT ID  : CD-2026-90412
AGE / GENDER : 42 Yrs / Male                SAMPLE DATE : 12/08/2026 08:30 AM
REF. BY      : Dr. Anil Sharma              REPORT DATE : 12/08/2026 04:15 PM
SAMPLE TYPE  : Whole Blood / EDTA, Fluoride Plasma

DEPARTMENT OF HEMATOLOGY & BIOCHEMISTRY
--------------------------------------------------------------------------------
TEST NAME                     OBSERVED VALUE   UNIT       REFERENCE INTERVAL
--------------------------------------------------------------------------------
Hemoglobin                    13.2             g/dL       13.0 - 17.0
WBC Count                     7800             /µL        4000 - 11000
Platelets                     2.4 lakh         /µL        1.5 - 4.5 lakh
Fasting Blood Glucose         118              mg/dL      70 - 100
--------------------------------------------------------------------------------

CLINICAL NOTES:
- Fasting Glucose mildly elevated (Impaired Fasting Glucose / Prediabetes range).
- Hematology profile within normal biological reference limits.

[Consultant Pathologist: Dr. R. K. Verma, MD (Path)]
`

export const demoLabReportExtracted = {
  documentType: 'lab_report',
  fileName: 'lab_report_rahul_sharma_12aug.jpg',
  date: '2026-08-12',
  labName: 'City Diagnostic Center & Pathology Lab',
  patientName: 'Rahul Sharma',
  refDoctor: 'Dr. Anil Sharma',
  investigations: [
    {
      name: 'Hemoglobin',
      value: '13.2',
      unit: 'g/dL',
      referenceRange: '13.0 - 17.0',
      status: 'Normal',
      source: 'Previous Lab Report'
    },
    {
      name: 'WBC',
      value: '7800',
      unit: '/µL',
      referenceRange: '4000 - 11000',
      status: 'Normal',
      source: 'Previous Lab Report'
    },
    {
      name: 'Platelets',
      value: '2.4 lakh',
      unit: '/µL',
      referenceRange: '1.5 - 4.5 lakh',
      status: 'Normal',
      source: 'Previous Lab Report'
    },
    {
      name: 'Fasting Blood Glucose',
      value: '118',
      unit: 'mg/dL',
      referenceRange: '70 - 100',
      status: 'Borderline High',
      source: 'Previous Lab Report'
    }
  ],
  notes: 'Fasting Blood Glucose mildly elevated. Hematology parameters within normal limits.'
}

// Crisp synthetic SVG preview of a diagnostic laboratory report
export const demoLabReportImage = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="100%" height="100%">
  <defs>
    <linearGradient id="labHeaderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#115e59"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Paper background -->
  <rect width="600" height="800" fill="#ffffff" rx="12" filter="url(#shadow)"/>
  <rect x="15" y="15" width="570" height="770" fill="none" stroke="#e2e8f0" stroke-width="1.5" rx="8"/>

  <!-- Top Lab Header -->
  <rect x="15" y="15" width="570" height="90" fill="url(#labHeaderGrad)" rx="8"/>
  <text x="40" y="52" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">CITY DIAGNOSTIC CENTER</text>
  <text x="40" y="74" font-family="Arial, sans-serif" font-size="11" fill="#ccfbf1">ISO 15189 Accredited Automated Clinical Laboratory</text>
  <text x="560" y="50" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="end">Reg No: LAB-DL-2024-882</text>
  <text x="560" y="70" font-family="Arial, sans-serif" font-size="11" fill="#99f6e4" text-anchor="end">Phone: +91 11 4567 8900</text>
  <text x="560" y="86" font-family="Arial, sans-serif" font-size="10" fill="#99f6e4" text-anchor="end">South Extension, New Delhi</text>

  <!-- Patient Details Bar -->
  <rect x="35" y="120" width="530" height="70" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="6"/>
  <text x="50" y="145" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#475569">Patient:</text>
  <text x="115" y="145" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f766e">Rahul Sharma</text>
  
  <text x="320" y="145" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#475569">Sample Date:</text>
  <text x="415" y="145" font-family="Arial, sans-serif" font-size="11" fill="#0f172a">12/08/2026 08:30 AM</text>

  <text x="50" y="165" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#475569">Age / Gender:</text>
  <text x="135" y="165" font-family="Arial, sans-serif" font-size="11" fill="#0f172a">42 Y / Male</text>

  <text x="320" y="165" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#475569">Report Date:</text>
  <text x="415" y="165" font-family="Arial, sans-serif" font-size="11" fill="#0f172a">12/08/2026 04:15 PM</text>

  <text x="50" y="183" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#475569">Ref. By:</text>
  <text x="115" y="183" font-family="Arial, sans-serif" font-size="11" fill="#0f172a">Dr. Anil Sharma</text>

  <!-- Table Title -->
  <text x="35" y="218" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f766e">HAEMATOLOGY &amp; CLINICAL BIOCHEMISTRY</text>
  
  <!-- Table Header -->
  <rect x="35" y="230" width="530" height="30" fill="#f1f5f9" rx="4"/>
  <text x="50" y="250" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#334155">TEST NAME</text>
  <text x="260" y="250" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#334155">RESULT</text>
  <text x="360" y="250" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#334155">UNIT</text>
  <text x="450" y="250" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#334155">REF. INTERVAL</text>

  <!-- Row 1: Hemoglobin -->
  <line x1="35" y1="295" x2="565" y2="295" stroke="#f1f5f9" stroke-width="1"/>
  <text x="50" y="285" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Hemoglobin</text>
  <text x="260" y="285" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">13.2</text>
  <text x="360" y="285" font-family="Arial, sans-serif" font-size="12" fill="#64748b">g/dL</text>
  <text x="450" y="285" font-family="Arial, sans-serif" font-size="12" fill="#64748b">13.0 - 17.0</text>

  <!-- Row 2: WBC -->
  <line x1="35" y1="340" x2="565" y2="340" stroke="#f1f5f9" stroke-width="1"/>
  <text x="50" y="330" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">WBC (Total Leucocyte Count)</text>
  <text x="260" y="330" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">7800</text>
  <text x="360" y="330" font-family="Arial, sans-serif" font-size="12" fill="#64748b">/µL</text>
  <text x="450" y="330" font-family="Arial, sans-serif" font-size="12" fill="#64748b">4000 - 11000</text>

  <!-- Row 3: Platelets -->
  <line x1="35" y1="385" x2="565" y2="385" stroke="#f1f5f9" stroke-width="1"/>
  <text x="50" y="375" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Platelet Count</text>
  <text x="260" y="375" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">2.4 lakh</text>
  <text x="360" y="375" font-family="Arial, sans-serif" font-size="12" fill="#64748b">/µL</text>
  <text x="450" y="375" font-family="Arial, sans-serif" font-size="12" fill="#64748b">1.5 - 4.5 lakh</text>

  <!-- Row 4: Fasting Blood Glucose -->
  <line x1="35" y1="430" x2="565" y2="430" stroke="#f1f5f9" stroke-width="1"/>
  <text x="50" y="420" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Fasting Blood Glucose</text>
  <text x="260" y="420" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#d97706">118 *</text>
  <text x="360" y="420" font-family="Arial, sans-serif" font-size="12" fill="#64748b">mg/dL</text>
  <text x="450" y="420" font-family="Arial, sans-serif" font-size="12" fill="#64748b">70 - 100</text>

  <!-- Report Notes -->
  <rect x="35" y="480" width="530" height="90" fill="#f8fafc" stroke="#e2e8f0" rx="6"/>
  <text x="50" y="505" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">Clinical Laboratory Comments:</text>
  <text x="50" y="528" font-family="Arial, sans-serif" font-size="11" fill="#475569">• Fasting Blood Glucose is mildly elevated above normal fasting baseline (118 mg/dL).</text>
  <text x="50" y="546" font-family="Arial, sans-serif" font-size="11" fill="#475569">• Complete blood count and platelet parameters within standard biological reference ranges.</text>

  <!-- Doctor Stamp -->
  <g transform="translate(370, 640)">
    <text x="80" y="45" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f766e" text-anchor="middle">Dr. R. K. Verma, MD</text>
    <text x="80" y="60" font-family="Arial, sans-serif" font-size="10" fill="#64748b" text-anchor="middle">Consultant Pathologist</text>
    <circle cx="80" cy="35" r="38" fill="none" stroke="#0f766e" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6"/>
  </g>

  <!-- Footer Watermark -->
  <text x="300" y="770" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">SIH26047 MediKiosk • Synthetic Laboratory Demonstration Record</text>
</svg>
`)}`
