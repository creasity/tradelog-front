'use client'

import { Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface TopbarProps {
  title: string
  subtitle?: string
  headerSlot?: React.ReactNode
}

export default function Topbar({ title, subtitle, headerSlot }: TopbarProps) {
  const { user } = useAuth()

  return (
    <header className={cn(
      'hidden md:flex border-b border-light-border dark:border-dark-border items-center justify-between px-6 bg-light-bg dark:bg-dark-bg sticky top-0 z-40',
      headerSlot ? 'min-h-[56px] py-2 gap-4' : 'h-14'
    )}>
      {/* Left: title */}
      <div className="flex-shrink-0">
        <h1 className="font-display font-700 text-lg uppercase tracking-wider text-gray-900 dark:text-white leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{subtitle}</p>
        )}
      </div>

      {/* Center: headerSlot (fills remaining space) */}
      {headerSlot && (
        <div className="flex-1 min-w-0">
          {headerSlot}
        </div>
      )}

      {/* Right: bell + avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-light-hover dark:hover:bg-dark-hover transition-all">
          <Bell size={15} />
        </button>
        {user && (
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-mono font-bold text-accent">
              {user.first_name?.[0] || user.email[0].toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
