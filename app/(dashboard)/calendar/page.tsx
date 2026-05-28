import PageHeader from '@/components/PageHeader'
import CalendarView from '@/components/CalendarView'

export default function CalendarPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Calendar" subtitle="Work orders and preventive maintenance due dates." />
      <CalendarView />
    </div>
  )
}