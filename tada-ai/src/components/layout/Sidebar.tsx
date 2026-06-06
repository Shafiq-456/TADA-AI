import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Database, Wand2, BarChart3, PieChart,
  TrendingUp, Bot, Lightbulb, FileText, Settings, User,
  LogOut, ChevronLeft, ChevronRight, Zap, Menu, LayoutGrid
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: LayoutGrid, label: 'Auto Dashboard', path: '/auto-dashboard' },
  { icon: Database, label: 'Datasets', path: '/datasets' },
  { icon: Wand2, label: 'Data Cleaning', path: '/cleaning' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: PieChart, label: 'Visualizations', path: '/visualizations' },
  { icon: TrendingUp, label: 'Forecasting', path: '/forecasting' },
  { icon: Bot, label: 'AI Analyst', path: '/ai-analyst', highlight: true },
  { icon: Lightbulb, label: 'Exec Insights', path: '/insights' },
  { icon: FileText, label: 'Reports', path: '/reports' },
]

const bottomItems = [
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: User, label: 'Profile', path: '/profile' },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, dbUser, signOut: clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      clearAuth()
      navigate('/')
      toast.success('Signed out successfully')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const displayName = dbUser?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const displayEmail = dbUser?.email || user?.email || ''
  const avatarUrl = dbUser?.avatar_url || user?.user_metadata?.avatar_url
  const avatarFallback = displayName[0]?.toUpperCase() || 'U'

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex-shrink-0 h-screen flex flex-col border-r border-border overflow-hidden z-30"
      style={{ background: 'rgba(9, 14, 28, 0.98)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-border min-h-[64px]">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed ? (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}>
                <Zap size={16} className="text-white" />
              </div>
              <div>
                <div className="text-base font-bold text-text tracking-tight">TADA AI</div>
                <div className="text-[10px] text-text-muted leading-none">Business Intelligence</div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}
            >
              <Zap size={16} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-all flex-shrink-0"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5 no-scrollbar">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {({ isActive }) => (
              <div
                className={cn(
                  'nav-item group relative',
                  isActive && 'active',
                  item.highlight && !isActive && 'border border-transparent hover:border-primary/20'
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={18} className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-text-muted group-hover:text-text',
                  item.highlight && !isActive && 'text-accent'
                )} />

                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {item.highlight && !sidebarCollapsed && (
                  <span className="ml-auto badge-primary text-[10px] px-1.5 py-0.5 rounded-full">
                    AI
                  </span>
                )}
                {(item as any).badge && !sidebarCollapsed && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(6,182,212,0.15)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)' }}>
                    {(item as any).badge}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r"
                  />
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="px-2 pb-2 space-y-0.5 border-t border-border pt-2">
        {bottomItems.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {({ isActive }) => (
              <div className={cn('nav-item', isActive && 'active')}
                title={sidebarCollapsed ? item.label : undefined}>
                <item.icon size={18} className={cn('flex-shrink-0', isActive ? 'text-primary' : 'text-text-muted')} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </NavLink>
        ))}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="nav-item w-full text-danger hover:text-danger hover:bg-danger/10 group"
          title={sidebarCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm whitespace-nowrap"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User profile */}
        <div className="flex items-center gap-2.5 p-2 mt-1 rounded-xl border border-border bg-background-secondary">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-bold">{avatarFallback}</span>
            )}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <div className="text-xs font-medium text-text truncate">{displayName}</div>
                <div className="text-[10px] text-text-muted truncate">{displayEmail}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}
