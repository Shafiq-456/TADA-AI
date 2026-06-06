import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, Sun, Moon, Settings, X, Command } from 'lucide-react'
import { useAuthStore, useUIStore, useNotificationStore } from '@/store'
import { formatRelativeTime, cn } from '@/lib/utils'

export function TopNav() {
  const { user } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setNotifOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const quickLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Upload Dataset', path: '/datasets', icon: '📁' },
    { label: 'AI Analyst', path: '/ai-analyst', icon: '🤖' },
    { label: 'Forecasting', path: '/forecasting', icon: '📈' },
    { label: 'Reports', path: '/reports', icon: '📄' },
  ]

  const filteredLinks = quickLinks.filter(l =>
    l.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const avatarFallback = user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <>
      <header className="h-16 flex items-center justify-between px-6 border-b border-border flex-shrink-0"
        style={{ background: 'rgba(9, 14, 28, 0.95)', backdropFilter: 'blur(12px)' }}>

        {/* Search trigger */}
        <button
          id="global-search-trigger"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-3 px-4 py-2 rounded-xl bg-background-secondary border border-border text-text-muted text-sm hover:border-border-light hover:text-text transition-all w-64"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search anything...</span>
          <div className="flex items-center gap-1 text-[10px] text-text-subtle">
            <Command size={10} />
            <span>K</span>
          </div>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            id="theme-toggle"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-all"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              id="notifications-btn"
              onClick={() => setNotifOpen((v) => !v)}
              className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-all relative"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notification-dot">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-80 glass-card shadow-card z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <span className="font-semibold text-text text-sm">Notifications</span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-primary hover:text-primary/80"
                        >
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="text-text-muted hover:text-text">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-text-muted text-sm">
                        <Bell size={32} className="mx-auto mb-2 opacity-30" />
                        No notifications yet
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={cn(
                            'p-4 border-b border-border cursor-pointer hover:bg-white/3 transition-colors',
                            !n.read && 'bg-primary/5'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                              n.type === 'success' ? 'bg-success' :
                              n.type === 'error' ? 'bg-danger' :
                              n.type === 'warning' ? 'bg-warning' : 'bg-primary'
                            )} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-text text-xs">{n.title}</div>
                              <div className="text-text-muted text-xs mt-0.5 truncate">{n.message}</div>
                              <div className="text-text-subtle text-[10px] mt-1">{formatRelativeTime(n.created_at)}</div>
                            </div>
                            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings shortcut */}
          <button
            id="settings-shortcut"
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-all"
            title="Settings"
          >
            <Settings size={18} />
          </button>

          {/* User avatar */}
          <button
            id="user-profile-btn"
            onClick={() => navigate('/profile')}
            className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary/60 transition-all flex-shrink-0"
          >
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="User" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}>
                {avatarFallback}
              </div>
            )}
          </button>
        </div>
      </header>

      {/* Global Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg glass-card overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search size={16} className="text-text-muted flex-shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search pages, datasets, reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-text text-sm placeholder-text-subtle"
                />
                <button onClick={() => setSearchOpen(false)} className="text-text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>
              <div className="p-2">
                <div className="text-[10px] text-text-subtle uppercase tracking-wider px-3 py-2 font-medium">
                  Quick Navigation
                </div>
                {filteredLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => { navigate(link.path); setSearchOpen(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left transition-colors"
                  >
                    <span className="text-lg">{link.icon}</span>
                    <span className="text-text text-sm">{link.label}</span>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-subtle">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>ESC Close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside for notif */}
      {notifOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
      )}
    </>
  )
}
