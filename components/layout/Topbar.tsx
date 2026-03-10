'use client'

import { Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface TopbarProps {
  title: string
  subtitle?: string
  topbarContent?: React.ReactNode
}

export default function Topbar({ title, subtitle, topbarContent }: TopbarProps) {
  const { user } = useAuth()

  return (
    <header className="hidden md:flex items-stretch border-b border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg sticky top-0 z-40 min-h-14">

      {/* Title block */}
      <div className="flex flex-col justify-center px-6 py-2 flex-shrink-0 min-w-[160px]">
        <h1 className="font-display font-700 text-lg uppercase tracking-wider text-gray-900 dark:text-white leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{subtitle}</p>
        )}
      </div>

      {/* Center slot — presets + timeline injected from page */}
      {topbarContent ? (
        <div className="flex-1 flex items-center border-l border-light-border dark:border-dark-border px-4 py-2 min-w-0 overflow-hidden">
          {topbarContent}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right icons */}
      <div className="flex items-center gap-2 px-4 flex-shrink-0 border-l border-light-border dark:border-dark-border">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-light-hover dark:hover:bg-dark-hover transition-all">
          <Bell size={15} />
        </button>
        {user && (
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-sm">
            <span className="text-xs font-mono font-bold text-white">
              {user.first_name?.[0] || user.email[0].toUpperCase()}
            </span>
          </div>
        )}
      </div>

    </header>
  )
}
