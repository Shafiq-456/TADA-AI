import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (data.session) {
          toast.success(`Welcome, ${data.session.user.user_metadata?.full_name || 'User'}! 🎉`)
          navigate('/dashboard', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } catch (error) {
        toast.error('Authentication failed. Please try again.')
        navigate('/', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xl">⚡</span>
          </div>
        </div>
        <div className="text-text font-medium">Completing sign-in...</div>
        <div className="text-text-muted text-sm">Setting up your workspace</div>
      </motion.div>
    </div>
  )
}
