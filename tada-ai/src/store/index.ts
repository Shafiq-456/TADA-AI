import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'

// Auth Store
interface AuthState {
  user: User | null
  session: Session | null
  dbUser: { full_name: string; email: string; avatar_url: string | null } | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setDbUser: (dbUser: { full_name: string; email: string; avatar_url: string | null } | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  dbUser: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setDbUser: (dbUser) => set({ dbUser }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, session: null, dbUser: null }),
}))

// UI Store
interface UIState {
  sidebarCollapsed: boolean
  theme: 'dark' | 'light'
  activeDatasetId: string | null
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleTheme: () => void
  setActiveDataset: (id: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'dark',
      activeDatasetId: null,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setActiveDataset: (id) => set({ activeDatasetId: id }),
    }),
    {
      name: 'tada-ui-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// Dataset Store
export interface DatasetColumn {
  name: string
  type: string
  null_count: number
  null_pct?: number
  unique_count: number
  unique_pct?: number
  sample_values: unknown[]
}

export interface Dataset {
  id: string
  user_id: string
  name: string
  description: string | null
  file_path: string
  file_size: number
  file_type: string
  row_count: number | null
  column_count: number | null
  columns: DatasetColumn[] | null
  status: 'uploaded' | 'processing' | 'ready' | 'error'
  quality_score: number | null
  missing_values?: number
  duplicate_rows?: number
  error?: string
  created_at: string
  updated_at: string
}

interface DatasetState {
  datasets: Dataset[]
  activeDataset: Dataset | null
  setDatasets: (datasets: Dataset[]) => void
  addDataset: (dataset: Dataset) => void
  updateDataset: (id: string, updates: Partial<Dataset>) => void
  removeDataset: (id: string) => void
  setActiveDataset: (dataset: Dataset | null) => void
}

export const useDatasetStore = create<DatasetState>((set) => ({
  datasets: [],
  activeDataset: null,
  setDatasets: (datasets) => set({ datasets }),
  addDataset: (dataset) => set((state) => ({ datasets: [dataset, ...state.datasets] })),
  updateDataset: (id, updates) =>
    set((state) => ({
      datasets: state.datasets.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      activeDataset: state.activeDataset?.id === id ? { ...state.activeDataset, ...updates } : state.activeDataset,
    })),
  removeDataset: (id) =>
    set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
  setActiveDataset: (dataset) => set({ activeDataset: dataset }),
}))

// Notification Store
export interface AppNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
}

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'created_at'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => {
      const newNotif: AppNotification = {
        ...notification,
        id: Math.random().toString(36).substr(2, 9),
        read: false,
        created_at: new Date().toISOString(),
      }
      const updated = [newNotif, ...state.notifications]
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length }
    }),
  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length }
    }),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))

// App Settings Store
export interface AppSettings {
  notifications: { email: boolean; analysis: boolean; reports: boolean; insights: boolean }
  model: string
  geminiApiKey: string
  backendUrl: string
}

interface SettingsState extends AppSettings {
  updateSettings: (updates: Partial<AppSettings>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifications: { email: true, analysis: true, reports: true, insights: false },
      model: 'gemini-1.5-pro',
      geminiApiKey: '',
      backendUrl: 'http://localhost:8000',
      updateSettings: (updates) => set((state) => ({ ...state, ...updates })),
    }),
    {
      name: 'tada-app-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
