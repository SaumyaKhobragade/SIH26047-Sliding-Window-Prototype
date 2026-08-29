import { useState } from 'react'

// There are deliberately NO sample documents in this file. It used to carry three
// fabricated ones — Paracetamol/Pantoprazole/Vitamin D3, a lab panel with HbA1c
// 8.1%, and Glimepiride/Atorvastatin — which were shown whenever the backend was
// unreachable or a scan failed. Everything rendered here now comes from a
// document the patient actually uploaded and the backend actually read.

const MAX_DOCS = 5

export default function PrescriptionStep({ patientId, apiBase, onComplete, onBack }) {
  const [scannedDocs, setScannedDocs] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('No document yet')
  const [scanError, setScanError] = useState('')

  const backendReady = Boolean(patientId && apiBase)
  const canScanMore = scannedDocs.length < MAX_DOCS

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!backendReady) {
      setScanError(
        'Document scanning needs the clinical backend, which is unreachable. ' +
        'Nothing was added to the record — you can continue without documents.'
      )
      return
    }

    setIsScanning(true)
    setScanError('')
    try {
      const formData = new FormData()
      formData.append('patient_id', patientId)
      formData.append('document', file)
      const res = await fetch(`${apiBase}/prescription/scan`, { method: 'POST', body: formData })
      if (!res.ok) {
        // The backend returns 422 with a readable reason when OCR could not read
        // the image, or read it but recognised no medicines or lab values.
        let detail = `Scan failed (${res.status})`
        try {
          const body = await res.json()
          if (body?.detail) detail = body.detail
        } catch { /* non-JSON error body — keep the status line */ }
        throw new Error(detail)
      }
      const result = await res.json()

      setScannedDocs(prev => [...prev, {
        id: `${Date.now()}-${prev.length}`,
        filename: file.name,
        doctor: result.doctor_name || 'Unknown',
        date: result.date || '—',
        // The backend speaks drug_name; this component rendered med.name, so
        // every medicine row came out blank. Both keys are accepted now.
        medications: (result.medications || []).map(m => ({
          ...m,
          name: m.name || m.drug_name || '',
          confidence: m.confidence ?? m.match_confidence ?? null,
        })),
        labValues: (result.lab_values || []).map(l => ({
          ...l,
          test: l.test || l.test_name || '',
          reference: l.reference || l.reference_range || '—',
        })),
        diagnosis: result.diagnosis || '',
        ocrRawConfidence: Math.round((result.ocr_confidence || 0) * 100),
        corrections: result.corrections || [],
        // Which reader produced this — not whether it is real. Every document
        // that reaches this point was read off the patient's own upload.
        ocrSource: result.ocr_source || 'unknown',
        extractionSource: result.extraction_source || 'unknown',
      }])
      setUploadStatus(file.name)
    } catch (err) {
      // Substituting sample data for a failed scan put invented medicines into a
      // real patient's report. Report the failure instead.
      console.error('OCR failed:', err)
      setScanError(`${err.message} Nothing was added to the record.`)
    } finally {
      setIsScanning(false)
    }
  }

  const handleScanClick = () => {
    if (!canScanMore || isScanning) return
    if (!backendReady) {
      setScanError(
        'Document scanning needs the clinical backend, which is unreachable. ' +
        'You can continue without documents.'
      )
      return
    }
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
    input.onchange = handleFileUpload; input.click()
  }

  const handleComplete = () => {
    onComplete(scannedDocs)
  }

  const displayDoc = scannedDocs[scannedDocs.length - 1] || null
  const displayMeds = displayDoc?.medications || []
  const displayLabs = displayDoc?.labValues || []

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
          onClick={canScanMore ? handleScanClick : undefined}
          style={{ cursor: canScanMore ? 'pointer' : 'default' }}
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
              <p style={{ color: 'var(--accent-teal)' }}>Sarvam Doc-AI OCR → LLM → Drug Match</p>
            </>
          ) : canScanMore ? (
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
              <h3>{MAX_DOCS} documents<br />uploaded</h3>
              <p style={{ color: 'var(--accent-green)' }}>That's the maximum for one visit</p>
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
              {isScanning ? 'Scanning…' : scannedDocs.length ? 'Ready to review' : 'Nothing scanned'}
            </span>
          </div>

          {scanError && (
            <div role="alert" style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 12, color: '#fca5a5',
            }}>
              {scanError}
            </div>
          )}

          <div className="preview-row">
            <div className="document-preview">
              <div className="rx">℞</div>
              <i /><i /><i />
            </div>
            <div className="preview-copy">
              <b id="uploadStatus">{uploadStatus}</b>
              <span>{displayDoc?.date || '—'}</span>
              <small>
                {displayDoc
                  ? `AI extracted ${displayMeds.length} medicine${displayMeds.length !== 1 ? 's' : ''}` +
                    (displayLabs.length ? ` · ${displayLabs.length} lab value${displayLabs.length !== 1 ? 's' : ''}` : '')
                  : 'Upload a document, or continue without one'}
              </small>
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
                  <b>{med.name || med.drug_name || '—'}</b>
                  <span>{med.strength || '—'}</span>
                  {/* Schedule and course length are separate fields now; kept in
                      one cell so the three-column grid is unchanged. */}
                  <em>{[med.frequency || med.dosage, med.duration].filter(Boolean).join(' · ') || '—'}</em>
                </article>
              ))}
            </div>
          )}

          {displayLabs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {displayLabs.map((lab, j) => {
                const isAbnormal = lab.status === 'abnormal' || lab.status === 'critical'
                return (
                  <div key={j} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    fontSize: 13, padding: '5px 0', borderTop: '1px solid var(--border-color)',
                  }}>
                    <span style={{ fontWeight: 500 }}>
                      {isAbnormal && <b style={{ color: 'var(--accent-red)', marginRight: 6 }}>!</b>}
                      {lab.test}
                    </span>
                    <span>
                      <b style={{ color: isAbnormal ? 'var(--accent-red)' : 'var(--text-primary)' }}>{lab.value}</b>
                      <small style={{ color: 'var(--text-muted)', marginLeft: 8 }}>ref {lab.reference}</small>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Drug-name fuzzy corrections, from the OCR service */}
          {displayDoc?.corrections?.length > 0 && displayDoc.corrections.map((c, j) => (
            <div key={j} style={{
              background: 'var(--accent-amber-dim)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>🔤</span>
              <span>
                Corrected: <strong style={{ textDecoration: 'line-through', opacity: 0.6 }}>{c.from}</strong>
                {' → '}
                <strong style={{ color: 'var(--accent-green)' }}>{c.to}</strong>
                <span style={{ color: 'var(--text-muted)' }}> ({c.confidence}% match)</span>
              </span>
            </div>
          ))}

          <button className="primary-action confirm-button" style={{ width: '100%', justifyContent: 'center' }} onClick={handleComplete}>
            {scannedDocs.length ? 'Confirm extracted medicines' : 'Continue without documents'} <span>→</span>
          </button>
        </div>
      </div>

      {/* Scanned docs list */}
      {scannedDocs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <span className="eyebrow" style={{ marginBottom: 12, display: 'block' }}>
            SCANNED DOCUMENTS ({scannedDocs.length})
          </span>
          {scannedDocs.map((doc) => (
            <div key={doc.id} className="prescription-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="prescription-thumb" style={{ width: 44, height: 44, fontSize: 22 }}>
                    {doc.labValues?.length && !doc.medications?.length ? '🧪' : '💊'}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{doc.doctor}</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {doc.date}
                      {doc.extractionSource && ` · extracted via ${doc.extractionSource}`}
                    </p>
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
                  <span style={{ fontWeight: 600 }}>
                    {med.name || med.drug_name || '—'} {med.strength || ''}
                  </span>
                  {med.confidence != null && med.confidence > 0 && (
                    <span style={{ color: med.confidence >= 90 ? 'var(--accent-green)' : 'var(--accent-amber)', fontSize: 12 }}>
                      {med.confidence}% match
                    </span>
                  )}
                </div>
              ))}

              {doc.labValues?.map((lab, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 500 }}>{lab.test || lab.test_name}</span>
                  <span style={{ fontWeight: 700, color: (lab.status === 'abnormal' || lab.status === 'critical') ? 'var(--accent-red)' : 'var(--text-primary)' }}>
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
          <button className="btn btn-primary btn-lg" onClick={handleComplete}>
            {scannedDocs.length > 0 ? 'Generate Doctor Report →' : 'Skip & Generate Report →'}
          </button>
        </div>
      </div>
    </>
  )
}
