import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  LayoutGrid, RefreshCw, Database, TrendingUp, ArrowUp, ArrowDown,
  Minus, Lightbulb, Upload, AlertCircle, CheckCircle2, Zap
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Dataset } from '@/store'

const CHART_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899']

interface KPI {
  name: string
  column: string
  value: number | null
  prev_value: number | null
  change_pct: number
  trend: 'up' | 'down' | 'stable'
  unit: string
  min: number | null
  max: number | null
}

interface ChartConfig {
  id: string
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'histogram'
  title: string
  x_col: string
  y_col: string
  data: Record<string, unknown>[]
  color: string
}

interface DashboardConfig {
  charts: ChartConfig[]
  kpis: KPI[]
  suggested_analysis: string[]
}

function formatValue(val: number | null, unit: string): string {
  if (val === null || val === undefined) return '–'
  const abs = Math.abs(val)
  let formatted: string
  if (abs >= 1_000_000) formatted = `${(val / 1_000_000).toFixed(1)}M`
  else if (abs >= 1_000) formatted = `${(val / 1_000).toFixed(1)}K`
  else formatted = val.toFixed(2).replace(/\.?0+$/, '')
  return unit === '$' ? `$${formatted}` : unit === '%' ? `${formatted}%` : formatted
}

function KPIStrip({ kpis, loading }: { kpis: KPI[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-48 flex-shrink-0 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (kpis.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.column}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="glass-card p-4 flex-shrink-0 w-52"
        >
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2 truncate">{kpi.name}</div>
          <div className="kpi-metric-value text-2xl">{formatValue(kpi.value, kpi.unit)}</div>
          <div className="flex items-center gap-1 mt-1.5">
            {kpi.trend === 'up' ? (
              <ArrowUp size={10} className="text-success" />
            ) : kpi.trend === 'down' ? (
              <ArrowDown size={10} className="text-danger" />
            ) : (
              <Minus size={10} className="text-text-muted" />
            )}
            <span className={cn('text-[10px] font-medium',
              kpi.trend === 'up' ? 'text-success' : kpi.trend === 'down' ? 'text-danger' : 'text-text-muted'
            )}>
              {kpi.change_pct > 0 ? '+' : ''}{kpi.change_pct.toFixed(1)}%
            </span>
            <span className="text-[10px] text-text-subtle">vs prior</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function DynamicChart({ config }: { config: ChartConfig }) {
  const { type, title, data, color, x_col, y_col } = config

  const chartStyle = {
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#94A3B8',
  }

  const axisProps = {
    tick: { fill: '#64748B', fontSize: 10 },
    axisLine: false as const,
    tickLine: false as const,
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-5"
    >
      <h3 className="font-semibold text-text text-sm mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey={x_col} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={chartStyle} />
            <Bar dataKey={y_col} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ left: -10 }}>
            <defs>
              <linearGradient id={`lineGrad_${config.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey={x_col} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={chartStyle} />
            <Line type="monotone" dataKey={y_col || 'y'} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data} margin={{ left: -10 }}>
            <defs>
              <linearGradient id={`areaGrad_${config.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey={x_col} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={chartStyle} />
            <Area type="monotone" dataKey={y_col || 'y'} stroke={color} strokeWidth={2} fill={`url(#areaGrad_${config.id})`} />
          </AreaChart>
        ) : type === 'pie' ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartStyle} />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#64748B' }} />
          </PieChart>
        ) : type === 'scatter' ? (
          <ScatterChart margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey={x_col} type="number" {...axisProps} />
            <YAxis dataKey={y_col} type="number" {...axisProps} />
            <Tooltip contentStyle={chartStyle} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill={color} opacity={0.7} />
          </ScatterChart>
        ) : (
          /* histogram rendered as bar */
          <BarChart data={data} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="bin" {...axisProps} tickFormatter={(v) => Number(v).toFixed(0)} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={chartStyle} />
            <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  )
}

export function AutoDashboard() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingDatasets, setFetchingDatasets] = useState(true)
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch user datasets
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await api.get('/api/datasets/')
        if (res.data?.datasets) {
          setDatasets(res.data.datasets)
          if (res.data.datasets.length > 0) {
            setSelectedDatasetId(res.data.datasets[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch datasets', err)
      } finally {
        setFetchingDatasets(false)
      }
    }
    fetchDatasets()
  }, [])

  const buildDashboard = useCallback(async (datasetId?: string) => {
    const id = datasetId || selectedDatasetId
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/api/datasets/${id}/auto-dashboard`)
      setConfig(res.data)
      toast.success('Dashboard generated!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate dashboard'
      setError(msg)
      toast.error('Dashboard generation failed')
    } finally {
      setLoading(false)
    }
  }, [selectedDatasetId])

  // Auto-build when dataset changes
  useEffect(() => {
    if (selectedDatasetId) buildDashboard(selectedDatasetId)
  }, [selectedDatasetId])

  const handleDatasetChange = (id: string) => {
    setSelectedDatasetId(id)
    setConfig(null)
  }

  // Empty state — no datasets
  if (!fetchingDatasets && datasets.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246,0.15), rgba(236, 72, 153,0.15))', border: '1px solid rgba(139, 92, 246,0.2)' }}>
          📊
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-text mb-2">No Datasets Found</h2>
          <p className="text-text-muted text-sm max-w-sm">Upload a dataset to automatically generate a custom BI dashboard with AI-powered charts and KPIs.</p>
        </div>
        <button onClick={() => navigate('/datasets')} className="btn-primary">
          <Upload size={14} /> Upload Dataset
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #8B5CF6)' }}>
              <LayoutGrid size={16} className="text-white" />
            </div>
            <h1 className="section-header">Auto Dashboard Builder</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(6,182,212,0.15)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)' }}>
              AI-Powered
            </span>
          </div>
          <p className="section-subheader">Automatically generated charts, KPIs, and insights from your dataset</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDatasetId}
            onChange={e => handleDatasetChange(e.target.value)}
            className="input-field text-sm py-2 w-56"
          >
            {datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={() => buildDashboard()}
            disabled={loading || !selectedDatasetId}
            className="btn-primary"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {loading ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-card p-4 flex items-center gap-3 border-red-500/30">
          <AlertCircle size={18} className="text-danger flex-shrink-0" />
          <p className="text-sm text-text-muted">{error}</p>
          <button onClick={() => buildDashboard()} className="ml-auto text-xs text-primary hover:underline">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !config && (
        <div className="space-y-6">
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24 w-52 flex-shrink-0 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <AnimatePresence mode="wait">
        {config && !loading && (
          <motion.div
            key={selectedDatasetId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* KPI Strip */}
            {config.kpis.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-primary" /> Key Performance Indicators
                </h2>
                <KPIStrip kpis={config.kpis} loading={false} />
              </div>
            )}

            {/* Charts Grid */}
            {config.charts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <Database size={14} className="text-accent" /> Auto-Generated Charts
                  <span className="text-text-subtle text-xs">({config.charts.length} charts)</span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {config.charts.map((chart, i) => (
                    <DynamicChart key={chart.id} config={chart} />
                  ))}
                </div>
              </div>
            )}

            {/* No charts fallback */}
            {config.charts.length === 0 && (
              <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: 'rgba(139, 92, 246,0.1)', border: '1px solid rgba(139, 92, 246,0.2)' }}>
                  📊
                </div>
                <div>
                  <h3 className="font-semibold text-text mb-1">No Charts Generated</h3>
                  <p className="text-sm text-text-muted">The dataset may not have enough numeric or categorical columns for automatic chart generation.</p>
                </div>
              </div>
            )}

            {/* Suggested Analysis */}
            {config.suggested_analysis.length > 0 && (
              <div className="glass-card p-5" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
                <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <Lightbulb size={14} className="text-warning" /> Suggested Next Steps
                </h2>
                <div className="flex flex-wrap gap-2">
                  {config.suggested_analysis.map((suggestion, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs text-text-muted"
                      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
                    >
                      <CheckCircle2 size={12} className="text-success flex-shrink-0 mt-0.5" />
                      {suggestion}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
