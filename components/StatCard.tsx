import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  icon: React.ReactNode
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   value: 'text-blue-700' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  value: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', value: 'text-yellow-700' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    value: 'text-red-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', value: 'text-purple-700' },
  gray:   { bg: 'bg-gray-100',  text: 'text-gray-500',   value: 'text-gray-700' },
}

export default function StatCard({ title, value, subtitle, color = 'blue', icon }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="stat-card flex items-start gap-4">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', c.bg)}>
        <span className={c.text}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className={clsx('text-2xl font-bold mt-0.5', c.value)}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
