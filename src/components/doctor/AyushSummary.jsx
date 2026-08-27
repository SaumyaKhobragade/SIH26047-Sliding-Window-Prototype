import React from 'react'
import { Sparkles, Utensils, Moon, Activity, Flame, Wind, Mountain, ShieldCheck, HeartPulse } from 'lucide-react'
import {
  formatPrakriti,
  formatAgni,
  formatKoshtha,
  formatAharaShakti,
  formatVyayamaShakti,
  formatAharaVihara,
} from '../../utils/ayushFormatter'

export default function AyushSummary({ ayushAssessment = {} }) {
  const data = ayushAssessment || {}
  const aharaVihara = formatAharaVihara(data.aharaVihara)
  const vikritiSymptoms = Array.isArray(data.vikritiSymptoms) ? data.vikritiSymptoms : []

  // Check if assessment has data
  const hasData =
    data.prakriti ||
    vikritiSymptoms.length > 0 ||
    data.agni ||
    data.koshtha ||
    data.aharaShakti ||
    data.vyayamaShakti

  if (!hasData) {
    return null
  }

  return (
    <div className="bg-white rounded-xl border-2 border-emerald-500/80 shadow-sm overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">AYUSH / Ayurvedic Clinical Assessment</h3>
            <p className="text-xs text-emerald-200">
              Dashavidha Pariksha &amp; Ahara-Vihara Patient-Reported Intake
            </p>
          </div>
        </div>

        <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-bold px-2.5 py-1 rounded-full">
          Ayurveda Mode
        </span>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Core Pariksha Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Prakriti */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Prakriti (Constitution)
            </span>
            <p className="font-bold text-gray-900 text-base">
              {formatPrakriti(data.prakriti)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Patient baseline constitutional tendency</p>
          </div>

          {/* Agni */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Agni (Digestive Fire)
            </span>
            <p className="font-bold text-gray-900 text-base">
              {formatAgni(data.agni)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Digestive capacity &amp; metabolic strength</p>
          </div>

          {/* Koshtha */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Koshtha (Bowel Habit)
            </span>
            <p className="font-bold text-gray-900 text-base">
              {formatKoshtha(data.koshtha)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Alimentary canal sensitivity</p>
          </div>

          {/* Ahara Shakti */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Ahara Shakti (Food Intake)
            </span>
            <p className="font-bold text-gray-900 text-base">
              {formatAharaShakti(data.aharaShakti)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Appetite &amp; food assimilation capacity</p>
          </div>

          {/* Vyayama Shakti */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Vyayama Shakti (Endurance)
            </span>
            <p className="font-bold text-gray-900 text-base">
              {formatVyayamaShakti(data.vyayamaShakti)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Physical stamina &amp; exercise tolerance</p>
          </div>

          {/* Vikriti Symptoms */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Reported Symptoms (Vikriti)
            </span>
            {vikritiSymptoms.length > 0 ? (
              <ul className="text-xs font-semibold text-gray-900 space-y-1">
                {vikritiSymptoms.map((symp, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="text-emerald-600">•</span>
                    <span>{symp}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">None reported</p>
            )}
          </div>
        </div>

        {/* Ahara-Vihara (Diet & Lifestyle Section) */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Utensils className="w-4 h-4 text-emerald-700" />
            Ahara-Vihara (Dietary Habits &amp; Daily Routine)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-gray-500 block mb-0.5">Dietary Preference (Ahara)</span>
              <span className="font-bold text-gray-900">{aharaVihara.diet}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-gray-500 block mb-0.5">Sleep Quality (Nidra)</span>
              <span className="font-bold text-gray-900">{aharaVihara.sleep}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-gray-500 block mb-0.5">Physical Activity (Vihara)</span>
              <span className="font-bold text-gray-900">{aharaVihara.activity}</span>
            </div>
          </div>
        </div>

        {/* Doctor Review Notice */}
        <div className="flex items-start gap-2.5 text-xs text-emerald-900 bg-emerald-50/40 p-3 rounded-lg border border-emerald-200/60">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p>
            <strong className="font-semibold">Physician Review Notice:</strong> This AYUSH assessment is compiled from patient-reported history. The physician remains responsible for clinical validation, Dosha/Dushya evaluation, and individualized prescription.
          </p>
        </div>
      </div>
    </div>
  )
}
