import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView, animate } from 'framer-motion'
import {
  Database, Zap, FileText, TrendingUp, Shield, Bot,
  Lightbulb, Upload, Play, ArrowRight, ArrowUpRight,
  ArrowDownRight, Activity, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, LayoutGrid, Search, BarChart3
} from 'lucide-react'
import { useAuthStore } from '@/store'
import type { Dataset } from '@/store'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { TiltContainer } from '@/components/layout/TiltContainer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserStats {
  datasets: number
  reports: number
  forecasts: number
  analyses: number
  total_rows?: number
  avg_quality_score?: number
}

interface ActivityItem {
  icon: string
  text: string
  time: string
  type: string
}

interface SmartInsight {
  type: 'finding' | 'risk' | 'opportunity'
  title: string
  description: string
  severity?: 'high' | 'medium' | 'low'
  impact?: string
}

interface Anomaly {
  column?: string
  feature?: string
  type: string
  description: string
  severity: 'high' | 'medium' | 'low'
  value?: number | string
}

interface DashboardData {
  userStats: UserStats
  datasets: Dataset[]
  smartInsights: SmartInsight[]
  anomalies: Anomaly[]
  activityTimeline: ActivityItem[]
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView || !ref.current) return
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate(latest) {
        if (ref.current) {
          ref.current.textContent = prefix + Math.round(latest).toLocaleString() + suffix
        }
      },
    })
    return () => controls.stop()
  }, [inView, value, prefix, suffix])

  return <span ref={ref}>{prefix}0{suffix}</span>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn('skeleton h-28 rounded-2xl', className)} />
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="skeleton h-4 w-32 rounded" />
      <div className="skeleton h-4 w-16 rounded ml-auto" />
      <div className="skeleton h-4 w-12 rounded" />
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string
  value: number
  prefix?: string
  suffix?: string
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: React.ElementType
  colorClass: 'blue' | 'purple' | 'cyan' | 'green'
  subtitle?: string
  index: number
}

function KPICard({ title, value, prefix, suffix, change, changeType = 'up', icon: Icon, colorClass, subtitle, index }: KPICardProps) {
  const colorMap = {
    blue: { text: '#8B5CF6', bg: 'rgba(139, 92, 246,0.15)', border: 'rgba(139, 92, 246,0.25)' },
    purple: { text: '#EC4899', bg: 'rgba(236, 72, 153,0.15)', border: 'rgba(236, 72, 153,0.25)' },
    cyan: { text: '#06B6D4', bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.25)' },
    green: { text: '#10B981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.25)' },
  }
  const c = colorMap[colorClass]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
    >
      <TiltContainer className={cn('stat-card glass-card-hover h-full', colorClass)}>
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <Icon size={18} style={{ color: c.text }} />
          </div>
        </div>
        <div className="kpi-metric">
          <div className="kpi-metric-value">
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
          </div>
          <div className="kpi-metric-label">{title}</div>
          {subtitle && <div className="text-text-subtle text-[10px] mt-0.5">{subtitle}</div>}
        </div>
        {change && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium mt-3',
            changeType === 'up' ? 'text-success' : changeType === 'down' ? 'text-danger' : 'text-text-muted'
          )}>
            {changeType === 'up' ? <ArrowUpRight size={12} /> : changeType === 'down' ? <ArrowDownRight size={12} /> : null}
            {change}
          </div>
        )}
      </TiltContainer>
    </motion.div>
  )
}

// ─── Quality Color ────────────────────────────────────────────────────────────

function qualityColor(score: number | null) {
  if (!score) return '#64748B'
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#F59E0B'
  return '#EF4444'
}

function StatusBadge({ status }: { status: Dataset['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    ready: { label: 'Ready', cls: 'badge-success' },
    processing: { label: 'Processing', cls: 'badge-warning' },
    uploaded: { label: 'Uploaded', cls: 'badge-primary' },
    error: { label: 'Error', cls: 'badge-danger' },
  }
  const s = map[status] ?? { label: status, cls: 'badge-muted' }
  return <span className={cn('badge text-[10px]', s.cls)}>{s.label}</span>
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  return <span className={cn('anomaly-badge', severity)}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</span>
}

function InsightTypeIcon({ type }: { type: SmartInsight['type'] }) {
  if (type === 'risk') return <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
  if (type === 'opportunity') return <TrendingUp size={14} className="text-success flex-shrink-0 mt-0.5" />
  return <Lightbulb size={14} className="text-primary flex-shrink-0 mt-0.5" />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, dbUser } = useAuthStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [data, setData] = useState<DashboardData>({
    userStats: { datasets: 0, reports: 0, forecasts: 0, analyses: 0 },
    datasets: [],
    smartInsights: [],
    anomalies: [],
    activityTimeline: [],
  })

  const fetchAll = useCallback(async () => {
    try {
      // Parallel fetch: user stats + datasets
      const [userRes, datasetsRes] = await Promise.allSettled([
        api.get('/api/users/me'),
        api.get('/api/datasets/'),
      ])

      const userStats: UserStats = userRes.status === 'fulfilled'
        ? (userRes.value.data?.stats ?? userRes.value.data ?? {})
        : { datasets: 0, reports: 0, forecasts: 0, analyses: 0 }

      const activityTimeline: ActivityItem[] = userRes.status === 'fulfilled'
        ? (userRes.value.data?.activity_timeline ?? [])
        : []

      const datasets: Dataset[] = datasetsRes.status === 'fulfilled'
        ? (datasetsRes.value.data?.datasets ?? datasetsRes.value.data ?? [])
        : []

      // If we have datasets, fetch insights + anomalies for first dataset
      let smartInsights: SmartInsight[] = []
      let anomalies: Anomaly[] = []

      if (datasets.length > 0) {
        const firstId = datasets[0].id
        const [insightsRes, anomaliesRes] = await Promise.allSettled([
          api.get(`/api/analytics/${firstId}/smart-insights`),
          api.get(`/api/analytics/${firstId}/anomalies`),
        ])

        if (insightsRes.status === 'fulfilled') {
          const d = insightsRes.value.data
          smartInsights = [
            ...(d?.top_findings ?? []).map((f: SmartInsight) => ({ ...f, type: 'finding' as const })),
            ...(d?.risks ?? []).map((r: SmartInsight) => ({ ...r, type: 'risk' as const })),
            ...(d?.opportunities ?? []).map((o: SmartInsight) => ({ ...o, type: 'opportunity' as const })),
          ].slice(0, 5)
        }

        if (anomaliesRes.status === 'fulfilled') {
          const d = anomaliesRes.value.data
          anomalies = d?.anomalies ?? d ?? []
        }
      }

      // Compute derived stats
      const totalRows = datasets.reduce((acc, d) => acc + (d.row_count ?? 0), 0)
      const qualityScores = datasets.filter(d => d.quality_score !== null).map(d => d.quality_score as number)
      const avgQuality = qualityScores.length > 0
        ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
        : 0

      setData({
        userStats: { ...userStats, total_rows: totalRows, avg_quality_score: avgQuality },
        datasets,
        smartInsights,
        anomalies,
        activityTimeline,
      })
    } catch (err) {
      console.error('Dashboard fetch error', err)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleRetry = () => {
    setRetrying(true)
    setLoading(true)
    fetchAll()
  }

  const firstName = dbUser?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const { userStats, datasets, smartInsights, anomalies, activityTimeline } = data

  const kpis: KPICardProps[] = [
    {
      title: 'Total Datasets', value: userStats.datasets || datasets.length,
      change: datasets.length > 0 ? `${datasets.length} active` : 'Upload to start',
      changeType: 'up', icon: Database, colorClass: 'blue', subtitle: 'PostgreSQL storage', index: 0,
    },
    {
      title: 'Total Rows', value: userStats.total_rows ?? 0,
      change: 'Across all datasets', changeType: 'neutral',
      icon: BarChart3, colorClass: 'purple', subtitle: 'Combined dataset size', index: 1,
    },
    {
      title: 'Avg Quality Score', value: userStats.avg_quality_score ?? 0, suffix: '%',
      change: (userStats.avg_quality_score ?? 0) >= 80 ? 'Excellent quality' : 'Needs attention',
      changeType: (userStats.avg_quality_score ?? 0) >= 80 ? 'up' : 'down',
      icon: Shield, colorClass: 'green', subtitle: 'Completeness & validity', index: 2,
    },
    {
      title: 'AI Analyses Run', value: userStats.analyses ?? 0,
      change: 'Auto-profile + KPI scans', changeType: 'up',
      icon: Zap, colorClass: 'cyan', subtitle: 'LLM-assisted insights', index: 3,
    },
  ]

  const quickActions = [
    { icon: Upload, label: 'Upload Data', path: '/datasets', color: '#8B5CF6' },
    { icon: TrendingUp, label: 'Run Forecast', path: '/forecasting', color: '#10B981' },
    { icon: Bot, label: 'AI Analysis', path: '/ai-analyst', color: '#EC4899' },
    { icon: FileText, label: 'Exec Report', path: '/insights', color: '#F59E0B' },
    { icon: LayoutGrid, label: 'Auto Dashboard', path: '/auto-dashboard', color: '#06B6D4' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {greeting}, <span className="text-gradient">{firstName}</span> 👋
          </h1>
          <p className="text-text-muted text-sm mt-1 flex items-center gap-2">
            <Clock size={13} />
            {today}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRetry} disabled={retrying} className="btn-secondary text-xs px-3 py-2">
            <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button id="dashboard-upload-btn" onClick={() => navigate('/datasets')} className="btn-primary text-sm px-4 py-2">
            <Upload size={14} />
            Upload Dataset
          </button>
        </div>
      </motion.div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((kpi, i) => <KPICard key={i} {...kpi} />)
        }
      </div>

      {/* ── Smart Insights Feed ──────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-text flex items-center gap-2">
              <Lightbulb size={16} className="text-primary" />
              Smart Insights
            </h3>
            <p className="text-text-muted text-xs mt-0.5">AI-generated findings from your latest dataset</p>
          </div>
          {datasets.length > 0 && (
            <button onClick={() => navigate('/insights')} className="text-primary text-xs flex items-center gap-1 hover:text-primary/80 transition-colors">
              View all <ArrowRight size={12} />
            </button>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : smartInsights.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload size={22} className="text-primary" />
            </div>
            <p className="text-text font-semibold text-sm">No insights yet</p>
            <p className="text-text-muted text-xs max-w-xs">Upload a dataset and run analysis to get AI-generated smart insights.</p>
            <button onClick={() => navigate('/datasets')} className="btn-primary text-xs px-4 py-2 mt-1">
              Upload Dataset
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {smartInsights.slice(0, 4).map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.07 }}
                className={cn('insight-card', insight.type)}
              >
                <div className="flex items-start gap-3">
                  <InsightTypeIcon type={insight.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-text text-sm font-medium">{insight.title}</span>
                      {insight.severity && <SeverityBadge severity={insight.severity} />}
                      <span className={cn(
                        'badge text-[10px]',
                        insight.type === 'risk' ? 'badge-danger' : insight.type === 'opportunity' ? 'badge-success' : 'badge-primary'
                      )}>
                        {insight.type}
                      </span>
                    </div>
                    <p className="text-text-muted text-xs mt-1 leading-relaxed">{insight.description}</p>
                    {insight.impact && (
                      <p className="text-text-subtle text-[10px] mt-1">Impact: {insight.impact}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Middle Row: Datasets Table + Anomaly Alerts ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Recent Datasets */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-3 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-text flex items-center gap-2">
                <Database size={16} className="text-primary" />
                Recent Datasets
              </h3>
              <p className="text-text-muted text-xs mt-0.5">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''} uploaded</p>
            </div>
            <button onClick={() => navigate('/datasets')} className="text-primary text-xs flex items-center gap-1 hover:text-primary/80 transition-colors">
              Manage <ArrowRight size={12} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-1 divide-y divide-border">
              {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : datasets.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database size={18} className="text-primary" />
              </div>
              <p className="text-text-muted text-sm">No datasets yet.</p>
              <button onClick={() => navigate('/datasets')} className="btn-primary text-xs px-4 py-2">
                Upload First Dataset
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted uppercase tracking-wider border-b border-border">
                    <th className="text-left pb-3 font-medium">Name</th>
                    <th className="text-right pb-3 font-medium">Rows</th>
                    <th className="text-right pb-3 font-medium">Quality</th>
                    <th className="text-center pb-3 font-medium">Status</th>
                    <th className="text-right pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {datasets.slice(0, 6).map((ds, i) => (
                    <motion.tr
                      key={ds.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      className="hover:bg-white/3 transition-colors"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <Database size={10} className="text-primary" />
                          </div>
                          <span className="font-medium text-text truncate max-w-[140px]" title={ds.name}>{ds.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-text-muted">{ds.row_count?.toLocaleString() ?? '—'}</td>
                      <td className="py-3 text-right">
                        <span className="font-bold" style={{ color: qualityColor(ds.quality_score) }}>
                          {ds.quality_score ? `${ds.quality_score}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <StatusBadge status={ds.status} />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => navigate(`/analytics`)}
                            className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
                          >
                            Analyze
                          </button>
                          <button
                            onClick={() => navigate('/forecasting')}
                            className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-[10px] font-medium hover:bg-accent/20 transition-colors"
                          >
                            Forecast
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Anomaly Alerts */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-text flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning" />
                Anomaly Alerts
              </h3>
              <p className="text-text-muted text-xs mt-0.5">Detected in latest dataset</p>
            </div>
            {anomalies.length > 0 && (
              <span className="badge badge-warning text-[10px]">{anomalies.length} found</span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <div className="w-10 h-10 rounded-xl glow-success bg-success/10 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-success" />
              </div>
              <p className="text-success font-semibold text-sm">All Clear</p>
              <p className="text-text-muted text-xs">No anomalies detected in your datasets.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar">
              {anomalies.slice(0, 8).map((anomaly, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.06 }}
                  className="glass-card p-3 rounded-xl"
                >
                  <div className="flex items-start gap-2">
                    <SeverityBadge severity={anomaly.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-xs font-medium truncate">
                        {anomaly.column || anomaly.feature || anomaly.type}
                      </p>
                      <p className="text-text-muted text-[10px] mt-0.5 leading-relaxed">{anomaly.description}</p>
                      {anomaly.value !== undefined && (
                        <p className="text-text-subtle text-[10px] mt-0.5">Value: {String(anomaly.value)}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Bottom Row: Activity Timeline + Quick Actions ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Activity Timeline */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }} className="lg:col-span-3 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-text flex items-center gap-2">
                <Activity size={16} className="text-accent" />
                Activity Timeline
              </h3>
              <p className="text-text-muted text-xs mt-0.5">Your recent actions</p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
            </div>
          ) : activityTimeline.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Clock size={18} className="text-accent" />
              </div>
              <p className="text-text-muted text-sm">No recent activity.</p>
              <p className="text-text-subtle text-xs">Start by uploading a dataset to see your activity here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
              {activityTimeline.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background-secondary hover:bg-background-tertiary transition-colors"
                >
                  <span className="text-lg flex-shrink-0">{item.icon || '⚡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-xs font-medium truncate">{item.text}</p>
                    <p className="text-text-subtle text-[10px] mt-0.5">{item.time}</p>
                  </div>
                  <CheckCircle2 size={13} className="text-success opacity-60 flex-shrink-0" />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }} className="lg:col-span-2 glass-card p-6">
          <div className="mb-5">
            <h3 className="font-semibold text-text flex items-center gap-2">
              <Zap size={16} className="text-warning" />
              Quick Actions
            </h3>
            <p className="text-text-muted text-xs mt-0.5">Jump to key workflows</p>
          </div>
          <div className="space-y-3">
            {quickActions.map((action, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + i * 0.07 }}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 p-3 rounded-xl glass-card-hover text-left group"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                  style={{ background: `${action.color}20`, border: `1px solid ${action.color}30` }}
                >
                  <action.icon size={15} style={{ color: action.color }} />
                </div>
                <span className="text-sm font-medium text-text-muted group-hover:text-text transition-colors">{action.label}</span>
                <ArrowRight size={14} className="text-text-subtle ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

    </div>
  )
}
