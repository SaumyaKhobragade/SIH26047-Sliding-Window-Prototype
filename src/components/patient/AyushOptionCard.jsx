import React from 'react'
import {
  Wind,
  Flame,
  Mountain,
  HelpCircle,
  Activity,
  BatteryLow,
  Moon,
  Sun,
  Utensils,
  Check,
  Clock,
  CheckCircle2,
  Zap,
  Shuffle,
  Smile,
  AlertTriangle,
  ShieldAlert,
  Coffee,
  Heart,
  Battery,
  Award,
} from 'lucide-react'

// Icon mapper for question options
const iconMap = {
  wind: Wind,
  flame: Flame,
  mountain: Mountain,
  'help-circle': HelpCircle,
  activity: Activity,
  'battery-low': BatteryLow,
  moon: Moon,
  sun: Sun,
  utensils: Utensils,
  check: Check,
  clock: Clock,
  'check-circle': CheckCircle2,
  zap: Zap,
  shuffle: Shuffle,
  smile: Smile,
  'alert-triangle': AlertTriangle,
  'shield-alert': ShieldAlert,
  coffee: Coffee,
  heart: Heart,
  battery: Battery,
  award: Award,
}

export default function AyushOptionCard({ option, isSelected, onClick, isMulti = false }) {
  const IconComponent = option.icon && iconMap[option.icon] ? iconMap[option.icon] : Activity

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
        isSelected
          ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-200'
          : 'border-gray-200 bg-white hover:border-emerald-400 hover:bg-gray-50/70'
      }`}
    >
      {/* Icon Pill */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
          isSelected
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        <IconComponent className="w-5 h-5" />
      </div>

      {/* Text Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4
            className={`font-bold text-sm sm:text-base ${
              isSelected ? 'text-emerald-950' : 'text-gray-900'
            }`}
          >
            {option.label}
          </h4>

          {/* Selection indicator */}
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              isSelected
                ? 'bg-emerald-600 text-white'
                : 'border-2 border-gray-300'
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5" />}
          </div>
        </div>

        {option.description && (
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {option.description}
          </p>
        )}
      </div>
    </button>
  )
}
