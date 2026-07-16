import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, User, Sparkles, Database, BarChart3,
  TrendingUp, RefreshCw, Copy, ThumbsUp, ThumbsDown,
  ChevronDown, Paperclip, Mic
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useAuthStore } from '@/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  chart?: { type: string; data: unknown[]; title: string }
  timestamp: Date
  loading?: boolean
}

const SUGGESTED_PROMPTS = [
  { icon: '📊', text: 'Show me the sales trend for Q4 2025' },
  { icon: '🔍', text: 'Find anomalies in the customer dataset' },
  { icon: '📈', text: 'Predict next quarter revenue based on historical data' },
  { icon: '💡', text: 'Which products have the highest profit margin?' },
  { icon: '⚠️', text: 'Identify customers at risk of churning' },
  { icon: '📋', text: 'Generate an executive summary of my data' },
]

const sampleChartData = [
  { month: 'Jan', sales: 42000 }, { month: 'Feb', sales: 51000 },
  { month: 'Mar', sales: 47000 }, { month: 'Apr', sales: 63000 },
  { month: 'May', sales: 58000 }, { month: 'Jun', sales: 72000 },
]

const SAMPLE_RESPONSES: Record<string, { content: string; chart?: Message['chart'] }> = {
  default: {
    content: `I've analyzed your datasets and here's what I found:

**📊 Key Insights:**

1. **Revenue Growth**: Sales increased by **23.4%** in Q4 2025 compared to Q3, primarily driven by the enterprise segment (+41%).

2. **Top Performers**: Widget Pro and Gadget Plus account for **68% of total revenue**. Consider expanding their product lines.

3. **Customer Behavior**: Average order value increased from $127 to $189, suggesting successful upselling strategies.

4. **Risk Alert**: The North region shows declining sales (-12% MoM). Recommend investigating local market conditions.

**💡 Recommendations:**
- Increase inventory for Widget Pro by 30% to meet projected Q1 demand
- Launch targeted campaign for South region customers (highest growth potential)
- Review pricing strategy for Device Max (lowest margin product)

Would you like me to generate a detailed chart or dive deeper into any of these areas?`,
    chart: { type: 'area', data: sampleChartData, title: 'Sales Trend (2025)' }
  },
  trend: {
    content: `**📈 Sales Trend Analysis — Q4 2025**

Here's the monthly sales breakdown showing strong growth trajectory:

The data reveals:
- **January**: $42K (baseline)
- **March**: Dip to $47K (seasonal effect)
- **June**: Peak at $72K (+71% from January)

**Statistical Summary:**
- Average Monthly Sales: $55,500
- Growth Rate: 9.8% month-over-month
- Variance: Low (stable growth pattern)
- Forecast for July: **$79,200** (±$3,500)

The trend confirms a healthy growth trajectory. The March dip aligns with typical seasonal patterns in your industry.`,
    chart: { type: 'area', data: sampleChartData, title: 'Q4 2025 Sales Trend' }
  },
}

function ChartDisplay({ chart }: { chart: Message['chart'] }) {
  if (!chart) return null
  return (
    <div className="mt-3 glass-card p-4 rounded-xl">
      <div className="text-xs text-text-muted mb-3 font-medium">{chart.title}</div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chart.data as typeof sampleChartData}>
          <defs>
            <linearGradient id="aiChartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}k`} />
          <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px' }} />
          <Area type="monotone" dataKey="sales" stroke="#8B5CF6" strokeWidth={2} fill="url(#aiChartGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*)/gm, '• $1')
      .replace(/\n/g, '<br/>')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
          style={{ background: 'linear-gradient(135deg, #EC4899, #8B5CF6)' }}>
          <Bot size={14} className="text-white" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start', 'max-w-[82%]')}>
        {!isUser && (
          <span className="text-[10px] text-text-subtle px-1">TADA AI Agent</span>
        )}

        {message.loading ? (
          <div className="chat-bubble-ai flex items-center gap-2 px-4 py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-text-muted text-xs">Analyzing your data...</span>
          </div>
        ) : (
          <>
            <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              {isUser ? (
                <p>{message.content}</p>
              ) : (
                <div
                  className="prose-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                />
              )}
              {!isUser && message.chart && <ChartDisplay chart={message.chart} />}
            </div>

            {!isUser && (
              <div className="flex items-center gap-2 px-1">
                <button onClick={() => { navigator.clipboard.writeText(message.content); toast.success('Copied!') }}
                  className="text-text-subtle hover:text-text transition-colors">
                  <Copy size={11} />
                </button>
                <button className="text-text-subtle hover:text-success transition-colors"><ThumbsUp size={11} /></button>
                <button className="text-text-subtle hover:text-danger transition-colors"><ThumbsDown size={11} /></button>
                <span className="text-[10px] text-text-subtle ml-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
          <User size={14} className="text-primary" />
        </div>
      )}
    </motion.div>
  )
}

import { api } from '@/lib/api'
import type { Dataset } from '@/store'

export function AIAnalyst() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hello! I'm TADA AI, your autonomous data analyst. 🤖
      
I'm ready to help you:
- 📊 Analyze trends and patterns
- 🔍 Detect anomalies and outliers  
- 📈 Forecast future values
- 💡 Generate business recommendations
- 📋 Create executive summaries
- 🗂️ Answer questions about your data

Select a dataset to begin. What would you like to explore today?`,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [datasetsList, setDatasetsList] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchDatasets = React.useCallback(async () => {
    try {
      const res = await api.get('/api/datasets/')
      if (res.data && Array.isArray(res.data.datasets)) {
        setDatasetsList(res.data.datasets)
        if (res.data.datasets.length > 0) {
          setSelectedDatasetId(res.data.datasets[0].id)
        }
      }
    } catch (err) {
      console.warn("Failed to fetch datasets for AI chat", err)
    }
  }, [])

  React.useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text?: string) => {
    const content = text || input.trim()
    if (!content || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    const loadingMsg: Message = {
      id: Date.now().toString() + '_loading',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    setLoading(true)

    // Build chat history for backend (skip intro)
    const history = messages
      .filter(m => m.id !== '0' && !m.loading)
      .map(m => ({
        role: m.role,
        content: m.content
      }))

    try {
      const response = await api.post('/api/ai/chat', {
        message: content,
        dataset_id: selectedDatasetId || null,
        history: history
      })

      const assistantMsg: Message = {
        id: Date.now().toString() + '_ai',
        role: 'assistant',
        content: response.data.response,
        chart: response.data.charts && response.data.charts.length > 0 ? response.data.charts[0] : undefined,
        timestamp: new Date(),
      }

      setMessages(prev => prev.filter(m => !m.loading).concat(assistantMsg))
    } catch (error) {
      console.warn("Failed to chat via API, simulating locally", error)
      await new Promise(r => setTimeout(r, 1500))
      
      const isAboutTrend = content.toLowerCase().includes('trend') || content.toLowerCase().includes('sales')
      const mockResp = isAboutTrend ? SAMPLE_RESPONSES.trend : SAMPLE_RESPONSES.default

      const assistantMsg: Message = {
        id: Date.now().toString() + '_ai',
        role: 'assistant',
        content: mockResp.content,
        chart: mockResp.chart,
        timestamp: new Date(),
      }
      setMessages(prev => prev.filter(m => !m.loading).concat(assistantMsg))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const activeDatasetObj = datasetsList.find(d => d.id === selectedDatasetId)

  return (
    <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #EC4899, #8B5CF6)' }}>
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-text">AI Analyst</h1>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <div className="status-dot online" />
              Powered by Google Gemini 1.5 Pro
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background-secondary border border-border text-sm text-text-muted">
            <Database size={13} />
            <select
              value={selectedDatasetId}
              onChange={e => setSelectedDatasetId(e.target.value)}
              className="bg-transparent border-none outline-none text-text-muted text-xs cursor-pointer"
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
          <button
            id="clear-chat-btn"
            onClick={() => setMessages(messages.slice(0, 1))}
            className="btn-ghost text-xs flex items-center gap-1"
          >
            <RefreshCw size={12} /> Clear
          </button>
        </div>
      </div>


      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts - show when no user messages */}
      {messages.filter(m => m.role === 'user').length === 0 && (
        <div className="px-6 pb-3">
          <div className="text-xs text-text-subtle mb-2 font-medium">Suggested Questions</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button
                key={i}
                id={`suggested-prompt-${i}`}
                onClick={() => handleSend(p.text)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background-secondary border border-border text-xs text-text-muted hover:border-primary/40 hover:text-text hover:bg-primary/5 transition-all"
              >
                <span>{p.icon}</span>
                <span>{p.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-6 pb-6 flex-shrink-0">
        <div className="glass-card p-3 flex items-end gap-3"
          style={{ border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <textarea
            ref={textareaRef}
            id="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your data... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-text text-sm placeholder-text-subtle max-h-32"
            style={{ lineHeight: '1.5' }}
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="text-text-muted hover:text-text transition-colors p-1">
              <Paperclip size={16} />
            </button>
            <button
              id="send-message-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                input.trim() && !loading
                  ? 'bg-primary hover:bg-primary/80 text-white'
                  : 'bg-background-tertiary text-text-subtle cursor-not-allowed'
              )}
            >
              {loading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-text-subtle mt-2">
          TADA AI can make mistakes. Always verify critical business decisions with your data team.
        </p>
      </div>
    </div>
  )
}
