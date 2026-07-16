import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { api } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Pages
import { LandingPage } from '@/pages/LandingPage'
import { AuthCallback } from '@/pages/AuthCallback'
import { Dashboard } from '@/pages/Dashboard'
import { Datasets } from '@/pages/Datasets'
import { DatasetDetail } from '@/pages/DatasetDetail'
import { DataCleaning } from '@/pages/DataCleaning'
import { Analytics } from '@/pages/Analytics'
import { Visualizations } from '@/pages/Visualizations'
import { Forecasting } from '@/pages/Forecasting'
import { AIAnalyst } from '@/pages/AIAnalyst'
import { ExecutiveInsights } from '@/pages/ExecutiveInsights'
import { Reports } from '@/pages/Reports'
import { ProfilePage } from '@/pages/Profile'
import { Settings } from '@/pages/Settings'
import { AutoDashboard } from '@/pages/AutoDashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

function App() {
  const { setSession, setDbUser, setLoading } = useAuthStore()

  useEffect(() => {
    const fetchProfile = async (session: any) => {
      if (session) {
        try {
          const res = await api.get('/api/users/me')
          setDbUser(res.data)
        } catch (_) {
          setDbUser(null)
        }
      } else {
        setDbUser(null)
      }
    }

    // Initialize auth state
    ;(supabase.auth as any).getSession().then(async ({ data: { session } }: any) => {
      setSession(session as any)
      await fetchProfile(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (_event: string, session: any) => {
      setSession(session as any)
      await fetchProfile(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setSession, setDbUser, setLoading])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AnimatePresence mode="wait">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected routes - wrapped in AppShell */}
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/auto-dashboard" element={<AutoDashboard />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/datasets/:id" element={<DatasetDetail />} />
              <Route path="/cleaning" element={<DataCleaning />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/visualizations" element={<Visualizations />} />
              <Route path="/forecasting" element={<Forecasting />} />
              <Route path="/ai-analyst" element={<AIAnalyst />} />
              <Route path="/insights" element={<ExecutiveInsights />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0F172A',
              color: '#F8FAFC',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#0F172A' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#0F172A' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
