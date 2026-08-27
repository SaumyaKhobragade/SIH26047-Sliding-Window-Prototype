export default function PatientInfoCard({ patient }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-gray-600 text-sm font-semibold">Name</p>
        <p className="text-xl font-bold text-gray-900">{patient.name}</p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-gray-600 text-sm font-semibold">ABHA ID</p>
        <p className="text-lg font-mono text-medical-600">{patient.id}</p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-gray-600 text-sm font-semibold">Age</p>
        <p className="text-xl font-bold text-gray-900">{patient.age} years</p>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-gray-600 text-sm font-semibold">Gender</p>
        <p className="text-xl font-bold text-gray-900">{patient.gender}</p>
      </div>
    </div>
  )
}
