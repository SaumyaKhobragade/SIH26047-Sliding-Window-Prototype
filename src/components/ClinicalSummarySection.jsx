import Card from './Card'

export default function ClinicalSummarySection({ title, children, icon: Icon }) {
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-3 mb-4">
        {Icon && <Icon className="w-6 h-6 text-medical-600" />}
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="text-gray-700 space-y-2">
        {children}
      </div>
    </Card>
  )
}
