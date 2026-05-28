'use client'

import clsx from 'clsx'
import { motion } from 'motion/react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  icon: React.ReactNode
}

const colorMap = {
  blue:   { bg: 'bg-blue-50/70 border-blue-100/40',   text: 'text-blue-600',   value: 'text-blue-700' },
  green:  { bg: 'bg-emerald-50/70 border-emerald-100/40',  text: 'text-emerald-600',  value: 'text-emerald-700' },
  yellow: { bg: 'bg-amber-50/70 border-amber-100/40', text: 'text-amber-600', value: 'text-amber-700' },
  red:    { bg: 'bg-rose-50/70 border-rose-100/40',    text: 'text-rose-600',    value: 'text-rose-700' },
  purple: { bg: 'bg-purple-50/70 border-purple-100/40', text: 'text-purple-600', value: 'text-purple-700' },
  gray:   { bg: 'bg-slate-100/70 border-slate-200/50',  text: 'text-slate-500',   value: 'text-slate-700' },
}

export default function StatCard({ title, value, subtitle, color = 'blue', icon }: StatCardProps) {
  const c = colorMap[color] || colorMap.blue
  return (
    <motion.div 
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="stat-card flex items-start gap-4 select-none hover:border-slate-300 transition-colors"
    >
      <div className={clsx('w-11 h-11 border rounded-xl flex items-center justify-center flex-shrink-0 shadow-3xs', c.bg)}>
        <span className={clsx('w-5 h-5 flex items-center justify-center', c.text)}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{title}</p>
        <p className={clsx('text-3xl font-bold tracking-tight mt-0.5 font-sans leading-none', c.value)}>{value}</p>
        {subtitle && <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">{subtitle}</p>}
      </div>
    </motion.div>
  )
}
