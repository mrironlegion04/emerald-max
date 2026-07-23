'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Wrench } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import ProcedureForm from '@/components/ProcedureForm'
import ProcedureHistoryPanel from '@/components/ProcedureHistoryPanel'

interface SelectOption {
  id: string
  name: string
}

interface ProcedureStep {
  id: string
  label: string
  type: string
  isMandatory: boolean
  options: string[]
  sortOrder: number
  settings?: any
  logic?: any
  links?: any
  assignedUserIds?: string[]
  assignedTeamIds?: string[]
  nestedProcedureId?: string | null
}

interface Props {
  procedureId: string
  procedure: {
    name: string
    description: string | null
    teamId: string | null
    steps: ProcedureStep[]
    assets: { id: string }[]
    categories: { id: string }[]
    locations: { id: string }[]
  }
  assets: SelectOption[]
  locations: SelectOption[]
  assetCategories: SelectOption[]
  teams: SelectOption[]
}

export default function EditProcedureClient({ procedureId, procedure, assets, locations, assetCategories, teams }: Props) {
  const [activeTab, setActiveTab] = useState<'fields' | 'history'>('fields')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-1">
        <Link href="/procedures" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to Procedure Library
        </Link>
      </div>
      <PageHeader
        title={`Edit: ${procedure.name}`}
        subtitle="Update the procedure name, steps, and target tags or resources."
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'fields'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Fields
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          History
        </button>
      </div>

      {activeTab === 'fields' ? (
        <ProcedureForm
          templateId={procedureId}
          initialData={{
            name:       procedure.name,
            description:procedure.description ?? '',
            steps:      procedure.steps.map(s => ({
              id:          s.id,
              label:       s.label,
              type:        s.type,
              isMandatory: s.isMandatory,
              options:     s.options,
              sortOrder:   s.sortOrder,
              settings:    s.settings,
              logic:       s.logic,
              links:       s.links ?? null,
              assignedUserIds: s.assignedUserIds ?? [],
              assignedTeamIds: s.assignedTeamIds ?? [],
              nestedProcedureId: s.nestedProcedureId ?? null,
            })),
            assetIds:    procedure.assets.map(a => a.id),
            categoryIds: procedure.categories.map(c => c.id),
            locationIds: procedure.locations.map(l => l.id),
            teamId:      procedure.teamId ?? null,
          }}
          assets={assets}
          locations={locations}
          assetCategories={assetCategories}
          teams={teams}
        />
      ) : (
        <ProcedureHistoryPanel procedureId={procedureId} />
      )}
    </div>
  )
}
