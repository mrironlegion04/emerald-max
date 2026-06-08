import type { Metadata } from 'next'
import './globals.css'
import NotificationPermissionRequest from '@/components/NotificationPermissionRequest'

export const metadata: Metadata = {
  title: 'Emerald Maintenance - Asset & Maintenance Management',
  description: 'Computerized Maintenance Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
        <NotificationPermissionRequest />
      </body>
    </html>
  )
}