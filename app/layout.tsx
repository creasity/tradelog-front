'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '@/contexts/AuthContext'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  topbarContent?: React.ReactNode
}

export default function AppLayout({ children, title, subtitle, topbarContent }: AppLayoutProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-gray-500 tracking-widest uppercase">Chargement...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
      <Sidebar />
      <div className="md:ml-56 pt-14 md:pt-0 min-h-screen flex flex-col">
        <Topbar title={title} subtitle={subtitle} topbarContent={topbarContent} />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
