import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Patient Pages
import WelcomePage from './pages/patient/WelcomePage'
import ConsentPage from './pages/patient/ConsentPage'
import ProfilePage from './pages/patient/ProfilePage'
import HistoryPage from './pages/patient/HistoryPage'
import DocumentsPage from './pages/patient/DocumentsPage'
import AYUSHPage from './pages/patient/AYUSHPage'
import PatientSummaryPage from './pages/patient/ClinicalSummaryPage'

// Doctor Pages
import DoctorDashboardPage from './pages/doctor/DoctorDashboardPage'

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Patient Flow */}
        <Route path="/patient" element={<WelcomePage />} />
        <Route path="/patient/consent" element={<ConsentPage />} />
        <Route path="/patient/profile" element={<ProfilePage />} />
        <Route path="/patient/history" element={<HistoryPage />} />
        <Route path="/patient/documents" element={<DocumentsPage />} />
        <Route path="/patient/ayush" element={<AYUSHPage />} />
        <Route path="/patient/summary" element={<PatientSummaryPage />} />

        {/* Doctor Flow */}
        <Route path="/doctor" element={<DoctorDashboardPage />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/patient" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/patient" replace />} />
      </Routes>
    </Router>
  )
}
