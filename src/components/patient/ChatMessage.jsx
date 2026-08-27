export default function ChatMessage({ message, isPatient = false }) {
  return (
    <div className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
          isPatient
            ? 'bg-medical-600 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-900 rounded-bl-none'
        }`}
      >
        <p className="leading-relaxed">{message.message}</p>
        <p className="text-xs mt-2 opacity-70">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
