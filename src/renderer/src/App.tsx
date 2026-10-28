import React, { Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { i18n } from '@/i18n'
import AppShell from '@/components/layout/AppShell'
import Home from '@/pages/Home'
import Instances from '@/pages/Instances'
import InstanceDetail from '@/pages/InstanceDetail'
import Onboarding from '@/pages/Onboarding'

const Browse = React.lazy(() => import('@/pages/Browse'))
const Modpacks = React.lazy(() => import('@/pages/Modpacks'))
const Skins = React.lazy(() => import('@/pages/Skins'))
const Servers = React.lazy(() => import('@/pages/Servers'))
const Logs = React.lazy(() => import('@/pages/Logs'))
const Settings = React.lazy(() => import('@/pages/Settings'))

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded-lg bg-[var(--surface)] animate-pulse" />
      <div className="h-40 rounded-xl bg-[var(--surface)] animate-pulse" />
      <div className="h-40 rounded-xl bg-[var(--surface)] animate-pulse" />
    </div>
  )
}

function AppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => api.settings.get() })

  useEffect(() => {
    const s = settingsQuery.data
    if (s && !s.onboardingDone && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    }
    if (s?.language && s.language !== i18n.language) {
      void i18n.changeLanguage(s.language)
    }
  }, [settingsQuery.data, location.pathname, navigate])

  const isOnboarding = location.pathname === '/onboarding'

  const routes = (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={<Home />} />
      <Route path="/instances" element={<Instances />} />
      <Route path="/instances/:id" element={<InstanceDetail />} />
      <Route path="/browse" element={<Browse />} />
      <Route path="/modpacks" element={<Modpacks />} />
      <Route path="/skins" element={<Skins />} />
      <Route path="/servers" element={<Servers />} />
      <Route path="/logs" element={<Logs />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  if (isOnboarding) {
    return <Suspense fallback={<PageSkeleton />}>{routes}</Suspense>
  }
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>{routes}</Suspense>
    </AppShell>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}