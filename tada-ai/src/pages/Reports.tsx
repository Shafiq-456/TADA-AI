import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, Plus, Loader2, CheckCircle2, Eye, Trash2 } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { Dataset } from '@/store'

type ReportFormat = 'PDF' | 'Excel' | 'PowerPoint'

export function Reports() {
  const [reports, setReports] = useState<any[]>([])
  const [datasetsList, setDatasetsList] = useState<Dataset[]>([])
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newReport, setNewReport] = useState({ title: '', datasetId: '', format: 'PDF' as ReportFormat })

  const fetchReportsAndDatasets = React.useCallback(async () => {
    try {
      const [reportsRes, datasetsRes] = await Promise.all([
        api.get('/api/reports/'),
        api.get('/api/datasets/')
      ])
      
      if (Array.isArray(reportsRes.data)) {
        setReports(reportsRes.data) // show real data only — no fake fallback
      }
      
      if (datasetsRes.data && Array.isArray(datasetsRes.data.datasets)) {
        setDatasetsList(datasetsRes.data.datasets)
        if (datasetsRes.data.datasets.length > 0) {
          setNewReport(p => ({ ...p, datasetId: datasetsRes.data.datasets[0].id }))
        }
      }
    } catch (err) {
      console.warn("Failed to fetch reports/datasets list", err)
    }
  }, [])

  React.useEffect(() => {
    fetchReportsAndDatasets()
  }, [fetchReportsAndDatasets])

  const handleGenerate = async () => {
    if (!newReport.title) { toast.error('Please enter a report title'); return }
    if (!newReport.datasetId) { toast.error('Please upload and select a dataset'); return }
    
    setGenerating(true)
    try {
      const res = await api.post('/api/reports/generate', {
        dataset_id: newReport.datasetId,
        title: newReport.title,
        format: newReport.format
      })
      
      setReports(prev => [res.data, ...prev])
      setShowForm(false)
      setNewReport(p => ({ ...p, title: '' }))
      toast.success(`${newReport.title} generated successfully!`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Report generation failed. Make sure the backend is running.'
      toast.error(detail)
    } finally {
      setGenerating(false)
    }
  }

  const formatIcon: Record<ReportFormat | string, string> = { PDF: '📄', Excel: '📊', PowerPoint: '📑' }
  const formatColor: Record<ReportFormat | string, string> = { PDF: '#EF4444', Excel: '#10B981', PowerPoint: '#F59E0B' }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-header">Reports</h1>
          <p className="section-subheader">Generate professional PDF and Excel reports from your datasets</p>
        </div>
        <button id="create-report-btn" onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={14} /> New Report
        </button>
      </div>

      {/* Report Generator Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6" style={{ borderColor: 'rgba(139, 92, 246,0.25)' }}>
          <h3 className="font-semibold text-text mb-4">Generate New Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Report Title</label>
              <input type="text" placeholder="e.g. Q1 2026 Executive Report"
                value={newReport.title} onChange={e => setNewReport(p => ({ ...p, title: e.target.value }))}
                className="input-field text-sm py-2" />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Dataset</label>
              <select 
                value={newReport.datasetId} 
                onChange={e => setNewReport(p => ({ ...p, datasetId: e.target.value }))}
                className="input-field text-sm py-2 w-full"
              >
                {datasetsList.length === 0 ? (
                  <option value="">No datasets uploaded</option>
                ) : (
                  datasetsList.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">Format</label>
              <div className="flex gap-2">
                {(['PDF', 'Excel'] as ReportFormat[]).map(fmt => (
                  <button key={fmt} type="button" onClick={() => setNewReport(p => ({ ...p, format: fmt }))}
                    className={cn('flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                      newReport.format === fmt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:border-border-light'
                    )}>
                    {formatIcon[fmt]} {fmt}
                  </button>
                ))}
                <button
                  type="button"
                  disabled
                  title="PowerPoint export coming soon"
                  className="flex-1 py-2 rounded-xl text-xs font-medium border border-border text-text-subtle opacity-40 cursor-not-allowed"
                >
                  📑 PowerPoint
                </button>
              </div>
            </div>
          </div>


          {/* Sections checkboxes */}
          <div className="mb-4">
            <label className="text-xs text-text-muted mb-2 block">Report Sections (all included)</label>
            <div className="flex flex-wrap gap-2">
              {['Cover Page', 'Exec Summary', 'Dataset Overview', 'Key Metrics', 'Charts', 'Forecasts', 'Insights', 'Recommendations'].map(section => (
                <span key={section} className="flex items-center gap-1 badge-success text-[10px]">
                  <CheckCircle2 size={10} /> {section}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button id="generate-report-btn" onClick={handleGenerate} disabled={generating} className="btn-primary">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {generating ? 'Generating Report...' : `Generate ${newReport.format} Report`}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-3">📄</div>
          <h3 className="font-semibold text-text mb-1">No reports yet</h3>
          <p className="text-text-muted text-sm max-w-sm">
            Generate your first report by clicking <strong>New Report</strong> above.
          </p>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-3">
        {reports.map((report, i) => (
          <motion.div key={report.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }} className="glass-card p-5 flex items-center gap-4">
            <div className="w-10 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border"
              style={{ background: `${formatColor[report.format]}15`, borderColor: `${formatColor[report.format]}30` }}>
              <span className="text-xl">{formatIcon[report.format]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-text text-sm truncate">{report.title}</h3>
                <span className="badge-success text-[10px] flex-shrink-0">Ready</span>
              </div>
              <p className="text-text-muted text-xs">{report.dataset_name || report.dataset} · {report.sections || 8} sections · {report.pages || 22} pages</p>
              <p className="text-text-subtle text-[10px] mt-0.5">{formatDate(report.created_at || report.created)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button id={`view-report-${report.id}`} onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${report.download_url}`, '_blank')}
                className="btn-ghost text-xs flex items-center gap-1 py-1.5">
                <Eye size={13} /> Preview
              </button>
              <button id={`download-report-${report.id}`} onClick={() => {
                toast.success(`Downloading ${report.title}...`)
                window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${report.download_url}`, '_blank')
              }}
                className="btn-primary text-xs py-1.5 px-3">
                <Download size={13} /> Download
              </button>
              <button onClick={() => setReports(p => p.filter(r => r.id !== report.id))}
                className="btn-danger p-1.5">
                <Trash2 size={13} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
