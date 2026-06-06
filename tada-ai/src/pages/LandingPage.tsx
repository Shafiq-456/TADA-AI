import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion'
import {
  Zap, BarChart3, Bot, TrendingUp, ArrowRight,
  Database, Lightbulb, Sparkles, Play, Check,
  Brain, X, User, Mail, LogIn, Key
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import toast from 'react-hot-toast'
import { TiltContainer } from '@/components/layout/TiltContainer'

const features = [
  {
    icon: Database,
    title: 'Smart Dataset Management',
    color: '#8B5CF6',
    gradient: 'from-purple-600/20 to-purple-900/10',
    desc: 'Upload CSV, Excel, or JSON files. Auto-detect schema, types, and data quality issues instantly.',
  },
  {
    icon: Zap,
    title: 'Auto Data Cleaning',
    color: '#EC4899',
    gradient: 'from-pink-600/20 to-pink-900/10',
    desc: 'Automatically detect missing values, outliers, duplicates, and format issues. One-click cleaning.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    color: '#06B6D4',
    gradient: 'from-cyan-600/20 to-cyan-900/10',
    desc: 'Descriptive, diagnostic, and predictive analytics with KPIs, correlations, and anomaly detection.',
  },
  {
    icon: Bot,
    title: 'AI Analyst Chat',
    color: '#10B981',
    gradient: 'from-emerald-600/20 to-emerald-900/10',
    desc: 'Ask questions in plain English. Get instant insights, charts, and recommendations from your data.',
  },
  {
    icon: TrendingUp,
    title: 'ML Forecasting',
    color: '#F59E0B',
    gradient: 'from-amber-600/20 to-amber-900/10',
    desc: 'Prophet, XGBoost, and Random Forest models for revenue, sales, and demand forecasting.',
  },
  {
    icon: Lightbulb,
    title: 'Executive Insights',
    color: '#8B5CF6',
    gradient: 'from-purple-600/20 to-purple-900/10',
    desc: 'AI-generated SWOT analysis, strategic recommendations, and board-ready executive summaries.',
  },
]

const stats = [
  { value: '10x', label: 'Faster Analysis' },
  { value: '99%', label: 'Accuracy Rate' },
  { value: '50+', label: 'Chart Types' },
  { value: '6', label: 'AI Agents' },
]

const agents = [
  { icon: '🧹', name: 'Cleaning Agent', desc: 'Preprocesses your data automatically' },
  { icon: '📊', name: 'Analytics Agent', desc: 'Generates statistical insights' },
  { icon: '📈', name: 'Visualization Agent', desc: 'Creates interactive charts' },
  { icon: '🔮', name: 'Forecast Agent', desc: 'Predicts future trends' },
  { icon: '💼', name: 'Exec Insight Agent', desc: 'Generates business recommendations' },
  { icon: '📄', name: 'Report Agent', desc: 'Creates professional reports' },
]

// TiltContainer is imported from shared layout components


function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <TiltContainer className="glass-card-hover p-6 group h-full">
        <div style={{ transform: 'translateZ(20px)' }} className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <feature.icon size={20} style={{ color: feature.color }} />
        </div>
        <h3 style={{ transform: 'translateZ(10px)' }} className="font-semibold text-text mb-2 text-base">{feature.title}</h3>
        <p style={{ transform: 'translateZ(5px)' }} className="text-text-muted text-sm leading-relaxed">{feature.desc}</p>
      </TiltContainer>
    </motion.div>
  )
}

// ---- Demo Login Modal ----
function DemoLoginModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (activeTab === 'register' && !name.trim()) {
      newErrors.name = 'Full name is required'
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (activeTab === 'register') {
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      if (activeTab === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast.success(`Welcome back, ${data.session?.user?.user_metadata?.full_name || 'User'}! 🎉`)
        onClose()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        })
        if (error) throw error
        toast.success('Account created successfully! Welcome to TADA AI! 🚀')
        onClose()
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAutofillDemo = () => {
    setEmail('demo@tadaai.app')
    setPassword('demo123')
    setErrors({})
    toast.success('Demo credentials autofilled!')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-[24px] p-8 relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-text-muted hover:text-text transition-colors">
          <X size={20} />
        </button>

        {/* Header Title */}
        <h2 className="text-3xl font-extrabold text-center text-white mb-2 tracking-tight">
          Welcome!
        </h2>
        <p className="text-text-muted text-xs text-center mb-6">
          Access the TADA AI Data Intelligence Platform
        </p>

        {/* Tabs */}
        <div className="flex justify-center border-b border-white/10 mb-6 relative">
          <button
            onClick={() => {
              setActiveTab('signin')
              setErrors({})
            }}
            className={`px-6 py-2.5 font-semibold text-sm transition-colors relative ${
              activeTab === 'signin' ? 'text-white' : 'text-text-muted hover:text-white'
            }`}
          >
            Sign In
            {activeTab === 'signin' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-full"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('register')
              setErrors({})
            }}
            className={`px-6 py-2.5 font-semibold text-sm transition-colors relative ${
              activeTab === 'register' ? 'text-white' : 'text-text-muted hover:text-white'
            }`}
          >
            Register
            {activeTab === 'register' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-full"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAction} className="space-y-4">
          {activeTab === 'register' && (
            <div>
              <label className="text-text-muted text-xs font-medium mb-1 block">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-full border bg-white/5 text-white text-sm focus:outline-none transition-colors ${
                    errors.name ? 'border-danger focus:border-danger' : 'border-white/10 focus:border-primary/50'
                  }`}
                />
              </div>
              {errors.name && <p className="text-danger text-[10px] mt-1 ml-3">{errors.name}</p>}
            </div>
          )}

          <div>
            <label className="text-text-muted text-xs font-medium mb-1 block">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-full border bg-white/5 text-white text-sm focus:outline-none transition-colors ${
                  errors.email ? 'border-danger focus:border-danger' : 'border-white/10 focus:border-primary/50'
                  }`}
              />
            </div>
            {errors.email && <p className="text-danger text-[10px] mt-1 ml-3">{errors.email}</p>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-text-muted text-xs font-medium block">Password</label>
              {activeTab === 'signin' && (
                <button
                  type="button"
                  onClick={() => toast.error('Password reset is not enabled for local testing.')}
                  className="text-primary text-[10px] hover:underline"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-2.5 rounded-full border bg-white/5 text-white text-sm focus:outline-none transition-colors ${
                  errors.password ? 'border-danger focus:border-danger' : 'border-white/10 focus:border-primary/50'
                  }`}
              />
            </div>
            {errors.password && <p className="text-danger text-[10px] mt-1 ml-3">{errors.password}</p>}
          </div>

          {activeTab === 'register' && (
            <div>
              <label className="text-text-muted text-xs font-medium mb-1 block">Confirm Password</label>
              <div className="relative">
                <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-full border bg-white/5 text-white text-sm focus:outline-none transition-colors ${
                    errors.confirmPassword ? 'border-danger focus:border-danger' : 'border-white/10 focus:border-primary/50'
                    }`}
                />
              </div>
              {errors.confirmPassword && <p className="text-danger text-[10px] mt-1 ml-3">{errors.confirmPassword}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : activeTab === 'signin' ? (
              <>
                <LogIn size={16} />
                Login
              </>
            ) : (
              <>
                <User size={16} />
                Create Account
              </>
            )}
          </button>
        </form>

        {activeTab === 'signin' && (
          <div className="text-center mt-3">
            <button
              onClick={handleAutofillDemo}
              className="text-xs text-primary/80 hover:text-primary transition-colors font-medium hover:underline"
            >
              ⚡ Autofill Demo Credentials
            </button>
          </div>
        )}

        <div className="divider my-6 text-[10px] text-text-subtle">OR</div>

        {/* Optional Google login (disabled for local testing) */}
        <div className="relative group flex justify-center">
          <button
            disabled
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 border border-slate-700/50 rounded-full bg-slate-800/40 text-slate-400 font-bold text-xs shadow-sm cursor-not-allowed"
          >
            <svg className="w-4 h-4 flex-shrink-0 opacity-50" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Sign in with Google (Disabled in Dev)</span>
          </button>
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-[10px] text-text-muted px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md">
            Google OAuth is disabled in local development
          </div>
        </div>

        <p className="text-center text-text-subtle text-[10px] mt-6">
          All user data is stored securely in your local PostgreSQL database
        </p>
      </motion.div>
    </motion.div>
  )
}

export function LandingPage() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuthStore()
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, -80])
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0])
  const mockupRotateX = useTransform(scrollY, [0, 600], [12, 0])
  const mockupTranslateY = useTransform(scrollY, [0, 600], [40, -40])
  const mockupScale = useTransform(scrollY, [0, 600], [0.95, 1.02])
  const [showModal, setShowModal] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard')
    }
  }, [user, isLoading, navigate])

  // Listen for supabase mock event
  useEffect(() => {
    const handler = () => setShowModal(true)
    window.addEventListener('tada:show-demo-login', handler)
    return () => window.removeEventListener('tada:show-demo-login', handler)
  }, [])

  const handleGoogleSignIn = () => setShowModal(true)

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <AnimatePresence>
        {showModal && <DemoLoginModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse-slow"
          style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -right-40 w-80 h-80 rounded-full opacity-15 blur-3xl animate-pulse-slow"
          style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 70%)', animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full opacity-10 blur-3xl animate-pulse-slow"
          style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)', animationDelay: '2s' }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ backdropFilter: 'blur(20px)', background: 'rgba(5, 5, 10, 0.8)' }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="TADA AI Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-text text-lg tracking-tight">TADA AI</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-text-muted text-sm hidden md:block">
            Enterprise Data Intelligence Platform
          </span>
          <button
            id="nav-signin-btn"
            onClick={handleGoogleSignIn}
            className="btn-primary text-sm px-4 py-2"
          >
            Get Started <ArrowRight size={14} />
          </button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-8"
          >
            <Sparkles size={12} />
            Powered by Google Gemini AI
            <Sparkles size={12} />
          </motion.div>

          {/* Main title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-6xl md:text-8xl font-black tracking-tighter mb-4 leading-none"
          >
            <span className="text-gradient">TADA</span>
            <span className="text-text"> AI</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-3xl font-semibold text-text-muted mb-6 max-w-3xl mx-auto"
          >
            Autonomous Data Analyst &amp;
            <span className="text-text"> Business Intelligence Agent</span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-text-muted text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Upload datasets, discover insights, forecast trends, generate executive reports,
            and interact with AI-powered data analysts — all in one platform.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <button
              id="hero-google-signin-btn"
              onClick={handleGoogleSignIn}
              className="btn-primary text-base px-8 py-4 group relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #BE185D)' }} />
              <div className="relative flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="rgba(255,255,255,0.7)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              id="hero-demo-btn"
              onClick={handleGoogleSignIn}
              className="btn-secondary text-base px-8 py-4 gap-3"
            >
              <Play size={16} className="text-primary" />
              Try Demo Free
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div key={i} className="glass-card p-4 text-center">
                <div className="text-2xl font-black gradient-text mb-1">{stat.value}</div>
                <div className="text-text-muted text-xs">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Dashboard preview mockup with 3D Tilt Container */}
        <motion.div
          style={{
            rotateX: mockupRotateX,
            y: mockupTranslateY,
            scale: mockupScale,
            transformStyle: 'preserve-3d',
            perspective: 1200
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8, ease: 'easeOut' }}
          className="mt-20 w-full max-w-5xl mx-auto relative cursor-grab active:cursor-grabbing"
        >
          {/* Glow effect under preview */}
          <div className="absolute inset-x-20 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent blur-sm" />
          <div className="absolute inset-x-10 bottom-0 h-8 opacity-30 blur-xl"
            style={{ background: 'linear-gradient(to right, transparent, #8B5CF6, #EC4899, transparent)' }} />

          <TiltContainer className="w-full">
            <div className="glass-card overflow-hidden border border-white/10" style={{ transformStyle: 'preserve-3d' }}>
              {/* Mock browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background-secondary" style={{ transform: 'translateZ(10px)' }}>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-danger/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-lg bg-background text-text-subtle text-xs border border-border">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    app.tadaai.io/dashboard
                  </div>
                </div>
              </div>

              {/* Mock dashboard content */}
              <div className="p-6 bg-background-secondary/50" style={{ transform: 'translateZ(15px)', transformStyle: 'preserve-3d' }}>
                {/* KPI row */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total Datasets', value: '24', change: '+3', color: '#8B5CF6', icon: '📁' },
                    { label: 'Analysis Jobs', value: '142', change: '+12', color: '#10B981', icon: '⚡' },
                    { label: 'AI Insights', value: '389', change: '+28', color: '#EC4899', icon: '🤖' },
                    { label: 'Forecast Accuracy', value: '94.2%', change: '+1.2%', color: '#F59E0B', icon: '🎯' },
                  ].map((kpi, i) => (
                    <div key={i} className="glass-card p-3 shadow-glass" style={{ transform: `translateZ(${10 + i * 5}px)` }}>
                      <div className="text-lg mb-1">{kpi.icon}</div>
                      <div className="text-lg font-bold text-text">{kpi.value}</div>
                      <div className="text-[10px] text-text-muted">{kpi.label}</div>
                      <div className="text-[10px] text-success mt-1">{kpi.change} this week</div>
                    </div>
                  ))}
                </div>

                {/* Chart row */}
                <div className="grid grid-cols-3 gap-3" style={{ transform: 'translateZ(20px)' }}>
                  <div className="col-span-2 glass-card p-3 h-36">
                    <div className="text-xs text-text-muted mb-2 font-medium">Revenue Trend</div>
                    <div className="flex items-end gap-1 h-20">
                      {[40, 65, 45, 80, 60, 90, 75, 95, 70, 100, 85, 110].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t"
                          style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, #8B5CF6, #EC4899)`,
                            opacity: 0.6 + (i / 20)
                          }} />
                      ))}
                    </div>
                  </div>
                  <div className="glass-card p-3 h-36">
                    <div className="text-xs text-text-muted mb-2 font-medium">Data Quality</div>
                    <div className="relative w-20 h-20 mx-auto">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none" stroke="#1E293B" strokeWidth="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none" stroke="#10B981" strokeWidth="3"
                          strokeDasharray="87, 100" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-success">87%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TiltContainer>
        </motion.div>
      </motion.section>

      {/* Features section */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 badge-primary text-xs mb-4"
            >
              <Brain size={12} /> Full-Stack AI Platform
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black tracking-tight text-text mb-4"
            >
              Everything you need for{' '}
              <span className="text-gradient">enterprise analytics</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-text-muted max-w-2xl mx-auto"
            >
              From raw data to executive insights in minutes. TADA AI handles the entire
              analytics pipeline so your team can focus on decisions, not data wrangling.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <FeatureCard key={i} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Multi-agent section */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-black tracking-tight text-text mb-4"
            >
              Powered by a{' '}
              <span className="text-gradient">Multi-Agent AI System</span>
            </motion.h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Six specialized AI agents work in coordination to process your data,
              generate insights, and deliver actionable intelligence.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {agents.map((agent, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-5 text-center group hover:border-primary/30 transition-all duration-300"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">
                  {agent.icon}
                </div>
                <div className="font-semibold text-text text-sm mb-1">{agent.name}</div>
                <div className="text-text-muted text-xs">{agent.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-12 gradient-border relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-10"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, #8B5CF6 0%, transparent 70%)' }} />
            <div className="relative">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-3xl font-black text-text mb-3 tracking-tight">
                Start analyzing your data today
              </h2>
              <p className="text-text-muted mb-8 max-w-xl mx-auto">
                Join thousands of data teams using TADA AI to transform raw data into
                executive-ready business intelligence.
              </p>
              <button
                id="cta-google-signin-btn"
                onClick={handleGoogleSignIn}
                className="btn-primary text-base px-8 py-4 inline-flex"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                </svg>
                Get Started — It's Free
                <ArrowRight size={16} />
              </button>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1"><Check size={12} className="text-success" /> No credit card</span>
                <span className="flex items-center gap-1"><Check size={12} className="text-success" /> Instant access</span>
                <span className="flex items-center gap-1"><Check size={12} className="text-success" /> Enterprise-grade</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src="/logo.png" alt="TADA AI Logo" className="w-6 h-6 rounded-md object-contain" />
          <span className="font-bold text-text text-sm">TADA AI</span>
        </div>
        <p className="text-text-subtle text-xs">
          © 2026 TADA AI. Autonomous Data Analyst & Business Intelligence Agent.
          <br />
          Built with Google Gemini AI, React, FastAPI & Supabase.
        </p>
      </footer>
    </div>
  )
}
