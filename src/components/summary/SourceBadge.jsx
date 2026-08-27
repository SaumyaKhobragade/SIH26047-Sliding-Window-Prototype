import React from 'react'
import { MessageSquare, FileText, FlaskConical, Sparkles, Layers } from 'lucide-react'

export default function SourceBadge({ source = '' }) {
  if (!source) return null

  const isInterview = /interview|consultation|patient/i.test(source) && !/prescription/i.test(source)
  const isPrescription = /prescription/i.test(source) && !/interview/i.test(source)
  const isBoth = /interview/i.test(source) && /prescription/i.test(source)
  const isLab = /laboratory|lab/i.test(source)
  const isAyush = /ayush|assessment/i.test(source)

  let badgeStyle = 'bg-gray-100 text-gray-700 border-gray-200'
  let Icon = Layers

  if (isBoth) {
    badgeStyle = 'bg-purple-50 text-purple-800 border-purple-200'
    Icon = Layers
  } else if (isPrescription) {
    badgeStyle = 'bg-sky-50 text-sky-800 border-sky-200'
    Icon = FileText
  } else if (isLab) {
    badgeStyle = 'bg-teal-50 text-teal-800 border-teal-200'
    Icon = FlaskConical
  } else if (isAyush) {
    badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200'
    Icon = Sparkles
  } else if (isInterview) {
    badgeStyle = 'bg-blue-50 text-blue-800 border-blue-200'
    Icon = MessageSquare
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border shadow-2xs ${badgeStyle}`}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span>{source}</span>
    </span>
  )
}
