import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Bell, Shield, Palette, Key, User, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

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
  const [notifications, setNotifications] = useState({ email: true, analysis: true, reports: true, insights: false })
  const [model, setModel] = useState('gemini-1.5-pro')

  const handleSave = () => toast.success('Settings saved successfully!')

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
            <button key={section.id} id={`settings-nav-${section.id}`} onClick={() => setActiveSection(section.id)}
              className={cn('w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                activeSection === section.id ? 'bg-primary/10 border border-primary/20 text-text' : 'hover:bg-white/5 text-text-muted'
              )}>
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
          <motion.div key={activeSection} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }} className="glass-card p-6 space-y-5">

            {activeSection === 'appearance' && (
              <>
                <div>
                  <h3 className="font-semibold text-text mb-4">Theme</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'dark', label: 'Dark Mode', desc: 'Default enterprise theme', preview: '#020617' },
                      { id: 'light', label: 'Light Mode', desc: 'High contrast light theme', preview: '#F8FAFC' },
                    ].map((t) => (
                      <button key={t.id} id={`theme-${t.id}`} onClick={toggleTheme}
                        className={cn('p-4 rounded-xl border text-left transition-all',
                          (theme === t.id) ? 'border-primary bg-primary/10' : 'border-border hover:border-border-light'
                        )}>
                        <div className="w-full h-12 rounded-lg mb-3 border border-border"
                          style={{ background: t.id === 'dark' ? 'linear-gradient(135deg, #020617, #0F172A)' : 'linear-gradient(135deg, #F8FAFC, #E2E8F0)' }} />
                        <div className="text-sm font-medium text-text">{t.label}</div>
                        <div className="text-xs text-text-muted">{t.desc}</div>
                        {theme === t.id && <CheckCircle2 size={14} className="text-primary mt-2" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeSection === 'notifications' && (
              <>
                <h3 className="font-semibold text-text mb-4">Notification Preferences</h3>
                {[
                  { key: 'email' as const, label: 'Email Notifications', desc: 'Receive analysis results via email' },
                  { key: 'analysis' as const, label: 'Analysis Completion', desc: 'Notify when analysis jobs complete' },
                  { key: 'reports' as const, label: 'Report Ready', desc: 'Notify when reports are generated' },
                  { key: 'insights' as const, label: 'AI Insight Alerts', desc: 'Get notified about new AI insights' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <div className="font-medium text-text text-sm">{item.label}</div>
                      <div className="text-text-muted text-xs mt-0.5">{item.desc}</div>
                    </div>
                    <button onClick={() => setNotifications(p => ({ ...p, [item.key]: !p[item.key] }))}
                      id={`notif-${item.key}`}
                      className={cn('relative w-10 h-5 rounded-full transition-all duration-300',
                        notifications[item.key] ? 'bg-primary' : 'bg-background-tertiary border border-border'
                      )}>
                      <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        notifications[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                ))}
              </>
            )}

            {activeSection === 'api' && (
              <>
                <h3 className="font-semibold text-text mb-4">API Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">AI Model</label>
                    <select value={model} onChange={e => setModel(e.target.value)} className="input-field text-sm py-2 w-full">
                      <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Recommended)</option>
                      <option value="gemini-2.0-flash">Google Gemini 2.0 Flash</option>
                      <option value="gpt-4">OpenAI GPT-4</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">Gemini API Key</label>
                    <input type="password" placeholder="AIza..." className="input-field text-sm py-2" />
                    <p className="text-text-subtle text-[10px] mt-1">Your API key is stored securely and never shared</p>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block">Backend API URL</label>
                    <input type="text" defaultValue="http://localhost:8000" className="input-field text-sm py-2 font-mono" />
                  </div>
                </div>
              </>
            )}

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

            {activeSection === 'account' && (
              <>
                <h3 className="font-semibold text-text mb-4">Account Management</h3>
                <div className="space-y-3">
                  <button className="w-full btn-secondary text-sm py-3 justify-center">Export All My Data</button>
                  <button className="w-full btn-secondary text-sm py-3 justify-center">Download Activity Logs</button>
                  <div className="divider" />
                  <button className="w-full btn-danger text-sm py-3 justify-center">Delete Account & All Data</button>
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
