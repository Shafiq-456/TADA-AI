import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Database, Search, Filter, Grid, List,
  FileText, Trash2, Eye, RefreshCw, Plus, X,
  CheckCircle2, AlertCircle, Loader2, Download
} from 'lucide-react'
import { useDatasetStore, type Dataset } from '@/store'
import { formatBytes, formatRelativeTime, getFileTypeIcon, getQualityColor, getQualityLabel, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const ACCEPTED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/json': ['.json'],
}

// Demo datasets for display
const DEMO_DATASETS: Dataset[] = [
  {
    id: 'd1', user_id: 'u1', name: 'sales_q4_2025.csv', description: 'Q4 2025 Sales Performance Data',
    file_path: '/uploads/sales_q4_2025.csv', file_size: 2457600, file_type: 'csv',
    row_count: 15420, column_count: 18, columns: null, status: 'ready', quality_score: 92,
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'd2', user_id: 'u1', name: 'customer_segments.xlsx', description: 'Customer Segmentation Analysis',
    file_path: '/uploads/customer_segments.xlsx', file_size: 891000, file_type: 'xlsx',
    row_count: 8750, column_count: 24, columns: null, status: 'ready', quality_score: 78,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'd3', user_id: 'u1', name: 'product_inventory.json', description: 'Product Inventory & Stock Levels',
    file_path: '/uploads/product_inventory.json', file_size: 445000, file_type: 'json',
    row_count: 3210, column_count: 12, columns: null, status: 'processing', quality_score: null,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'd4', user_id: 'u1', name: 'marketing_campaign.csv', description: 'Marketing Campaign Performance Metrics',
    file_path: '/uploads/marketing_campaign.csv', file_size: 1234000, file_type: 'csv',
    row_count: 9850, column_count: 15, columns: null, status: 'ready', quality_score: 65,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString()
  },
]

function StatusBadge({ status }: { status: Dataset['status'] }) {
  const configs = {
    uploaded: { label: 'Uploaded', class: 'badge-primary' },
    processing: { label: 'Processing', class: 'badge-warning', animate: true },
    ready: { label: 'Ready', class: 'badge-success' },
    error: { label: 'Error', class: 'badge-danger' },
  }
  const config = configs[status] || configs.uploaded
  return (
    <span className={cn('badge', config.class, 'flex items-center gap-1')}>
      {status === 'processing' && <Loader2 size={10} className="animate-spin" />}
      {config.label}
    </span>
  )
}

function DatasetCard({ dataset, onView, onDelete }: {
  dataset: Dataset
  onView: (d: Dataset) => void
  onDelete: (id: string) => void
}) {
  const fileIcon = getFileTypeIcon(dataset.file_type)
  const qualityColor = dataset.quality_score ? getQualityColor(dataset.quality_score) : 'text-text-muted'
  const qualityLabel = dataset.quality_score ? getQualityLabel(dataset.quality_score) : 'Pending'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card-hover p-5 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-background-tertiary border border-border flex items-center justify-center flex-shrink-0 text-xl">
            {fileIcon}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-text text-sm truncate">{dataset.name}</h3>
            {dataset.description && (
              <p className="text-text-muted text-xs truncate mt-0.5">{dataset.description}</p>
            )}
          </div>
        </div>
        <StatusBadge status={dataset.status} />
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Rows', value: dataset.row_count ? dataset.row_count.toLocaleString() : '–' },
          { label: 'Columns', value: dataset.column_count ?? '–' },
          { label: 'Size', value: formatBytes(dataset.file_size) },
          { label: 'Uploaded', value: formatRelativeTime(dataset.created_at) },
        ].map((item) => (
          <div key={item.label} className="bg-background-secondary rounded-lg p-2">
            <div className="text-text-subtle text-[10px] uppercase tracking-wider">{item.label}</div>
            <div className="text-text text-xs font-medium mt-0.5">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Quality score */}
      {dataset.quality_score !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-text-muted">Data Quality</span>
            <span className={cn('text-xs font-semibold', qualityColor)}>{dataset.quality_score}% — {qualityLabel}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${dataset.quality_score}%`,
              background: dataset.quality_score >= 80 ? 'linear-gradient(90deg, #059669, #10B981)' :
                dataset.quality_score >= 60 ? 'linear-gradient(90deg, #D97706, #F59E0B)' :
                'linear-gradient(90deg, #DC2626, #EF4444)'
            }} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          id={`view-dataset-${dataset.id}`}
          onClick={() => onView(dataset)}
          className="flex-1 btn-primary text-xs py-2 justify-center"
        >
          <Eye size={13} /> View Dataset
        </button>
        <button
          id={`delete-dataset-${dataset.id}`}
          onClick={() => onDelete(dataset.id)}
          className="btn-danger p-2"
          title="Delete dataset"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  )
}

import { api } from '@/lib/api'

export function Datasets() {
  const navigate = useNavigate()
  const { datasets, addDataset, removeDataset, setDatasets, updateDataset } = useDatasetStore()
  const [localDatasets, setLocalDatasets] = useState<Dataset[]>(DEMO_DATASETS)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fetchDatasets = React.useCallback(async () => {
    try {
      const res = await api.get('/api/datasets/')
      if (res.data && Array.isArray(res.data.datasets)) {
        // If there are real datasets in the backend, merge or override
        setLocalDatasets(res.data.datasets.length > 0 ? res.data.datasets : DEMO_DATASETS)
        setDatasets(res.data.datasets)
      }
    } catch (err) {
      console.warn("Failed to fetch datasets from API, using demo fallback", err)
    }
  }, [setDatasets])

  React.useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    for (const file of acceptedFiles) {
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > 50) {
        toast.error(`${file.name} exceeds 50MB limit`)
        continue
      }

      setUploading(true)
      setUploadProgress(0)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post('/api/datasets/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
            setUploadProgress(percentCompleted)
          }
        })

        const newDataset: Dataset = response.data
        setLocalDatasets(prev => [newDataset, ...prev])
        addDataset(newDataset)
        toast.success(`${file.name} uploaded successfully!`)

        // Start polling status
        const pollInterval = setInterval(async () => {
          try {
            const pollRes = await api.get(`/api/datasets/${newDataset.id}`)
            const updatedDataset = pollRes.data
            if (updatedDataset.status === 'ready' || updatedDataset.status === 'error') {
              clearInterval(pollInterval)
              setLocalDatasets(prev => prev.map(d => d.id === newDataset.id ? updatedDataset : d))
              updateDataset(newDataset.id, updatedDataset)
              if (updatedDataset.status === 'ready') {
                toast.success(`${file.name} profiling is complete!`)
              } else {
                toast.error(`Failed to profile ${file.name}: ${updatedDataset.error || 'Unknown error'}`)
              }
            }
          } catch (err) {
            console.error("Error polling dataset:", err)
          }
        }, 2500)

      } catch (error) {
        console.warn("Failed to upload via API, using simulated fallback", error)
        // Simulate upload progress
        for (let p = 0; p <= 90; p += 10) {
          await new Promise(r => setTimeout(r, 80))
          setUploadProgress(p)
        }
        const ext = file.name.split('.').pop()?.toLowerCase() || 'csv'
        const mockDataset: Dataset = {
          id: Math.random().toString(36).substr(2, 9),
          user_id: 'current-user',
          name: file.name,
          description: 'Local simulation dataset (API offline)',
          file_path: `/uploads/${file.name}`,
          file_size: file.size,
          file_type: ext,
          row_count: null,
          column_count: null,
          columns: null,
          status: 'processing',
          quality_score: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setUploadProgress(100)
        setLocalDatasets(prev => [mockDataset, ...prev])
        toast.success(`${file.name} uploaded (Simulation mode)`)

        setTimeout(() => {
          setLocalDatasets(prev => prev.map(d =>
            d.id === mockDataset.id ? {
              ...d,
              status: 'ready',
              row_count: Math.floor(Math.random() * 10000) + 1000,
              column_count: Math.floor(Math.random() * 20) + 5,
              quality_score: Math.floor(Math.random() * 30) + 70,
            } : d
          ))
        }, 3000)
      } finally {
        setUploading(false)
        setUploadProgress(0)
      }
    }
  }, [addDataset, updateDataset])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 5,
  })

  const filtered = localDatasets.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/datasets/${id}`)
      setLocalDatasets(prev => prev.filter(d => d.id !== id))
      removeDataset(id)
      toast.success('Dataset deleted successfully')
    } catch (err) {
      console.warn("Failed to delete via API, removing locally", err)
      setLocalDatasets(prev => prev.filter(d => d.id !== id))
      removeDataset(id)
      toast.success('Dataset removed')
    }
  }

  const handleView = (dataset: Dataset) => {
    navigate(`/datasets/${dataset.id}`, { state: { dataset } })
  }


  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-header">Datasets</h1>
          <p className="section-subheader">Upload, manage, and analyze your data files</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-sm">{localDatasets.length} datasets</span>
        </div>
      </div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div
          {...getRootProps()}
          id="dataset-dropzone"
          className={cn('drop-zone p-8 text-center', isDragActive && 'active')}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
              </div>
              <div className="text-text font-medium">Uploading... {uploadProgress}%</div>
              <div className="w-48 progress-bar">
                <div className="progress-fill transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300',
                isDragActive
                  ? 'bg-primary/20 border-2 border-primary scale-110'
                  : 'bg-background-secondary border border-border'
              )}>
                <Upload size={24} className={isDragActive ? 'text-primary' : 'text-text-muted'} />
              </div>
              <div>
                <p className="text-text font-semibold">
                  {isDragActive ? 'Drop your files here' : 'Drag & drop files here'}
                </p>
                <p className="text-text-muted text-sm mt-1">
                  or <span className="text-primary cursor-pointer">browse files</span> — CSV, Excel, JSON up to 50MB
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-subtle">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-success" /> Auto-detect schema</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-success" /> Data quality scoring</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-success" /> Instant preview</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            id="dataset-search"
            type="text"
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 py-2 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-background-secondary border border-border">
          <button
            id="grid-view-btn"
            onClick={() => setViewMode('grid')}
            className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-primary text-white' : 'text-text-muted hover:text-text')}
          >
            <Grid size={14} />
          </button>
          <button
            id="list-view-btn"
            onClick={() => setViewMode('list')}
            className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-primary text-white' : 'text-text-muted hover:text-text')}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Dataset Grid */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center"
          >
            <Database size={48} className="mx-auto text-text-subtle opacity-30 mb-4" />
            <p className="text-text-muted font-medium">No datasets found</p>
            <p className="text-text-subtle text-sm mt-1">
              {searchQuery ? 'Try a different search term' : 'Upload your first dataset to get started'}
            </p>
          </motion.div>
        ) : (
          <div className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-3'
          )}>
            {filtered.map((dataset) => (
              <DatasetCard
                key={dataset.id}
                dataset={dataset}
                onView={handleView}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
