import { useState, useEffect, useCallback, useRef } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import QuickActionButton from './components/QuickActionButton'
import { getSupabase, normalizeUrl, getDeviceName, setDeviceName, getDevicePlate, setDevicePlate } from './lib/supabase'

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
    if (stored) return stored.trim()
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (envKey) { const trimmed = envKey.trim(); localStorage.setItem('supabase_anon_key', trimmed); return trimmed }
    return ''
  })
  const [isAdmin, setIsAdmin] = useState(() => {
    try { return localStorage.getItem('is_admin') === 'true' } catch { return false }
  })
  const [isSharing, setIsSharing] = useState(false)
  const [supabaseStatus, setSupabaseStatus] = useState('idle')

  const [routes, setRoutes] = useState([])
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [stops, setStops] = useState([])
  const [isAddingStop, setIsAddingStop] = useState(false)
  // const [testSimActive, setTestSimActive] = useState(false)

  const [userName, setUserName] = useState(() => getDeviceName())
  const [nameInput, setNameInput] = useState('')
  const [devicePlate, setDevicePlateState] = useState(() => getDevicePlate())
  const [plateInput, setPlateInput] = useState('')
  const [showAdminDialog, setShowAdminDialog] = useState(false)
  const [adminUrlInput, setAdminUrlInput] = useState(() => supabaseUrl)
  const [adminKeyInput, setAdminKeyInput] = useState(() => supabaseKey)
  const [remoteUsers, setRemoteUsers] = useState({})
  const [locateCoords, setLocateCoords] = useState(null)

  const stopsRef = useRef(stops)
  stopsRef.current = stops
  const autoSharedRef = useRef(false)

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) { setSupabaseStatus('idle'); return }
    if (!/^https?:\/\/.+\./.test(supabaseUrl)) { setSupabaseStatus('error'); return }
    setSupabaseStatus('checking')
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) { setSupabaseStatus('error'); return }
    sb.from('locations').select('count', { count: 'exact', head: true })
      .then(({ error }) => setSupabaseStatus(error ? 'error' : 'connected'))
      .catch(() => setSupabaseStatus('error'))
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (supabaseStatus === 'connected' && !autoSharedRef.current) {
      if (!userName) return
      autoSharedRef.current = true
      setIsSharing(true)
    }
    if (supabaseStatus !== 'connected') {
      autoSharedRef.current = false
    }
  }, [isAdmin, supabaseStatus, userName])

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
    const trimmed = key.trim()
    setSupabaseKey(trimmed); localStorage.setItem('supabase_anon_key', trimmed)
  }, [])

  const handleConfirmName = useCallback(() => {
    const name = nameInput.trim().slice(0, 16)
    if (!name) return
    const plate = plateInput.trim()
    setDeviceName(name)
    setUserName(name)
    setDevicePlate(plate)
    setDevicePlateState(plate)
    setNameInput('')
    setPlateInput('')
  }, [nameInput, plateInput])

  const nameKey = (e) => { if (e.key === 'Enter') handleConfirmName() }

  return (
    <div className="relative w-full h-dvh">
      {!userName && (
        <div className="absolute inset-0 z-[100] bg-[#111113] flex items-center justify-center p-6">
          {/* Admin button in corner */}
          <button onClick={() => setShowAdminDialog(true)}
            className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg text-[11px] bg-yellow-500/12 text-yellow-400/80 border border-yellow-500/20 hover:bg-yellow-500/20 hover:text-yellow-300 transition-all"
          >Admin</button>

          {/* Admin config dialog */}
          {showAdminDialog && (
            <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-6" onClick={() => setShowAdminDialog(false)}>
              <div className="w-full max-w-xs bg-[#1a1a1d] rounded-2xl p-5 border border-white/[0.08] shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-white mb-4">Configurar Admin</h3>
                <div className="space-y-3">
                  <input value={adminUrlInput} onChange={e => setAdminUrlInput(e.target.value)}
                    placeholder="https://xyz.supabase.co"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/40 transition-colors"
                  />
                  <input value={adminKeyInput} onChange={e => setAdminKeyInput(e.target.value)}
                    placeholder="Anon Key"
                    type="password"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/40 transition-colors"
                  />
                  <button onClick={() => {
                    if (!adminUrlInput || !adminKeyInput) return
                    handleSetSupabaseUrl(adminUrlInput)
                    handleSetSupabaseKey(adminKeyInput)
                    const existingName = getDeviceName() || 'admin'
                    setDeviceName(existingName)
                    setUserName(existingName)
                    handleSetIsAdmin(true)
                    setShowAdminDialog(false)
                  }} disabled={!adminUrlInput || !adminKeyInput}
                    className="w-full py-2.5 rounded-xl bg-yellow-500/90 text-white text-sm font-medium hover:bg-yellow-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >Ingresar como admin</button>
                </div>
                <button onClick={() => setShowAdminDialog(false)}
                  className="mt-3 w-full text-[11px] text-gray-500 hover:text-gray-400 transition-colors"
                >Cancelar</button>
              </div>
            </div>
          )}

          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="w-11 h-11 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-blue-400 lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </div>
              <h1 className="text-lg font-bold text-white mb-1">Birds Eye</h1>
              <p className="text-xs text-white/50">GIS en tiempo real</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-white/50 mb-1.5 block">Nombre</label>
                <input value={nameInput} onChange={e => setNameInput(e.target.value.slice(0, 16))} onKeyDown={nameKey}
                  placeholder="Ej: Guille" maxLength={16}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/40 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] text-white/50 mb-1.5 block">Placa (opcional)</label>
                <input value={plateInput} onChange={e => {
                  setPlateInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 7))
                }} onKeyDown={nameKey}
                  placeholder="ABC-123" maxLength={7}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/40 transition-colors font-mono tracking-wider"
                />
              </div>

              <button onClick={() => {
                const name = nameInput.trim().slice(0, 16)
                if (!name) return
                const plate = plateInput.trim()
                setDeviceName(name)
                setUserName(name)
                setDevicePlate(plate)
                setDevicePlateState(plate)
                setNameInput('')
                setPlateInput('')
              }} disabled={!nameInput.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-500/90 text-white text-sm font-medium hover:bg-blue-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Ingresar
              </button>

              <p className="text-[10px] text-white/25 text-center leading-relaxed">
                Se solicitará permiso de ubicación
              </p>
            </div>
          </div>
        </div>
      )}

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
        onRemoteUsers={setRemoteUsers}
        locateCoords={locateCoords}
        devicePlate={devicePlate}
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
        deviceName={userName}
        onDeviceNameChange={setUserName}
        remoteUsers={remoteUsers}
        onLocateDevice={setLocateCoords}
        devicePlate={devicePlate}
      />
      <QuickActionButton onClick={() => setRecenterTrigger(t => t + 1)} />
    </div>
  )
}

export default App
