import { useState, useEffect, useCallback, useRef } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import QuickActionButton from './components/QuickActionButton'
import { getSupabase, normalizeUrl } from './lib/supabase'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    const stored = localStorage.getItem('supabase_url')
    if (stored) return normalizeUrl(stored)
    const envUrl = import.meta.env.VITE_SUPABASE_URL
    if (envUrl) { localStorage.setItem('supabase_url', normalizeUrl(envUrl)); return normalizeUrl(envUrl) }
    return ''
  })
  const [supabaseKey, setSupabaseKey] = useState(() => {
    const stored = localStorage.getItem('supabase_anon_key')
    if (stored) return stored
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (envKey) { localStorage.setItem('supabase_anon_key', envKey); return envKey }
    return ''
  })
  const [isAdmin, setIsAdmin] = useState(() => {
    const stored = localStorage.getItem('is_admin')
    if (stored === 'true' || stored === 'false') return stored === 'true'
    if (import.meta.env.VITE_IS_ADMIN === 'true') { localStorage.setItem('is_admin', 'true'); return true }
    return false
  })
  const [isSharing, setIsSharing] = useState(false)
  const [supabaseStatus, setSupabaseStatus] = useState('idle')

  const [routes, setRoutes] = useState([])
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [stops, setStops] = useState([])
  const [isAddingStop, setIsAddingStop] = useState(false)
  // const [testSimActive, setTestSimActive] = useState(false)

  const stopsRef = useRef(stops)
  stopsRef.current = stops
  const autoSharedRef = useRef(false)

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) { setSupabaseStatus('idle'); return }
    setSupabaseStatus('checking')
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) { setSupabaseStatus('error'); return }
    sb.from('locations').select('count', { count: 'exact', head: true })
      .then(({ error }) => setSupabaseStatus(error ? 'error' : 'connected'))
      .catch(() => setSupabaseStatus('error'))
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (isAdmin && supabaseStatus === 'connected' && !autoSharedRef.current) {
      autoSharedRef.current = true
      setIsSharing(true)
    }
    if (!isAdmin || supabaseStatus !== 'connected') {
      autoSharedRef.current = false
    }
  }, [isAdmin, supabaseStatus])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || supabaseStatus !== 'connected') return
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return

    sb.from('routes').select('*').order('id', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data?.length > 0) { setRoutes(data); return }
        sb.from('routes').insert({
          name: 'Ruta principal',
          stops: [
            { name: 'Av. 28 de Julio 1014', lng: -77.0315, lat: -12.1202 },
            { name: 'Av. José Larco', lng: -77.0298, lat: -12.1120 },
            { name: 'Av. Arequipa', lng: -77.0320, lat: -12.1070 },
            { name: 'Av. Javier Prado', lng: -77.0355, lat: -12.0985 },
            { name: 'Vía Expresa', lng: -77.0365, lat: -12.1050 },
            { name: 'Av. Benavides', lng: -77.0345, lat: -12.1160 },
            { name: 'Av. 28 de Julio 1014 — Llegada', lng: -77.0305, lat: -12.1195 },
          ],
        }).select().single().then(({ data: d2 }) => { if (d2) setRoutes([d2]) })
      })

    const channel = sb.channel('routes-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'routes' },
        (payload) => {
          setRoutes(prev => {
            if (payload.eventType === 'INSERT') return [payload.new, ...prev]
            if (payload.eventType === 'UPDATE') return prev.map(r => r.id === payload.new.id ? payload.new : r)
            if (payload.eventType === 'DELETE') return prev.filter(r => r.id !== payload.old.id)
            return prev
          })
        }
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (!isAdmin && activeRouteId) {
      const route = routes.find(r => r.id === activeRouteId)
      if (route && JSON.stringify(route.stops) !== JSON.stringify(stopsRef.current)) {
        setStops(route.stops)
      }
    }
  }, [routes, activeRouteId, isAdmin])

  const handleSetIsAdmin = useCallback((v) => {
    setIsAdmin(v)
    localStorage.setItem('is_admin', v)
  }, [])

  const handleSelectRoute = useCallback((routeId) => {
    setActiveRouteId(routeId)
    const route = routes.find(r => r.id === routeId)
    if (route) setStops(route.stops)
    setIsAddingStop(false)
  }, [routes])

  const handleCreateRoute = useCallback(async () => {
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return
    const { data } = await sb.from('routes').insert({ name: 'Nueva ruta', stops: [] }).select().single()
    if (data) {
      setRoutes(prev => [data, ...prev])
      setActiveRouteId(data.id)
      setStops([])
    }
  }, [supabaseUrl, supabaseKey])

  const handleSaveRoute = useCallback(async () => {
    if (!activeRouteId) return
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return
    const { data } = await sb.from('routes').update({
      stops, updated_at: new Date().toISOString(),
    }).eq('id', activeRouteId).select().single()
    if (data) setRoutes(prev => prev.map(r => r.id === data.id ? data : r))
  }, [supabaseUrl, supabaseKey, activeRouteId, stops])

  const handleDeleteRoute = useCallback(async (routeId) => {
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return
    await sb.from('routes').delete().eq('id', routeId)
    setRoutes(prev => prev.filter(r => r.id !== routeId))
    if (activeRouteId === routeId) { setActiveRouteId(null); setStops([]) }
  }, [supabaseUrl, supabaseKey, activeRouteId])

  const handleSetSupabaseUrl = useCallback((url) => {
    const clean = normalizeUrl(url)
    setSupabaseUrl(clean); localStorage.setItem('supabase_url', clean)
  }, [])

  const handleSetSupabaseKey = useCallback((key) => {
    setSupabaseKey(key); localStorage.setItem('supabase_anon_key', key)
  }, [])

  return (
    <div className="relative w-full h-dvh">
      <MapView
        isSidebarOpen={isSidebarOpen}
        recenterTrigger={recenterTrigger}
        stops={stops}
        setStops={setStops}
        isAddingStop={isAddingStop}
        setIsAddingStop={setIsAddingStop}
        supabaseUrl={supabaseUrl}
        supabaseKey={supabaseKey}
        isSharing={isSharing}
        setIsSharing={setIsSharing}
        isAdmin={isAdmin}
        supabaseStatus={supabaseStatus}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        stops={stops}
        setStops={setStops}
        isAddingStop={isAddingStop}
        setIsAddingStop={setIsAddingStop}
        supabaseUrl={supabaseUrl}
        setSupabaseUrl={handleSetSupabaseUrl}
        supabaseKey={supabaseKey}
        setSupabaseKey={handleSetSupabaseKey}
        isSharing={isSharing}
        setIsSharing={setIsSharing}
        isAdmin={isAdmin}
        setIsAdmin={handleSetIsAdmin}
        supabaseStatus={supabaseStatus}
        routes={routes}
        activeRouteId={activeRouteId}
        onSelectRoute={handleSelectRoute}
        onCreateRoute={handleCreateRoute}
        onSaveRoute={handleSaveRoute}
        onDeleteRoute={handleDeleteRoute}
      />
      <QuickActionButton onClick={() => setRecenterTrigger(t => t + 1)} />
    </div>
  )
}

export default App
