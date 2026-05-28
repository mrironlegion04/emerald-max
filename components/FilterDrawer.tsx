'use client'

import { motion, AnimatePresence } from 'motion/react'
import { X, SlidersHorizontal } from 'lucide-react'
import { useEffect } from 'react'

interface FilterDrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  activeCount?: number
  onClear?: () => void
  children: React.ReactNode
}

export default function FilterDrawer({
  isOpen,
  onClose,
  title = 'Filters',
  activeCount = 0,
  onClear,
  children,
}: FilterDrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="filter-drawer-portal" className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Overlay */}
          <motion.div
            id="filter-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Sliding Panel */}
          <motion.div
            id="filter-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative z-10 w-full max-w-sm sm:max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-100"
          >
            {/* Header */}
            <div id="filter-drawer-header" className="p-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-900 text-sm tracking-tight uppercase">
                  {title}
                </h3>
                {activeCount > 0 && (
                  <span className="flex items-center justify-center bg-blue-600 text-white font-bold text-[10px] h-5 px-1.5 rounded-full min-w-5">
                    {activeCount}
                  </span>
                )}
              </div>
              <button
                id="filter-drawer-close"
                onClick={onClose}
                className="p-1 px-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-105 rounded-lg active:scale-95 transition-all text-sm font-semibold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Filters Body */}
            <div
              id="filter-drawer-body"
              className="flex-1 overflow-y-auto p-5 space-y-5"
            >
              {children}
            </div>

            {/* Sticky Actions Footer */}
            <div
              id="filter-drawer-footer"
              className="p-4 border-t border-slate-150 bg-slate-50/80 flex items-center justify-between gap-3"
            >
              {onClear ? (
                <button
                  id="filter-drawer-clear-btn"
                  onClick={() => {
                    onClear()
                    onClose()
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold py-2 px-3 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              ) : (
                <div />
              )}
              <button
                id="filter-drawer-apply-btn"
                onClick={onClose}
                className="btn-primary !text-xs py-2 px-4 shadow-sm"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
