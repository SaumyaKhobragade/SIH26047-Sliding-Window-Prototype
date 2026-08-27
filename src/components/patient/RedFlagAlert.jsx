import { AlertCircle } from 'lucide-react'

export default function RedFlagAlert({ redFlags, isVisible = true }) {
  if (!isVisible || !redFlags || redFlags.length === 0) {
    return null
  }

  const highSeverity = redFlags.some((f) => f.severity === 'high')

  return (
    <div
      className={`mb-4 p-4 rounded-lg border-l-4 ${
        highSeverity
          ? 'bg-danger-50 border-danger-600'
          : 'bg-warning-50 border-warning-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            highSeverity ? 'text-danger-600' : 'text-warning-600'
          }`}
        />
        <div>
          <p
            className={`font-bold ${
              highSeverity ? 'text-danger-900' : 'text-warning-900'
            }`}
          >
            ⚠️ Potential Red Flag Detected
          </p>
          <ul className={`mt-2 space-y-1 text-sm ${
            highSeverity ? 'text-danger-800' : 'text-warning-800'
          }`}>
            {redFlags.map((flag, i) => (
              <li key={i}>• {flag.message}</li>
            ))}
          </ul>
          <p className={`mt-2 text-xs font-semibold ${
            highSeverity ? 'text-danger-700' : 'text-warning-700'
          }`}>
            Please ensure clinical staff reviews this case.
          </p>
        </div>
      </div>
    </div>
  )
}
