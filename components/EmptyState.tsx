'use client'

import { motion } from 'motion/react'

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white border border-slate-200/50 rounded-2xl shadow-3xs max-w-md mx-auto my-4"
    >
      {icon && (
        <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400 shadow-3xs">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed">{description}</p>
      {action && (
        <div className="mt-6 flex justify-center w-full select-none">
          {action}
        </div>
      )}
    </motion.div>
  )
}
