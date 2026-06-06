import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Database, FileText, TrendingUp, Activity, Settings, Edit2 } from 'lucide-react'
import { useAuthStore } from '@/store'
import { formatDate } from '@/lib/utils'

const activityTimeline = [
  { icon: '📁', text: 'Uploaded sales_q4_2025.csv', time: '2 minutes ago' },
  { icon: '⚡', text: 'Ran analytics on customer_segments', time: '1 hour ago' },
  { icon: '🤖', text: 'AI Analyst session (45 min)', time: '3 hours ago' },
  { icon: '📈', text: 'Generated revenue forecast', time: '1 day ago' },
  { icon: '📄', text: 'Exported Executive Report (PDF)', time: '2 days ago' },
  { icon: '🧹', text: 'Cleaned marketing_campaign.csv', time: '3 days ago' },
]

export function ProfilePage() {
  const { user, dbUser } = useAuthStore()
  const navigate = useNavigate()

  const displayName = dbUser?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const email = dbUser?.email || user?.email || ''
  const avatarUrl = dbUser?.avatar_url || user?.user_metadata?.avatar_url
  const joined = user?.created_at ? formatDate(user.created_at) : 'Recently'
  const initial = displayName[0]?.toUpperCase() || 'U'

  const stats = [
    { icon: Database, label: 'Datasets', value: 24, color: '#8B5CF6' },
    { icon: FileText, label: 'Reports', value: 38, color: '#EC4899' },
    { icon: TrendingUp, label: 'Forecasts', value: 9, color: '#06B6D4' },
    { icon: Activity, label: 'Analyses', value: 142, color: '#10B981' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      <h1 className="section-header">Profile</h1>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}>
                  {initial}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success border-2 border-background" />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-text">{displayName}</h2>
                <p className="text-text-muted">{email}</p>
                <p className="text-text-subtle text-sm mt-1">Member since {joined}</p>
              </div>
              <button onClick={() => navigate('/settings')}
                className="btn-secondary text-sm px-4 py-2">
                <Edit2 size={13} /> Edit Profile
              </button>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <span className="badge-primary">Pro Plan</span>
              <span className="badge-success">Active</span>
              <span className="text-text-muted text-xs">Google Account</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }} className="kpi-card">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${stat.color}20`, border: `1px solid ${stat.color}30` }}>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <div className="text-3xl font-black text-text">{stat.value}</div>
            <div className="text-text-muted text-xs mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
          <Activity size={15} className="text-primary" /> Activity Timeline
        </h3>
        <div className="space-y-3">
          {activityTimeline.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span className="text-text-muted text-sm flex-1">{item.text}</span>
              <span className="text-text-subtle text-xs flex-shrink-0">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
