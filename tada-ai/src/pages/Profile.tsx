import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Database, FileText, TrendingUp, Activity, Edit2, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store'
import { api } from '@/lib/api'

interface ActivityEntry {
  icon: string
  text: string
  time: string
}

interface ProfileData {
  stats: { datasets: number; reports: number; forecasts: number; analyses: number } | null
  activity_timeline: ActivityEntry[]
}

export function ProfilePage() {
  const { user, dbUser } = useAuthStore()
  const navigate = useNavigate()
  const [profileData, setProfileData] = useState<ProfileData>({ stats: null, activity_timeline: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/api/users/me')
        const data = res.data
        setProfileData({
          stats: data.stats ?? null,
          activity_timeline: Array.isArray(data.activity_timeline) ? data.activity_timeline : [],
        })
      } catch (err) {
        console.warn('Failed to fetch profile data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const displayName = dbUser?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const email = dbUser?.email || user?.email || ''
  const avatarUrl = dbUser?.avatar_url || user?.user_metadata?.avatar_url
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Recently'
  const initial = displayName[0]?.toUpperCase() || 'U'

  const statCards = [
    { icon: Database, label: 'Datasets', value: profileData.stats?.datasets, color: '#8B5CF6' },
    { icon: FileText, label: 'Reports', value: profileData.stats?.reports, color: '#EC4899' },
    { icon: TrendingUp, label: 'Forecasts', value: profileData.stats?.forecasts, color: '#06B6D4' },
    { icon: Activity, label: 'Analyses', value: profileData.stats?.analyses, color: '#10B981' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      <h1 className="section-header">Profile</h1>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}
                >
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
              <button onClick={() => navigate('/settings')} className="btn-secondary text-sm px-4 py-2">
                <Edit2 size={13} /> Edit Profile
              </button>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <span className="badge-primary">Active</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="kpi-card"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${stat.color}20`, border: `1px solid ${stat.color}30` }}
            >
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            {loading ? (
              <Loader2 size={20} className="animate-spin text-text-muted mb-1" />
            ) : (
              <div className="text-3xl font-black text-text">{stat.value ?? 0}</div>
            )}
            <div className="text-text-muted text-xs mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
          <Activity size={15} className="text-primary" /> Activity Timeline
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : profileData.activity_timeline.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-6">
            No activity yet. Upload a dataset to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {profileData.activity_timeline.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                <span className="text-text-muted text-sm flex-1">{item.text}</span>
                <span className="text-text-subtle text-xs flex-shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
