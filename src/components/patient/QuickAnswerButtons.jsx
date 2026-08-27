export default function QuickAnswerButtons({ options, onSelect, isVisible = true }) {
  if (!isVisible || !options || options.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 mb-4">
      <p className="text-xs text-gray-600 font-semibold uppercase">Quick answers:</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onSelect(option)}
            className="px-3 py-2 text-sm bg-medical-50 text-medical-700 rounded-lg hover:bg-medical-100 transition-colors border border-medical-200 font-medium"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
