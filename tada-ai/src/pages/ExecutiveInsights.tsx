import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb, RefreshCw, TrendingUp, AlertTriangle, Target,
  Download, ChevronDown, ChevronUp, Zap, Shield, ArrowUpRight,
  ArrowDownRight, BarChart2, Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { Dataset } from '@/store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIMetric {
  name: string
  value: number | string
  change_pct?: number
  unit?: string
  description?: string
}

interface SwotData {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

interface Recommendation {
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  title: string
  description: string
  impact?: string
  effort?: string
  timeline?: string
  roi_estimate?: string
  icon?: string
}

interface InsightsData {
  executive_summary?: string
  swot?: SwotData
  recommendations?: (Recommendation | string)[]
  risks?: string[]
  opportunities?: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  Critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', icon: '🚨' },
  High: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: '⚡' },
  Medium: { color: '#8B5CF6', bg: 'rgba(139, 92, 246,0.12)', border: 'rgba(139, 92, 246,0.25)', icon: '🎯' },
  Low: { color: '#6366F1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)', icon: '💡' },
}

function priorityFromIndex(i: number): 'Critical' | 'High' | 'Medium' | 'Low' {
  return (['Critical', 'High', 'Medium', 'Low'] as const)[i % 4]
}

function normalizeRecommendation(rec: Recommendation | string, i: number): Recommendation {
  if (typeof rec === 'string') {
    return {
      priority: priorityFromIndex(i),
      title: rec.split(':')[0]?.trim() || 'Recommendation',
      description: rec,
      impact: i % 2 === 0 ? 'High' : 'Medium',
      effort: i % 3 === 0 ? 'Low' : 'Medium',
      timeline: `Q${(i % 4) + 1} 2026`,
    }
  }
  return rec
}

// ─── KPI Strip Card ───────────────────────────────────────────────────────────

function KPIStripCard({ metric, index }: { metric: KPIMetric; index: number }) {
  const isPositive = (metric.change_pct ?? 0) >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="glass-card p-4 min-w-[160px] flex-shrink-0"
    >
      <div className="text-text-muted text-[10px] uppercase tracking-wider mb-2 font-medium">{metric.name}</div>
      <div className="text-xl font-black text-white tracking-tight">
        {metric.unit === '$' ? `$${Number(metric.value).toLocaleString()}` : `${metric.value}${metric.unit ?? ''}`}
      </div>
      {metric.change_pct !== undefined && (
        <div className={cn('flex items-center gap-0.5 text-xs font-semibold mt-1.5', isPositive ? 'text-success' : 'text-danger')}>
          {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {Math.abs(metric.change_pct).toFixed(1)}%
        </div>
      )}
      {metric.description && (
        <p className="text-text-subtle text-[10px] mt-1 leading-tight">{metric.description}</p>
      )}
    </motion.div>
  )
}

// ─── Recommendation Card ──────────────────────────────────────────────────────

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = PRIORITY_CONFIG[rec.priority]

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="glass-card p-5"
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
          {rec.icon ?? cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-semibold text-text text-sm">{rec.title}</h4>
            <span
              className="badge text-[10px] font-bold"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              {rec.priority}
            </span>
          </div>
          <p className="text-text-muted text-xs leading-relaxed">{rec.description}</p>

          {(rec.impact || rec.effort || rec.timeline || rec.roi_estimate) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {rec.impact && (
                <span className="px-2 py-0.5 rounded-lg bg-background-secondary text-[10px] text-text-muted">
                  Impact: <span className="text-text font-semibold">{rec.impact}</span>
                </span>
              )}
              {rec.effort && (
                <span className="px-2 py-0.5 rounded-lg bg-background-secondary text-[10px] text-text-muted">
                  Effort: <span className="text-text font-semibold">{rec.effort}</span>
                </span>
              )}
              {rec.timeline && (
                <span className="px-2 py-0.5 rounded-lg bg-background-secondary text-[10px] text-text-muted">
                  Timeline: <span className="text-text font-semibold">{rec.timeline}</span>
                </span>
              )}
              {rec.roi_estimate && (
                <span className="px-2 py-0.5 rounded-lg bg-success/10 text-[10px] text-success border border-success/20">
                  ROI: {rec.roi_estimate}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── SWOT Quadrant ────────────────────────────────────────────────────────────

function SwotQuadrant({
  title, items, color, bg, border, icon, index,
}: {
  title: string; items: string[]; color: string; bg: string; border: string; icon: string; index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card p-5"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h3 className="font-bold text-text">{title}</h3>
        <span className="ml-auto text-xs text-text-muted bg-background-secondary px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <ul className="space-y-2.5">
        {items.length === 0 ? (
          <li className="text-text-muted text-xs italic">No data available</li>
        ) : (
          items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-text-muted">
              <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: color }} />
              {item}
            </li>
          ))
        )}
      </ul>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExecutiveInsights() {
  const [datasetsList, setDatasetsList] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loadingKPIs, setLoadingKPIs] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [kpis, setKpis] = useState<KPIMetric[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch datasets on mount
  useEffect(() => {
    api.get('/api/datasets/').then(res => {
      const list: Dataset[] = res.data?.datasets ?? res.data ?? []
      setDatasetsList(list)
      if (list.length > 0) setSelectedDatasetId(list[0].id)
    }).catch(() => toast.error('Failed to load datasets'))
  }, [])

  // When dataset changes, auto-fetch KPIs + generate insights simultaneously
  useEffect(() => {
    if (!selectedDatasetId) return

    const run = async () => {
      setLoadingKPIs(true)
      setGenerating(true)
      setError(null)

      const [insightsRes, kpiRes] = await Promise.allSettled([
        api.post(`/api/insights/${selectedDatasetId}/generate`),
        api.get(`/api/analytics/${selectedDatasetId}/kpi`),
      ])

      if (insightsRes.status === 'fulfilled') {
        setInsights(insightsRes.value.data)
      } else {
        setError('Failed to generate insights. Please try again.')
      }

      if (kpiRes.status === 'fulfilled') {
        const d = kpiRes.value.data
        setKpis(d?.kpis ?? d?.metrics ?? (Array.isArray(d) ? d : []))
      }

      setGenerating(false)
      setLoadingKPIs(false)
    }

    run()
  }, [selectedDatasetId])

  const handleGenerate = useCallback(async () => {
    if (!selectedDatasetId) return
    setGenerating(true)
    setError(null)
    try {
      const [insightsRes, recsRes] = await Promise.allSettled([
        api.post(`/api/insights/${selectedDatasetId}/generate`),
        api.post(`/api/insights/${selectedDatasetId}/recommendations`),
      ])

      if (insightsRes.status === 'fulfilled') {
        const base = insightsRes.value.data as InsightsData
        const additionalRecs = recsRes.status === 'fulfilled'
          ? (recsRes.value.data?.recommendations ?? recsRes.value.data ?? [])
          : []
        setInsights({ ...base, recommendations: [...(base.recommendations ?? []), ...additionalRecs] })
        toast.success('Executive insights regenerated!')
      } else {
        throw new Error('Generate failed')
      }
    } catch {
      toast.error('Failed to generate insights')
      setError('Could not reach the AI insights engine.')
    } finally {
      setGenerating(false)
    }
  }, [selectedDatasetId])

  const handleExportPDF = useCallback(async () => {
    if (!selectedDatasetId) return
    setExporting(true)
    try {
      const res = await api.get(`/api/insights/${selectedDatasetId}/export-pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `executive-insights-${selectedDatasetId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('PDF exported successfully!')
    } catch {
      toast.error('Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }, [selectedDatasetId])

  // Normalize SWOT
  const swotData: SwotData = insights?.swot ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] }
  const swotSections = [
    { title: 'Strengths', items: swotData.strengths, color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', icon: '💪' },
    { title: 'Weaknesses', items: swotData.weaknesses, color: '#EF4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', icon: '⚠️' },
    { title: 'Opportunities', items: swotData.opportunities, color: '#8B5CF6', bg: 'rgba(139, 92, 246,0.06)', border: 'rgba(139, 92, 246,0.2)', icon: '🚀' },
    { title: 'Threats', items: swotData.threats, color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', icon: '🛡️' },
  ]

  // Normalize recommendations
  const recommendations: Recommendation[] = (insights?.recommendations ?? [])
    .map((r, i) => normalizeRecommendation(r, i))
    .sort((a, b) => {
      const order = { Critical: 0, High: 1, Medium: 2, Low: 3 }
      return order[a.priority] - order[b.priority]
    })

  const risks: string[] = insights?.risks ?? swotData.threats ?? []
  const opportunities: string[] = insights?.opportunities ?? swotData.opportunities ?? []

  const hasInsights = insights !== null

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="section-header flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EC4899, #8B5CF6)' }}>
              <Lightbulb size={18} className="text-white" />
            </div>
            Executive Insights Hub
          </h1>
          <p className="section-subheader mt-1">AI-generated SWOT, KPIs, strategic recommendations &amp; business intelligence</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            id="insights-dataset-select"
            value={selectedDatasetId}
            onChange={e => setSelectedDatasetId(e.target.value)}
            className="input-field text-sm py-2 w-52"
          >
            {datasetsList.length === 0
              ? <option value="">No datasets uploaded</option>
              : datasetsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
            }
          </select>
          <button
            id="generate-insights-btn"
            onClick={handleGenerate}
            disabled={generating || !selectedDatasetId}
            className="btn-primary"
          >
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {generating ? 'Generating…' : 'Generate Insights'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || !hasInsights}
            className="btn-secondary"
          >
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Export PDF
          </button>
        </div>
      </motion.div>

      {/* ── Error State ──────────────────────────────────────────────────── */}
      {error && (
        <div className="glass-card p-4 border-danger/30 flex items-center gap-3">
          <AlertTriangle size={16} className="text-danger flex-shrink-0" />
          <p className="text-danger text-sm">{error}</p>
          <button onClick={handleGenerate} className="ml-auto btn-secondary text-xs px-3 py-1.5">Retry</button>
        </div>
      )}

      {/* ── No Datasets State ─────────────────────────────────────────── */}
      {datasetsList.length === 0 && !generating && (
        <div className="glass-card p-16 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lightbulb size={28} className="text-primary" />
          </div>
          <h2 className="text-text font-bold text-lg">No datasets available</h2>
          <p className="text-text-muted text-sm max-w-md">Upload a dataset first to generate executive insights, SWOT analysis, and strategic recommendations.</p>
        </div>
      )}

      {datasetsList.length > 0 && (
        <>
          {/* ── Executive Summary ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 gradient-border-animated"
            style={{ borderColor: 'rgba(236, 72, 153,0.3)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EC4899, #8B5CF6)' }}>
                <Star size={14} className="text-white" />
              </div>
              <span className="font-bold text-text text-base">Executive Summary</span>
              <span className="badge-success text-[10px]">AI Generated</span>
            </div>
            {generating ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : (
              <p className="text-text-muted text-sm leading-relaxed">
                {insights?.executive_summary ?? 'Select a dataset and click "Generate Insights" to run the AI analysis pipeline.'}
              </p>
            )}
          </motion.div>

          {/* ── KPI Strip ────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={16} className="text-accent" />
              <h3 className="font-semibold text-text text-sm">Key Performance Indicators</h3>
            </div>
            {loadingKPIs ? (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 min-w-[160px]" />)}
              </div>
            ) : kpis.length === 0 ? (
              <div className="glass-card p-6 text-center text-text-muted text-sm">
                No KPI data available. Try running analytics on the selected dataset first.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {kpis.map((kpi, i) => <KPIStripCard key={i} metric={kpi} index={i} />)}
              </div>
            )}
          </motion.div>

          {/* ── SWOT Grid ────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-warning" />
              <h3 className="font-semibold text-text">SWOT Analysis</h3>
            </div>
            {generating ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {swotSections.map((section, i) => (
                  <SwotQuadrant key={i} {...section} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* ── AI Recommendations ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target size={16} className="text-primary" />
              <h3 className="font-semibold text-text">AI Recommendation Engine</h3>
              {recommendations.length > 0 && (
                <span className="badge-primary text-[10px]">{recommendations.length} actions</span>
              )}
            </div>
            {generating ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-text-muted text-sm">No recommendations generated yet. Click "Generate Insights" to run the AI engine.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* ── Risks & Opportunities ────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Risks */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-danger" />
                <h3 className="font-semibold text-text">Risk Factors</h3>
                <span className="ml-auto badge badge-danger text-[10px]">{risks.length}</span>
              </div>
              {generating ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : risks.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-4">No risks identified yet.</p>
              ) : (
                <ul className="space-y-3">
                  {risks.map((risk, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-2 text-sm text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-danger" />
                      {risk}
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>

            {/* Opportunities */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card p-5" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-success" />
                <h3 className="font-semibold text-text">Opportunities</h3>
                <span className="ml-auto badge badge-success text-[10px]">{opportunities.length}</span>
              </div>
              {generating ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : opportunities.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-4">No opportunities identified yet.</p>
              ) : (
                <ul className="space-y-3">
                  {opportunities.map((opp, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-2 text-sm text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-success" />
                      {opp}
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}
