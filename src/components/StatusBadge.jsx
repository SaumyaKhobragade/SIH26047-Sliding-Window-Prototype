export default function StatusBadge({ status, priority }) {
  const statusColors = {
    waiting: 'bg-warning-500',
    in_consultation: 'bg-medical-600',
    completed: 'bg-success-500',
  }

  const priorityColors = {
    high: 'bg-danger-500',
    medium: 'bg-warning-500',
    low: 'bg-medical-600',
  }

  return (
    <div className="flex gap-2">
      {status && (
        <span className={`${statusColors[status] || 'bg-gray-500'} text-white text-xs font-semibold px-3 py-1 rounded-full capitalize`}>
          {status.replace('_', ' ')}
        </span>
      )}
      {priority && (
        <span className={`${priorityColors[priority] || 'bg-gray-500'} text-white text-xs font-semibold px-3 py-1 rounded-full capitalize`}>
          {priority} priority
        </span>
      )}
    </div>
  )
}
