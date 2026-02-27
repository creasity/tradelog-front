'use client'

import { Sun, Moon, Bell } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

interface TopbarProps {
  title: string
  subtitle?: string
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { toggle, isDark } = useTheme()
  const { user } = useAuth()

  return (
    <header className="h-14 border-b border-light-border dark:border-dark-border flex items-center justify-between px-6 bg-light-bg dark:bg-dark-bg sticky top-0 z-40">
      {/* Title */}
      <div>
        <h1 className="font-display font-700 text-lg uppercase tracking-wider text-gray-900 dark:text-white leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-400 font-mono">{subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications placeholder */}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-light-hover dark:hover:bg-dark-hover transition-all">
          <Bell size={15} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
          title={isDark ? 'Mode clair' : 'Mode sombre'}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* User avatar */}
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
