export const documentsData = {
  uploadedDocuments: [
    {
      id: 'doc_001',
      name: 'Prescription - Jan 2024',
      type: 'prescription',
      uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60000),
      status: 'processed',
      imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"%3E%3Crect fill="%23fff" width="100" height="140" stroke="%23ccc" stroke-width="1"/%3E%3Ctext x="50" y="30" font-size="12" text-anchor="middle" fill="%23666"%3EPrescription%3C/text%3E%3Ctext x="50" y="50" font-size="10" text-anchor="middle" fill="%23999"%3EAmlodipine 5mg%3C/text%3E%3Ctext x="50" y="65" font-size="10" text-anchor="middle" fill="%23999"%3eLisinopril 10mg%3C/text%3E%3Ctext x="50" y="80" font-size="10" text-anchor="middle" fill="%23999"%3EAspirin 75mg%3C/text%3E%3Ctext x="50" y="100" font-size="9" text-anchor="middle" fill="%23aaa"%3EDr. Patel%3C/text%3E%3C/svg%3E',
      extractedData: {
        medications: [
          { name: 'Amlodipine', dosage: '5mg', frequency: 'OD' },
          { name: 'Lisinopril', dosage: '10mg', frequency: 'OD' },
          { name: 'Aspirin', dosage: '75mg', frequency: 'OD' }
        ]
      }
    },
    {
      id: 'doc_002',
      name: 'Lab Report - Feb 2024',
      type: 'lab_report',
      uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60000),
      status: 'processed',
      imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"%3E%3Crect fill="%23fff" width="100" height="140" stroke="%23ccc" stroke-width="1"/%3E%3Ctext x="50" y="30" font-size="12" text-anchor="middle" fill="%23666"%3ELab Report%3C/text%3E%3Ctext x="50" y="50" font-size="9" text-anchor="middle" fill="%23999"%3EHemoglobin: 14.2%3C/text%3E%3Ctext x="50" y="63" font-size="9" text-anchor="middle" fill="%23999"%3EBP: 145/92%3C/text%3E%3Ctext x="50" y="76" font-size="9" text-anchor="middle" fill="%23999"%3ECholesterol: 198%3C/text%3E%3Ctext x="50" y="100" font-size="9" text-anchor="middle" fill="%23aaa"%3EDr. Verma Lab%3C/text%3E%3C/svg%3E',
      extractedData: {
        investigations: [
          { test: 'Hemoglobin', value: '14.2', unit: 'g/dL', status: 'normal' },
          { test: 'Blood Pressure', value: '145/92', unit: 'mmHg', status: 'elevated' },
          { test: 'Total Cholesterol', value: '198', unit: 'mg/dL', status: 'borderline' }
        ]
      }
    }
  ],
  processingStates: {
    idle: 'Waiting for upload',
    uploading: 'Uploading document...',
    processing: 'Processing document... Please wait',
    processed: 'Document processed successfully',
    error: 'Error processing document. Please try again.'
  }
}
