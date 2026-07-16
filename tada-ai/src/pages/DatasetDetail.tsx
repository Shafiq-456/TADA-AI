import React, { useState } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Database, Wand2, BarChart3, Download, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Info, Eye, Table2
} from 'lucide-react'
import { formatBytes, formatRelativeTime, getQualityColor, getQualityLabel, cn } from '@/lib/utils'
import type { Dataset } from '@/store'

const SAMPLE_COLUMNS = [
  { name: 'order_id', type: 'INTEGER', null_count: 0, unique_count: 15420, sample_values: [10001, 10002, 10003] },
  { name: 'customer_name', type: 'VARCHAR', null_count: 12, unique_count: 8234, sample_values: ['Alice Johnson', 'Bob Smith', 'Carol White'] },
  { name: 'product', type: 'VARCHAR', null_count: 0, unique_count: 342, sample_values: ['Widget Pro', 'Gadget Plus', 'Device Max'] },
  { name: 'quantity', type: 'INTEGER', null_count: 0, unique_count: 45, sample_values: [1, 3, 2] },
  { name: 'unit_price', type: 'FLOAT', null_count: 8, unique_count: 892, sample_values: [29.99, 149.50, 89.00] },
  { name: 'total_amount', type: 'FLOAT', null_count: 8, unique_count: 4521, sample_values: [29.99, 448.50, 178.00] },
  { name: 'order_date', type: 'DATE', null_count: 0, unique_count: 365, sample_values: ['2025-01-15', '2025-01-16', '2025-01-17'] },
  { name: 'region', type: 'VARCHAR', null_count: 45, unique_count: 8, sample_values: ['North', 'South', 'East'] },
  { name: 'salesperson_id', type: 'INTEGER', null_count: 0, unique_count: 127, sample_values: [501, 502, 503] },
  { name: 'status', type: 'VARCHAR', null_count: 0, unique_count: 5, sample_values: ['completed', 'pending', 'cancelled'] },
]

const SAMPLE_ROWS = [
  [10001, 'Alice Johnson', 'Widget Pro', 1, 29.99, 29.99, '2025-01-15', 'North', 501, 'completed'],
  [10002, 'Bob Smith', 'Gadget Plus', 3, 149.50, 448.50, '2025-01-15', 'South', 502, 'completed'],
  [10003, 'Carol White', 'Device Max', 2, 89.00, 178.00, '2025-01-16', 'East', 501, 'pending'],
  [10004, null, 'Widget Pro', 5, 29.99, 149.95, '2025-01-16', 'West', 503, 'completed'],
  [10005, 'Eve Davis', 'Gadget Plus', 1, 149.50, 149.50, '2025-01-17', 'North', 502, 'cancelled'],
]

import { api } from '@/lib/api'

export function DatasetDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'preview' | 'schema' | 'quality'>('preview')
  const [loading, setLoading] = useState(true)
  const [datasetInfo, setDatasetInfo] = useState<Dataset | null>(null)
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: any[][]; total_rows: number } | null>(null)

  const fetchDatasetDetails = React.useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch metadata
      const metaRes = await api.get(`/api/datasets/${id}`)
      setDatasetInfo(metaRes.data)

      // 2. Fetch preview
      const previewRes = await api.get(`/api/datasets/${id}/preview?rows=10`)
      setPreviewData(previewRes.data)
    } catch (err) {
      console.warn("Failed to fetch dataset details from API, using simulated state/mocks", err)
      const fallbackDataset: Dataset = location.state?.dataset || {
        id, name: 'sample_dataset.csv', file_size: 2457600, file_type: 'csv',
        row_count: 15420, column_count: 10, status: 'ready', quality_score: 87,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        user_id: '', description: 'Sample dataset', file_path: '', columns: SAMPLE_COLUMNS,
      }
      setDatasetInfo(fallbackDataset)
      setPreviewData({
        columns: SAMPLE_COLUMNS.map(c => c.name),
        rows: SAMPLE_ROWS,
        total_rows: fallbackDataset.row_count || 15420
      })
    } finally {
      setLoading(false)
    }
  }, [id, location.state])

  React.useEffect(() => {
    fetchDatasetDetails()
  }, [fetchDatasetDetails])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="animate-spin text-primary" size={32} />
        <span className="text-sm text-text-muted">Loading dataset details...</span>
      </div>
    )
  }

  const currentDataset: Dataset = datasetInfo || {
    id: id || '', 
    name: 'sample_dataset.csv', 
    file_size: 2457600, 
    file_type: 'csv',
    row_count: 15420, 
    column_count: 10, 
    status: 'ready', 
    quality_score: 87,
    missing_values: 28,
    duplicate_rows: 342,
    created_at: new Date().toISOString(), 
    updated_at: new Date().toISOString(),
    user_id: '', 
    description: 'Sample dataset', 
    file_path: '', 
    columns: SAMPLE_COLUMNS,
  }

  const colsInfo = currentDataset.columns || SAMPLE_COLUMNS
  const cols = previewData?.columns || colsInfo.map(c => c.name)
  const rows = previewData?.rows || SAMPLE_ROWS

  // Dynamic quality issues list based on actual metadata
  const qualityIssues = [
    {
      type: currentDataset.missing_values && currentDataset.missing_values > 0 ? 'warning' : 'success',
      icon: currentDataset.missing_values && currentDataset.missing_values > 0 ? AlertTriangle : CheckCircle2,
      message: currentDataset.missing_values && currentDataset.missing_values > 0 
        ? `${currentDataset.missing_values} missing values detected across cells` 
        : 'Dataset is fully complete (no missing values)',
      count: currentDataset.missing_values || 0
    },
    {
      type: currentDataset.duplicate_rows && currentDataset.duplicate_rows > 0 ? 'warning' : 'success',
      icon: currentDataset.duplicate_rows && currentDataset.duplicate_rows > 0 ? AlertTriangle : CheckCircle2,
      message: currentDataset.duplicate_rows && currentDataset.duplicate_rows > 0 
        ? `${currentDataset.duplicate_rows} duplicate rows detected` 
        : 'Dataset is completely unique (no duplicate rows)',
      count: currentDataset.duplicate_rows || 0
    }
  ]

  // Add individual column null issues
  colsInfo.forEach(c => {
    if (c.null_count > 0) {
      qualityIssues.push({
        type: 'warning',
        icon: AlertTriangle,
        message: `${c.null_count} nulls in column '${c.name}'`,
        count: c.null_count
      })
    }
  })

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/datasets')} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="section-header">{currentDataset.name}</h1>
            <span className={cn('badge', 
              currentDataset.status === 'ready' ? 'badge-success' : 
              currentDataset.status === 'processing' ? 'badge-warning' : 'badge-danger'
            )}>
              {currentDataset.status === 'ready' ? 'Ready' : currentDataset.status === 'processing' ? 'Processing' : 'Error'}
            </span>
          </div>
          {currentDataset.description && <p className="section-subheader">{currentDataset.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/cleaning')} className="btn-secondary text-sm px-4 py-2">
            <Wand2 size={14} /> Auto-Clean
          </button>
          <button onClick={() => navigate('/analytics')} className="btn-primary text-sm px-4 py-2">
            <BarChart3 size={14} /> Analyze
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Rows', value: currentDataset.row_count?.toLocaleString() ?? '–', icon: '📋', color: '#8B5CF6' },
          { label: 'Columns', value: currentDataset.column_count ?? '–', icon: '📊', color: '#EC4899' },
          { label: 'File Size', value: formatBytes(currentDataset.file_size), icon: '💾', color: '#06B6D4' },
          { label: 'Quality Score', value: currentDataset.quality_score ? `${currentDataset.quality_score}%` : 'Pending', icon: '⭐', color: '#10B981' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="kpi-card"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{stat.icon}</span>
              <span className="text-text-muted text-xs uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-text">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-list w-fit">
        {(['preview', 'schema', 'quality'] as const).map((tab) => (
          <button
            key={tab}
            id={`dataset-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={cn('tab-trigger capitalize', activeTab === tab && 'active')}
          >
            {tab === 'preview' ? '👁 Preview' : tab === 'schema' ? '📋 Schema' : '⭐ Quality'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'preview' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-text">Data Preview (first 10 rows)</span>
              <button className="btn-ghost text-xs flex items-center gap-1">
                <Download size={12} /> Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background-secondary">
                    {cols.map((colName) => {
                      const colInfo = colsInfo.find(c => c.name === colName)
                      return (
                        <th key={colName} className="text-left px-4 py-3 text-text-muted font-semibold uppercase tracking-wider whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span>{colName}</span>
                            <span className="text-[10px] text-text-subtle font-normal normal-case">{colInfo?.type || 'VARCHAR'}</span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border hover:bg-white/3 transition-colors">
                      {row.map((cell, ci) => (
                        <td key={ci} className={cn('px-4 py-3 whitespace-nowrap', cell === null || cell === undefined ? 'text-danger/70 italic' : 'text-text-muted')}>
                          {cell === null || cell === undefined ? 'NULL' : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border text-xs text-text-subtle text-center">
              Showing {rows.length} of {currentDataset.row_count?.toLocaleString() ?? '?'} rows
            </div>
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <span className="text-sm font-medium text-text">Column Schema ({colsInfo.length} columns)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background-secondary">
                    {['Column Name', 'Data Type', 'Null Values', 'Unique Values', 'Sample Values'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-text-muted font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {colsInfo.map((col, i) => (
                    <tr key={i} className="border-b border-border hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-mono text-text font-medium">{col.name}</td>
                      <td className="px-4 py-3">
                        <span className="badge-primary">{col.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={col.null_count > 0 ? 'text-warning' : 'text-success'}>
                          {col.null_count} ({col.null_pct || 0}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {col.unique_count !== undefined ? col.unique_count.toLocaleString() : '–'} ({col.unique_pct || 0}%)
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        <span className="font-mono">
                          {col.sample_values && col.sample_values.length > 0 
                            ? col.sample_values.slice(0, 3).map(String).join(', ') 
                            : '–'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-4">
            {/* Quality Score */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-text">Dataset Health Score</h3>
                  <p className="text-text-muted text-xs mt-0.5">Based on completeness, consistency, and accuracy</p>
                </div>
                <div className="text-right">
                  <div className={cn('text-4xl font-black', getQualityColor(currentDataset.quality_score || 0))}>
                    {currentDataset.quality_score || 0}%
                  </div>
                  <div className={cn('text-xs font-medium', getQualityColor(currentDataset.quality_score || 0))}>
                    {getQualityLabel(currentDataset.quality_score || 0)}
                  </div>
                </div>
              </div>
              <div className="progress-bar h-3">
                <div className="progress-fill h-full" style={{
                  width: `${currentDataset.quality_score || 0}%`,
                  background: (currentDataset.quality_score || 0) >= 80 ? 'linear-gradient(90deg, #059669, #10B981)' :
                    (currentDataset.quality_score || 0) >= 60 ? 'linear-gradient(90deg, #D97706, #F59E0B)' :
                    'linear-gradient(90deg, #DC2626, #EF4444)'
                }} />
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              {qualityIssues.map((issue, i) => (
                <div key={i} className={cn(
                  'glass-card p-4 flex items-center gap-3',
                  issue.type === 'warning' ? 'border-warning/20' :
                  issue.type === 'info' ? 'border-primary/20' : 'border-success/20'
                )}>
                  <issue.icon size={16} className={
                    issue.type === 'warning' ? 'text-warning' :
                    issue.type === 'info' ? 'text-primary' : 'text-success'
                  } />
                  <span className="text-text text-sm flex-1">{issue.message}</span>
                  {issue.count > 0 && (
                    <span className={cn('badge text-xs',
                      issue.type === 'warning' ? 'badge-warning' : 'badge-primary'
                    )}>
                      {issue.count} issues
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/cleaning')} className="btn-primary w-full justify-center py-3">
              <Wand2 size={16} /> Auto-Clean This Dataset
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

