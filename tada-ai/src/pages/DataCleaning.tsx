import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Wand2, AlertTriangle, XCircle, Info, CheckCircle2,
  Download, ArrowRight, RefreshCw, Loader2, Database
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useDatasetStore } from '@/store'
import { api } from '@/lib/api'

interface CleanResults {
  dataset_id: string
  original_quality: number
  new_quality: number
  issues_fixed: Record<string, number>
  rows_after_cleaning: number
  clean_file_path: string
}

export function DataCleaning() {
  const navigate = useNavigate()
  const { datasets, activeDataset, setActiveDataset, updateDataset } = useDatasetStore()
  const [cleaning, setCleaning] = useState(false)
  const [cleanedResults, setCleanedResults] = useState<CleanResults | null>(null)
  const [step, setStep] = useState(0)

  const cleaningSteps = [
    'Scanning for missing values...',
    'Detecting duplicate records...',
    'Identifying data distribution outliers...',
    'Checking column types...',
    'Applying statistical fixes...',
    'Updating dataset quality score...',
  ]

  // Set active dataset to first one if none selected
  useEffect(() => {
    if (!activeDataset && datasets.length > 0) {
      setActiveDataset(datasets[0])
    }
  }, [datasets, activeDataset, setActiveDataset])

  const handleDatasetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ds = datasets.find(d => d.id === e.target.value)
    if (ds) {
      setActiveDataset(ds)
      setCleanedResults(null)
    }
  }

  const handleAutoClean = async () => {
    if (!activeDataset) {
      toast.error('Please upload or select a dataset first!')
      return
    }

    setCleaning(true)
    
    // Simulate steps on UI for visual effect, then invoke API
    for (let i = 0; i < 4; i++) {
      setStep(i)
      await new Promise(r => setTimeout(r, 400))
    }

    try {
      setStep(4)
      const res = await api.post<CleanResults>(`/api/datasets/${activeDataset.id}/clean`)
      
      setStep(5)
      await new Promise(r => setTimeout(r, 300))
      
      setCleanedResults(res.data)
      
      // Update dataset in store
      updateDataset(activeDataset.id, {
        quality_score: res.data.new_quality,
        missing_values: 0,
        duplicate_rows: 0
      })
      
      toast.success(`Dataset cleaned successfully! Score improved to ${res.data.new_quality}%`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to clean dataset')
    } finally {
      setCleaning(false)
    }
  }

  // Calculate stats
  const beforeScore = activeDataset?.quality_score || 65
  const afterScore = cleanedResults ? cleanedResults.new_quality : '–'
  
  let totalFixed = 0
  if (cleanedResults?.issues_fixed) {
    totalFixed = Object.values(cleanedResults.issues_fixed).reduce((a, b) => a + b, 0)
  }

  const issueData = [
    { type: 'Missing Values', before: activeDataset?.missing_values || 0, after: 0 },
    { type: 'Duplicates', before: activeDataset?.duplicate_rows || 0, after: 0 },
  ]

  const handleDownload = () => {
    if (!activeDataset) return
    // Directly open download url
    const downloadUrl = `${api.defaults.baseURL}/api/datasets/${activeDataset.id}/download?cleaned=true`
    window.open(downloadUrl, '_blank')
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-header">Data Cleaning Engine</h1>
          <p className="section-subheader">Automatically detect and fix data quality issues</p>
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
          
          {datasets.length > 0 && (
            !cleanedResults ? (
              <button id="auto-clean-btn" onClick={handleAutoClean} disabled={cleaning} className="btn-primary">
                {cleaning ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {cleaning ? cleaningSteps[step] : 'Auto-Clean Dataset'}
              </button>
            ) : (
              <button onClick={() => setCleanedResults(null)} className="btn-secondary text-sm">
                <RefreshCw size={14} /> Re-scan
              </button>
            )
          )}
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Before Cleaning', score: beforeScore, color: '#F59E0B', icon: '⚠️' },
          { label: 'After Cleaning', score: afterScore, color: '#10B981', icon: cleanedResults ? '✅' : '⏳' },
          { label: 'Issues Fixed', score: totalFixed, color: '#8B5CF6', icon: '🔧', unit: '' },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="kpi-card">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-2">{card.label}</div>
            <div className="text-4xl font-black" style={{ color: card.color }}>
              {card.score}{card.unit !== '' && typeof card.score === 'number' ? '%' : ''}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Before/After Chart */}
      {cleanedResults && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="font-semibold text-text mb-4">Issues Cleared</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={issueData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="type" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="before" name="Before" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.7} />
              <Bar dataKey="after" name="After" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Issues list */}
      <div>
        <h3 className="font-semibold text-text mb-3">Detected Data Issues</h3>
        <div className="space-y-3">
          {[
            {
              icon: AlertTriangle,
              type: 'warning',
              title: 'Missing Values',
              count: activeDataset?.missing_values || 0,
              description: `${activeDataset?.missing_values || 0} cells across columns have null values`,
              action: 'Fill with column median/mode'
            },
            {
              icon: XCircle,
              type: 'error',
              title: 'Duplicate Rows',
              count: activeDataset?.duplicate_rows || 0,
              description: `${activeDataset?.duplicate_rows || 0} exact duplicate rows found in dataset`,
              action: 'Remove duplicate rows'
            }
          ].map((issue, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                'glass-card p-4 flex items-center gap-4',
                cleanedResults && 'opacity-60'
              )}
            >
              <issue.icon size={18} className={
                issue.type === 'error' ? 'text-danger flex-shrink-0' : 'text-warning flex-shrink-0'
              } />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-text text-sm">{issue.title}</span>
                  <span className={cn('badge text-[10px]',
                    issue.type === 'error' ? 'badge-danger' : 'badge-warning'
                  )}>{issue.count}</span>
                </div>
                <p className="text-text-muted text-xs">{issue.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {cleanedResults ? (
                  <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 size={13} /> Fixed</span>
                ) : (
                  <span className="text-text-subtle text-xs">{issue.action}</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {cleanedResults && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
          <button onClick={handleDownload} className="btn-primary flex-1 justify-center py-3">
            <Download size={16} /> Download Cleaned Dataset
          </button>
          <button onClick={() => navigate('/analytics')} className="btn-secondary flex-1 justify-center py-3">
            <ArrowRight size={16} /> Proceed to Analytics
          </button>
        </motion.div>
      )}
    </div>
  )
}
