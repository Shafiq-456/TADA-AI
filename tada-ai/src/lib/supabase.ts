/**
 * TADA AI - Local Email & Password Authentication Client
 * Connects directly to FastAPI backend auth routes.
 */

import { User, Session } from '@supabase/supabase-js'

const TOKEN_KEY = 'tada_jwt_token'
const PROFILE_KEY = 'tada_user_profile'
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

type AuthChangeCallback = (event: string, session: Session | null) => void
const listeners: AuthChangeCallback[] = []

function notifyListeners(event: string, session: Session | null) {
  listeners.forEach((cb) => cb(event, session))
}

function buildSession(token: string, dbUser: any): Session {
  const user: User = {
    id: dbUser.id,
    email: dbUser.email,
    created_at: dbUser.created_at,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {
      full_name: dbUser.full_name,
      name: dbUser.full_name,
      avatar_url: dbUser.avatar_url,
    },
    updated_at: new Date().toISOString(),
  }

  return {
    access_token: token,
    refresh_token: 'local-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() + 3600 * 1000,
    token_type: 'bearer',
    user,
  }
}

export const supabase = {
  auth: {
    getSession: async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY)
        const profileRaw = localStorage.getItem(PROFILE_KEY)
        if (token && profileRaw) {
          const profile = JSON.parse(profileRaw)
          const session = buildSession(token, profile)
          return { data: { session }, error: null }
        }
      } catch (_) { /* ignore */ }
      return { data: { session: null }, error: null }
    },

    signInWithGoogle: async (credential: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/google/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential })
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || 'Google Login failed')
        }

        const data = await res.json()
        localStorage.setItem(TOKEN_KEY, data.access_token)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data.user))

        const session = buildSession(data.access_token, data.user)
        notifyListeners('SIGNED_IN', session)
        return { data: { session, user: session.user }, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    },

    signInWithGitHub: async (code: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/github/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || 'GitHub Login failed')
        }

        const data = await res.json()
        localStorage.setItem(TOKEN_KEY, data.access_token)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data.user))

        const session = buildSession(data.access_token, data.user)
        notifyListeners('SIGNED_IN', session)
        return { data: { session, user: session.user }, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    },

    signInWithPassword: async (creds: { email: string; password: string }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: creds.email,
            password: creds.password
          })
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || 'Login failed')
        }

        const data = await res.json()
        localStorage.setItem(TOKEN_KEY, data.access_token)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data.user))

        const session = buildSession(data.access_token, data.user)
        notifyListeners('SIGNED_IN', session)
        return { data: { session, user: session.user }, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    },

    signUp: async (creds: { email: string; password: string; options?: { data?: { full_name?: string } } }) => {
      try {
        const fullName = creds.options?.data?.full_name || creds.email.split('@')[0]
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: creds.email,
            password: creds.password,
            full_name: fullName
          })
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || 'Registration failed')
        }

        const data = await res.json()
        localStorage.setItem(TOKEN_KEY, data.access_token)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data.user))

        const session = buildSession(data.access_token, data.user)
        notifyListeners('SIGNED_IN', session)
        return { data: { session, user: session.user }, error: null }
      } catch (err: any) {
        return { data: null, error: err }
      }
    },

    signOut: async () => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(PROFILE_KEY)
      notifyListeners('SIGNED_OUT', null)
      return { error: null }
    },

    onAuthStateChange: (callback: AuthChangeCallback) => {
      listeners.push(callback)

      // Immediately run callback with current session if available
      try {
        const token = localStorage.getItem(TOKEN_KEY)
        const profileRaw = localStorage.getItem(PROFILE_KEY)
        if (token && profileRaw) {
          const profile = JSON.parse(profileRaw)
          const session = buildSession(token, profile)
          callback('SIGNED_IN', session)
        } else {
          callback('SIGNED_OUT', null)
        }
      } catch (_) { /* ignore */ }

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = listeners.indexOf(callback)
              if (idx >= 0) listeners.splice(idx, 1)
            },
          },
        },
      }
    },
  },
}
