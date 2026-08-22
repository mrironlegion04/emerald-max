'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Task {
  title: string
  description?: string | null
  priority: string
  required?: boolean
  assignedTo?: { name: string } | null
  assignedTeam?: { name: string } | null
}

interface TemplateLink {
  template: {
    id: string
    name: string
    tasks: Task[]
  }
}

interface Props {
  templateLinks: TemplateLink[]
  inlineTasks: Task[]
}

export default function PmTaskTemplateSection({ templateLinks, inlineTasks }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const templateTaskCount = templateLinks.reduce((sum, l) => sum + l.template.tasks.length, 0)
  const inlineTaskCount = inlineTasks.length
  const total = templateTaskCount + inlineTaskCount

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (total === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 text-sm mb-1">
        Task Template
        <span className="ml-2 text-gray-400 font-normal">
          ({templateTaskCount > 0 && `${templateTaskCount} template`}
          {templateTaskCount > 0 && inlineTaskCount > 0 && ' + '}
          {inlineTaskCount > 0 && `${inlineTaskCount} inline`}
          {templateTaskCount === 0 && inlineTaskCount === 0 && '0'} tasks)
        </span>
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Copied onto generated work orders as subtasks.
      </p>

      {/* Template tasks grouped by template */}
      {templateLinks.map((link) => {
        const isCollapsed = collapsed.has(link.template.id)
        return (
          <div key={link.template.id} className="mb-3">
            <button
              type="button"
              onClick={() => toggle(link.template.id)}
              className="flex items-center gap-2 mb-2 w-full text-left hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{link.template.name}</span>
              <span className="text-xs text-gray-400">{link.template.tasks.length} tasks</span>
            </button>
            {!isCollapsed && (
              <ol className="space-y-2 ml-6">
                {link.template.tasks.map((task: any, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800">{task.title}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                          task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          task.priority === 'LOW' ? 'bg-gray-100 text-gray-500' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {task.priority}
                        </span>
                        {task.required !== undefined && (
                          <span className={`text-[10px] font-bold uppercase ${task.required ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {task.required ? 'Req' : 'Opt'}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {task.assignedTo && (
                          <span className="text-xs text-gray-400">→ {task.assignedTo.name}</span>
                        )}
                        {task.assignedTeam && (
                          <span className="text-xs text-gray-400">team: {task.assignedTeam.name}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      })}

      {/* Inline tasks */}
      {inlineTaskCount > 0 && (
        <div>
          {templateLinks.length > 0 && (
            <div className="flex items-center gap-2 mb-2 pt-3 border-t border-dashed border-gray-200">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Additional Tasks</span>
              <span className="text-xs text-gray-400">{inlineTaskCount} tasks</span>
            </div>
          )}
          <ol className="space-y-2 ml-6">
            {inlineTasks.map((task: any, i: number) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{task.title}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                      task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      task.priority === 'LOW' ? 'bg-gray-100 text-gray-500' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {task.assignedTo && (
                      <span className="text-xs text-gray-400">→ {task.assignedTo.name}</span>
                    )}
                    {task.assignedTeam && (
                      <span className="text-xs text-gray-400">team: {task.assignedTeam.name}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
