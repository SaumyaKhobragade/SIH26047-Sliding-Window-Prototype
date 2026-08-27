export default function ProgressIndicator({ currentStep, totalSteps, labels = [] }) {
  return (
    <div className="bg-white border-b border-gray-200 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  i < currentStep
                    ? 'bg-success-500 text-white'
                    : i === currentStep
                    ? 'bg-medical-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {i + 1}
              </div>
              {i < totalSteps - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    i < currentStep - 1 ? 'bg-success-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        {labels.length > 0 && (
          <div className="flex justify-between text-xs text-gray-600">
            {labels.map((label, i) => (
              <span key={i} className="text-center flex-1">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
