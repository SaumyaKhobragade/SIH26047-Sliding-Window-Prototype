import { useState, useRef } from 'react'

const MOCK_PRESCRIPTIONS = [
  {
    id: 1,
    filename: 'prescription_dr_shah_2024.jpg',
    doctor: 'Dr. A. Shah',
    date: '06 Jun 2026',
    medications: [
      { name: 'Paracetamol 650', strength: '650 mg', frequency: 'After meals · 3 days', confidence: 94 },
      { name: 'Pantoprazole', strength: '40 mg', frequency: 'Before breakfast · 5 days', confidence: 91 },
      { name: 'Vitamin D3', strength: '60k IU', frequency: 'Once weekly · 4 weeks', confidence: 88 },
    ],
    ocrRawConfidence: 87,
  },
  {
    id: 2,
    filename: 'lab_report_pathology_2025.jpg',
    doctor: 'City Pathology Lab',
    date: '20 Feb 2025',
    labValues: [
      { test: 'HbA1c', value: '8.1%', reference: '< 7.0%', status: 'abnormal' },
      { test: 'Fasting Blood Sugar', value: '165 mg/dL', reference: '70-100 mg/dL', status: 'abnormal' },
      { test: 'Total Cholesterol', value: '242 mg/dL', reference: '< 200 mg/dL', status: 'abnormal' },
      { test: 'Serum Creatinine', value: '0.9 mg/dL', reference: '0.7-1.3 mg/dL', status: 'normal' },
    ],
    ocrRawConfidence: 92,
  },
  {
    id: 3,
    filename: 'prescription_dr_patel_2025.jpg',
    doctor: 'Dr. R. Patel',
    date: '28 Feb 2025',
    medications: [
      { name: 'Glimepiride', strength: '1mg', frequency: 'Once daily before breakfast', confidence: 88 },
      { name: 'Atorvastatin', strength: '10mg', frequency: 'Once daily at bedtime', confidence: 85 },
    ],
    ocrRawConfidence: 83,
    fuzzyCorrection: { from: 'Glimepride', to: 'Glimepiride', confidence: 96 },
  },
]

export default function PrescriptionStep({ patient, patientId, apiBase, onComplete, onBack }) {
  const [scannedDocs, setScannedDocs] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanIndex, setScanIndex] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('Prescription image')

  const simulateScan = () => {
    if (scanIndex >= MOCK_PRESCRIPTIONS.length) return
    setIsScanning(true)
    setTimeout(() => {
      const doc = MOCK_PRESCRIPTIONS[scanIndex]
      setScannedDocs(prev => [...prev, doc])
      setScanIndex(prev => prev + 1)
      setUploadStatus(doc.filename)
      setIsScanning(false)
    }, 2000)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !patientId || !apiBase) { simulateScan(); return }
    setIsScanning(true)
    try {
      const formData = new FormData()
      formData.append('patient_id', patientId)
      formData.append('document', file)
      const res = await fetch(`${apiBase}/prescription/scan`, { method: 'POST', body: formData })
      if (res.ok) {
        const result = await res.json()
        setScannedDocs(prev => [...prev, {
          id: Date.now(), filename: file.name,
          doctor: result.doctor_name || 'Unknown Doctor',
          date: result.date || new Date().toISOString().split('T')[0],
          medications: result.medications || [],
          labValues: result.lab_values || [],
          diagnosis: result.diagnosis || '',
          ocrRawConfidence: Math.round((result.ocr_confidence || 0.85) * 100),
          corrections: result.corrections || [],
        }])
        setScanIndex(prev => prev + 1)
        setUploadStatus(file.name)
      } else { simulateScan(); return }
    } catch (err) { console.warn('Backend OCR unavailable, using mock:', err.message); simulateScan(); return }
    setIsScanning(false)
  }

  const handleScanClick = () => {
    if (patientId && apiBase) {
      const input = document.createElement('input')
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
      input.onchange = handleFileUpload; input.click()
    } else { simulateScan() }
  }

  const handleComplete = () => {
    onComplete(scannedDocs.length > 0 ? scannedDocs : MOCK_PRESCRIPTIONS)
  }

  // Use first scanned doc for the extract panel, or mock
  const displayDoc = scannedDocs[0] || MOCK_PRESCRIPTIONS[0]
  const displayMeds = displayDoc?.medications || []

  return (
    <>
      <div className="screen-heading compact-heading">
        <span className="eyebrow">YOUR MEDICAL RECORDS</span>
        <h1>Bring your history<br /><i>with you.</i></h1>
        <p>Upload an old prescription and we'll make it easy to review.</p>
      </div>

      <div className="records-grid">
        {/* Upload panel */}
        <div
          className="upload-panel"
          onClick={scanIndex < MOCK_PRESCRIPTIONS.length ? handleScanClick : undefined}
          style={{ cursor: scanIndex < MOCK_PRESCRIPTIONS.length ? 'pointer' : 'default' }}
        >
          <input type="file" id="prescriptionFile" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          <div className="paper-icon">
            <span /><span /><span />
            {isScanning
              ? <i style={{ animation: 'spin 1s linear infinite', background: 'var(--accent-teal-dim)' }}>⟳</i>
              : <i>+</i>}
          </div>

          {isScanning ? (
            <>
              <h3>Scanning &amp;<br />Extracting…</h3>
              <p style={{ color: 'var(--accent-teal)' }}>Sarvam Vision OCR → LLM → Drug Match</p>
            </>
          ) : scanIndex < MOCK_PRESCRIPTIONS.length ? (
            <>
              <h3>Prescription, report<br />or medicine label</h3>
              <p>Drag it here, or choose a photo</p>
              <button className="upload-button" id="chooseFile" onClick={e => { e.stopPropagation(); handleScanClick() }}>
                Choose file <span>↗</span>
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40 }}>✅</div>
              <h3>All documents<br />uploaded</h3>
              <p style={{ color: 'var(--accent-green)' }}>AI extracted medicines successfully</p>
            </>
          )}

          <small>JPG, PNG or HEIC · up to 10 MB</small>
        </div>

        {/* Extract panel */}
        <div className="extract-panel">
          <div className="extract-header">
            <div>
              <span className="eyebrow">AI READING</span>
              <h2>What we found</h2>
            </div>
            <span className="reading-status">
              <i />
              {isScanning ? 'Scanning…' : 'Ready to review'}
            </span>
          </div>

          <div className="preview-row">
            <div className="document-preview">
              <div className="rx">℞</div>
              <i /><i /><i />
            </div>
            <div className="preview-copy">
              <b id="uploadStatus">{uploadStatus}</b>
              <span>{displayDoc?.date || '—'}</span>
              <small>AI extracted {displayMeds.length} medicine{displayMeds.length !== 1 ? 's' : ''}</small>
            </div>
          </div>

          {displayMeds.length > 0 && (
            <div className="med-list">
              <div>
                <span>MEDICINE</span>
                <span>DOSE</span>
                <span>SCHEDULE</span>
              </div>
              {displayMeds.map((med, j) => (
                <article key={j}>
                  <b>{med.name}</b>
                  <span>{med.strength}</span>
                  <em>{med.frequency}</em>
                </article>
              ))}
            </div>
          )}

          {/* Fuzzy correction */}
          {displayDoc?.fuzzyCorrection && (
            <div style={{
              background: 'var(--accent-amber-dim)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>🔤</span>
              <span>
                Corrected: <strong style={{ textDecoration: 'line-through', opacity: 0.6 }}>{displayDoc.fuzzyCorrection.from}</strong>
                {' → '}
                <strong style={{ color: 'var(--accent-green)' }}>{displayDoc.fuzzyCorrection.to}</strong>
                <span style={{ color: 'var(--text-muted)' }}> ({displayDoc.fuzzyCorrection.confidence}% match)</span>
              </span>
            </div>
          )}

          <button className="primary-action confirm-button" style={{ width: '100%', justifyContent: 'center' }} onClick={handleComplete}>
            Confirm extracted medicines <span>→</span>
          </button>
        </div>
      </div>

      {/* Scanned docs list */}
      {scannedDocs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <span className="eyebrow" style={{ marginBottom: 12, display: 'block' }}>SCANNED DOCUMENTS ({scannedDocs.length})</span>
          {scannedDocs.map((doc) => (
            <div key={doc.id} className="prescription-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="prescription-thumb" style={{ width: 44, height: 44, fontSize: 22 }}>
                    {doc.labValues ? '🧪' : '💊'}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{doc.doctor}</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doc.date}</p>
                  </div>
                </div>
                <div className="confidence-bar">
                  <span className="confidence-text">OCR:</span>
                  <div className="confidence-track" style={{ width: 70 }}>
                    <div className={`confidence-fill${doc.ocrRawConfidence < 85 ? ' medium' : ''}`} style={{ width: `${doc.ocrRawConfidence}%` }} />
                  </div>
                  <span className="confidence-text">{doc.ocrRawConfidence}%</span>
                </div>
              </div>

              {doc.medications?.map((med, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600 }}>{med.name} {med.strength}</span>
                  <span style={{ color: med.confidence >= 90 ? 'var(--accent-green)' : 'var(--accent-amber)', fontSize: 12 }}>
                    {med.confidence}% confidence
                  </span>
                </div>
              ))}

              {doc.labValues?.map((lab, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 500 }}>{lab.test}</span>
                  <span style={{ fontWeight: 700, color: lab.status === 'abnormal' ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {lab.value}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="action-bar">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <div style={{ display: 'flex', gap: 10 }}>
          {scanIndex < MOCK_PRESCRIPTIONS.length && (
            <button className="btn btn-secondary" onClick={handleComplete}>Skip scan →</button>
          )}
          <button className="btn btn-primary btn-lg" onClick={handleComplete}>
            {scannedDocs.length > 0 ? 'Generate Doctor Report →' : 'Skip & Generate Report →'}
          </button>
        </div>
      </div>
    </>
  )
}
