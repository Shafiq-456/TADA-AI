import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, Shield, Palette, Key, User, ChevronRight, CheckCircle2,
  Download, Trash2, AlertTriangle, Eye, EyeOff,
} from 'lucide-react'
import { useUIStore, useSettingsStore, useAuthStore } from '@/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

type SettingsSection = 'appearance' | 'notifications' | 'privacy' | 'api' | 'account'

const sections: { id: SettingsSection; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'appearance', icon: Palette, label: 'Appearance', desc: 'Theme, layout, and display settings' },
  { id: 'notifications', icon: Bell, label: 'Notifications', desc: 'Email and in-app notification preferences' },
  { id: 'privacy', icon: Shield, label: 'Privacy & Security', desc: 'Data sharing and security settings' },
  { id: 'api', icon: Key, label: 'API Configuration', desc: 'API keys and model settings' },
  { id: 'account', icon: User, label: 'Account Management', desc: 'Account details and data management' },
]

export function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')
  const { theme, toggleTheme } = useUIStore()
  const { notifications, model, geminiApiKey, backendUrl, updateSettings } = useSettingsStore()
  const { dbUser, setDbUser } = useAuthStore()
  const [localNotifications, setLocalNotifications] = useState(notifications)
  const [localModel, setLocalModel] = useState(model)
  const [localApiKey, setLocalApiKey] = useState(geminiApiKey)
  const [localBackendUrl, setLocalBackendUrl] = useState(backendUrl)
  const [localFullName, setLocalFullName] = useState(dbUser?.full_name || '')
  const [showKey, setShowKey] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (dbUser?.full_name) {
      setLocalFullName(dbUser.full_name)
    }
  }, [dbUser])

  const handleSave = async () => {
    updateSettings({
      notifications: localNotifications,
      model: localModel,
      geminiApiKey: localApiKey,
      backendUrl: localBackendUrl,
    })

    if (activeSection === 'account') {
      try {
        const res = await api.patch('/api/users/me', { full_name: localFullName })
        if (dbUser) {
          setDbUser({ ...dbUser, full_name: res.data.full_name })
        }
        toast.success('Profile and settings updated successfully!')
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || 'Failed to update profile name')
      }
    } else {
      toast.success('Settings saved successfully!')
    }
  }

  const handleExportData = async () => {
    try {
      const [datasetsRes, reportsRes] = await Promise.all([
        api.get('/api/datasets/'),
        api.get('/api/reports/'),
      ])
      const exportData = {
        exported_at: new Date().toISOString(),
        datasets: datasetsRes.data?.datasets ?? [],
        reports: reportsRes.data ?? [],
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tada_export_${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully!')
    } catch {
      toast.error('Failed to export data')
    }
  }

  const handleDownloadLogs = async () => {
    try {
      const res = await api.get('/api/users/me')
      const logs = res.data?.activity_timeline ?? []
      const text = logs.map((l: any) => `[${l.time}] ${l.icon} ${l.text}`).join('\n')
      const blob = new Blob([text || 'No activity logs found.'], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tada_activity_logs_${Date.now()}.txt`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Activity logs downloaded!')
    } catch {
      toast.error('Failed to download logs')
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      toast('Click "Delete Account" again to confirm. This cannot be undone.', {
        icon: '⚠️',
        duration: 5000,
      })
      setTimeout(() => setDeleteConfirm(false), 6000)
      return
    }
    try {
      await supabase.auth.signOut()
      localStorage.clear()
      toast.success('Account signed out. Contact support to fully delete your data.')
      navigate('/')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="mb-6">
        <h1 className="section-header">Settings</h1>
        <p className="section-subheader">Manage your preferences and account configuration</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="col-span-1 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              id={`settings-nav-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                activeSection === section.id
                  ? 'bg-primary/10 border border-primary/20 text-text'
                  : 'hover:bg-white/5 text-text-muted'
              )}
            >
              <section.icon size={16} className={activeSection === section.id ? 'text-primary' : 'text-text-muted'} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{section.label}</div>
              </div>
              <ChevronRight size={13} className="opacity-40" />
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="col-span-2">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-card p-6 space-y-5"
          >
            {/* ---- APPEARANCE ---- */}
            {activeSection === 'appearance' && (
              <>
                <div>
                  <h3 className="font-semibold text-text mb-4">Theme</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'dark', label: 'Dark Mode', desc: 'Default enterprise theme' },
                      { id: 'light', label: 'Light Mode', desc: 'High contrast light theme' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        id={`theme-${t.id}`}
                        onClick={toggleTheme}
                        className={cn(
                          'p-4 rounded-xl border text-left transition-all',
                          theme === t.id ? 'border-primary bg-primary/10' : 'border-border hover:border-border-light'
                        )}
                      >
                        <div
                          className="w-full h-12 rounded-lg mb-3 border border-border"
                          style={{
                            background:
                              t.id === 'dark'
                                ? 'linear-gradient(135deg, #020617, #0F172A)'
                                : 'linear-gradient(135deg, #F8FAFC, #E2E8F0)',
                          }}
                        />
                        <div className="text-sm font-medium text-text">{t.label}</div>
                        <div className="text-xs text-text-muted">{t.desc}</div>
                        {theme === t.id && <CheckCircle2 size={14} className="text-primary mt-2" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ---- NOTIFICATIONS ---- */}
            {activeSection === 'notifications' && (
              <>
                <h3 className="font-semibold text-text mb-4">Notification Preferences</h3>
                {(
                  [
                    { key: 'email' as const, label: 'Email Notifications', desc: 'Receive analysis results via email' },
                    { key: 'analysis' as const, label: 'Analysis Completion', desc: 'Notify when analysis jobs complete' },
                    { key: 'reports' as const, label: 'Report Ready', desc: 'Notify when reports are generated' },
                    { key: 'insights' as const, label: 'AI Insight Alerts', desc: 'Get notified about new AI insights' },
                  ] as const
                ).map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <div className="font-medium text-text text-sm">{item.label}</div>
                      <div className="text-text-muted text-xs mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      onClick={() => setLocalNotifications((p) => ({ ...p, [item.key]: !p[item.key] }))}
                      id={`notif-${item.key}`}
                      className={cn(
                        'relative w-10 h-5 rounded-full transition-all duration-300',
                        localNotifications[item.key] ? 'bg-primary' : 'bg-background-tertiary border border-border'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          localNotifications[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ---- API CONFIGURATION ---- */}
            {activeSection === 'api' && (
              <>
                <h3 className="font-semibold text-text mb-4">API Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">AI Model</label>
                    <select
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      className="input-field text-sm py-2 w-full"
                    >
                      <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Recommended)</option>
                      <option value="gemini-2.0-flash">Google Gemini 2.0 Flash</option>
                      <option value="gpt-4">OpenAI GPT-4</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">Gemini API Key</label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        placeholder="AIza..."
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        className="input-field text-sm py-2 pr-10 w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                      >
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p className="text-text-subtle text-[10px] mt-1">Stored locally in your browser — never sent to any server</p>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">Backend API URL</label>
                    <input
                      type="text"
                      value={localBackendUrl}
                      onChange={(e) => setLocalBackendUrl(e.target.value)}
                      className="input-field text-sm py-2 font-mono w-full"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ---- PRIVACY ---- */}
            {activeSection === 'privacy' && (
              <>
                <h3 className="font-semibold text-text mb-4">Privacy & Security</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Data Analytics', desc: 'Allow anonymous usage data collection to improve TADA AI' },
                    { label: 'Dataset Encryption', desc: 'Encrypt all uploaded datasets at rest' },
                    { label: 'Secure Sessions', desc: 'Automatically sign out after 24 hours of inactivity' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div>
                        <div className="font-medium text-text text-sm">{item.label}</div>
                        <div className="text-text-muted text-xs mt-0.5">{item.desc}</div>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ---- ACCOUNT MANAGEMENT ---- */}
            {activeSection === 'account' && (
              <>
                <h3 className="font-semibold text-text mb-4">Account Management</h3>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">Display Name</label>
                    <input
                      type="text"
                      value={localFullName}
                      onChange={(e) => setLocalFullName(e.target.value)}
                      className="input-field text-sm py-2 w-full"
                      placeholder="Your Full Name"
                    />
                  </div>
                </div>
                <div className="divider mb-4" />
                <div className="space-y-3">
                  <button
                    id="export-data-btn"
                    onClick={handleExportData}
                    className="w-full btn-secondary text-sm py-3 justify-center flex items-center gap-2"
                  >
                    <Download size={14} /> Export All My Data
                  </button>
                  <button
                    id="download-logs-btn"
                    onClick={handleDownloadLogs}
                    className="w-full btn-secondary text-sm py-3 justify-center flex items-center gap-2"
                  >
                    <Download size={14} /> Download Activity Logs
                  </button>
                  <div className="divider" />
                  <button
                    id="delete-account-btn"
                    onClick={handleDeleteAccount}
                    className={cn(
                      'w-full text-sm py-3 justify-center flex items-center gap-2 rounded-xl border transition-all',
                      deleteConfirm
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'btn-danger'
                    )}
                  >
                    {deleteConfirm ? <AlertTriangle size={14} /> : <Trash2 size={14} />}
                    {deleteConfirm ? 'Click again to CONFIRM deletion' : 'Delete Account & All Data'}
                  </button>
                  {deleteConfirm && (
                    <p className="text-red-400 text-xs text-center">
                      ⚠️ This will sign you out immediately. All data deletion requires contacting support.
                    </p>
                  )}
                </div>
              </>
            )}

            <button id="save-settings-btn" onClick={handleSave} className="btn-primary w-full justify-center py-3 mt-2">
              Save Changes
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
