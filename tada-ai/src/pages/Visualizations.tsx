import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { BarChart3, Download, Maximize2, Filter, Plus, RefreshCw, Loader2 } from 'lucide-react'
import { CHART_COLORS, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useDatasetStore } from '@/store'
import { api } from '@/lib/api'

interface ChartSeries {
  title: string
  data: any[]
}

interface VisualizationsData {
  dataset_id: string
  charts: {
    bar?: ChartSeries
    line?: ChartSeries
    pie?: ChartSeries
    scatter?: ChartSeries
    histogram?: ChartSeries
    heatmap?: ChartSeries
    boxplot?: ChartSeries
  }
}

type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'histogram'

const chartTypes: { type: ChartType; label: string; icon: string }[] = [
  { type: 'bar', label: 'Bar Chart', icon: '📊' },
  { type: 'line', label: 'Line Chart', icon: '📈' },
  { type: 'pie', label: 'Pie Chart', icon: '🍩' },
  { type: 'scatter', label: 'Scatter Plot', icon: '⚡' },
  { type: 'histogram', label: 'Histogram', icon: '📶' },
]

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-container group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text text-sm">{title}</h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => toast('Fullscreen mode coming soon!')} className="btn-ghost p-1.5">
            <Maximize2 size={13} />
          </button>
          <button onClick={() => toast.success('Chart exported!')} className="btn-ghost p-1.5">
            <Download size={13} />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

export function Visualizations() {
  const { datasets, activeDataset, setActiveDataset } = useDatasetStore()
  const [selectedType, setSelectedType] = useState<ChartType>('bar')
  const [chartData, setChartData] = useState<VisualizationsData | null>(null)
  const [loading, setLoading] = useState(false)

  // Set active dataset to first one if none selected
  useEffect(() => {
    if (!activeDataset && datasets.length > 0) {
      setActiveDataset(datasets[0])
    }
  }, [datasets, activeDataset, setActiveDataset])

  const fetchChartData = async (datasetId: string) => {
    setLoading(true)
    try {
      const res = await api.get<VisualizationsData>(`/api/visualizations/${datasetId}`)
      setChartData(res.data)
    } catch (err: any) {
      toast.error('Failed to load visualizations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeDataset?.id) {
      fetchChartData(activeDataset.id)
    }
  }, [activeDataset])

  const handleDatasetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ds = datasets.find(d => d.id === e.target.value)
    if (ds) {
      setActiveDataset(ds)
    }
  }

  const handleRegenerate = () => {
    if (activeDataset?.id) {
      fetchChartData(activeDataset.id)
      toast.success('Visualizations regenerated!')
    }
  }

  const renderActiveChart = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-border rounded-2xl">
          <Loader2 size={32} className="animate-spin text-primary mb-2" />
          <p className="text-text-muted text-sm">Processing chart variables...</p>
        </div>
      )
    }

    if (!chartData || !activeDataset) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-border rounded-2xl">
          <p className="text-text-muted text-sm">No dataset selected or uploaded</p>
        </div>
      )
    }

    const { bar, line, pie, scatter, histogram } = chartData.charts

    switch (selectedType) {
      case 'bar':
        if (!bar || !bar.data || bar.data.length === 0) return <EmptyChartState type="Bar Chart" />
        return (
          <ChartCard title={bar.title}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bar.data} margin={{ left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="value" name="Total Value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )

      case 'line':
        if (!line || !line.data || line.data.length === 0) return <EmptyChartState type="Line Chart" />
        return (
          <ChartCard title={line.title}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={line.data} margin={{ left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="vizGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={2} fill="url(#vizGrad2)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )

      case 'pie':
        if (!pie || !pie.data || pie.data.length === 0) return <EmptyChartState type="Pie Chart" />
        return (
          <ChartCard title={pie.title}>
            <div className="flex flex-col md:flex-row items-center gap-6 h-[260px]">
              <ResponsiveContainer width="100%" height={200} className="max-w-[300px]">
                <PieChart>
                  <Pie data={pie.data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pie.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1 w-full overflow-y-auto max-h-[220px]">
                {pie.data.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-text-muted flex-1 truncate">{item.name}</span>
                    <span className="text-text font-semibold">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )

      case 'scatter':
        if (!scatter || !scatter.data || scatter.data.length === 0) return <EmptyChartState type="Scatter Plot" />
        return (
          <ChartCard title={scatter.title}>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" dataKey="x" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatter.data} fill="#EC4899" opacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        )

      case 'histogram':
        if (!histogram || !histogram.data || histogram.data.length === 0) return <EmptyChartState type="Histogram" />
        return (
          <ChartCard title={histogram.title}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histogram.data} margin={{ left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" name="Frequency" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-header">Visualization Center</h1>
          <p className="section-subheader">Interactive charts and data visualizations</p>
        </div>
        <div className="flex items-center gap-2">
          {datasets.length > 0 ? (
            <select
              value={activeDataset?.id || ''}
              onChange={handleDatasetChange}
              className="input-field text-sm py-2 w-64"
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          ) : (
            <div className="text-text-muted text-sm mr-2">No datasets uploaded</div>
          )}
          
          {activeDataset && (
            <button id="generate-viz-btn" onClick={handleRegenerate} disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Chart type selector */}
      <div className="flex gap-2 flex-wrap">
        {chartTypes.map(ct => (
          <button
            key={ct.type}
            id={`chart-type-${ct.type}`}
            onClick={() => setSelectedType(ct.type)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedType === ct.type
                ? 'bg-primary text-white'
                : 'bg-background-secondary border border-border text-text-muted hover:text-text hover:border-border-light'
            )}
          >
            <span>{ct.icon}</span> {ct.label}
          </button>
        ))}
      </div>

      {/* Primary Chart Area */}
      <div className="glass-card p-4 min-h-[350px]">
        {renderActiveChart()}
      </div>
    </div>
  )
}

function EmptyChartState({ type }: { type: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-center">
      <div className="text-3xl mb-2">📉</div>
      <div className="text-text font-medium text-sm">Cannot render {type}</div>
      <p className="text-text-muted text-xs max-w-sm mt-1">
        This dataset doesn't contain matching column types (categorical/numerical) needed for this visualization format.
      </p>
    </div>
  )
}
