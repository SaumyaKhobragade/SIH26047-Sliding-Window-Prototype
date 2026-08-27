import { FileText, CheckCircle } from 'lucide-react'

export default function DocumentCard({ document }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {document.imageUrl ? (
            <img
              src={document.imageUrl}
              alt={document.name}
              className="w-24 h-32 object-cover rounded border border-gray-200"
            />
          ) : (
            <div className="w-24 h-32 bg-gray-100 rounded flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{document.name}</h3>
              <p className="text-sm text-gray-600 capitalize mt-1">
                {document.type.replace('_', ' ')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Uploaded: {document.uploadedAt.toLocaleDateString()}
              </p>
            </div>
            {document.status === 'processed' && (
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0" />
            )}
          </div>
          {document.extractedData && (
            <div className="mt-3 text-xs bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
              <p className="font-semibold text-gray-700 mb-1">Extracted Data:</p>
              <ul className="text-gray-600 space-y-1">
                {document.extractedData.medications && document.extractedData.medications.map((med, i) => (
                  <li key={i}>• {med.name} {med.dosage} - {med.frequency}</li>
                ))}
                {document.extractedData.investigations && document.extractedData.investigations.map((inv, i) => (
                  <li key={i}>• {inv.test}: {inv.value} ({inv.status})</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
