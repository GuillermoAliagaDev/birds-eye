import { useState, useEffect, useCallback } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import QuickActionButton from './components/QuickActionButton'
import { getSupabase } from './lib/supabase'

const defaultStops = [
  { name: 'Partida: Av. 28 de Julio 1014',             lng: -77.0315, lat: -12.1202 },
  { name: 'NW Av. 28 de Julio → Av. José Larco',       lng: -77.0299, lat: -12.1178 },
  { name: 'Av. José Larco → Av. Arequipa',             lng: -77.0298, lat: -12.1120 },
  { name: 'Av. Arequipa (keep left)',                  lng: -77.0320, lat: -12.1070 },
  { name: 'Av. Arequipa → Jirón Torre Ugarte',         lng: -77.0310, lat: -12.1015 },
  { name: 'Av. César Vallejo / Álvarez de Arenales',   lng: -77.0330, lat: -12.0985 },
  { name: 'Av. Jorge Basadre → Av. Camino Real',       lng: -77.0300, lat: -12.0955 },
  { name: 'Av. Camino Real → Av. Emilio Cavenecia',    lng: -77.0265, lat: -12.0955 },
  { name: 'Av. Los Conquistadores',                    lng: -77.0240, lat: -12.0990 },
  { name: 'C. La República → Sta. Cruz',               lng: -77.0250, lat: -12.1040 },
  { name: 'Av. Angamos Oeste',                         lng: -77.0260, lat: -12.1055 },
  { name: 'Av. Angamos Este → Gral. Suárez',           lng: -77.0300, lat: -12.1045 },
  { name: 'Av. Petit Thouars (N)',                     lng: -77.0335, lat: -12.1010 },
  { name: 'Av. Javier Prado Este',                     lng: -77.0355, lat: -12.0985 },
  { name: 'Av. Ricardo Rivera → Juan de Arona',        lng: -77.0325, lat: -12.0950 },
  { name: 'Av. República de Colombia',                 lng: -77.0295, lat: -12.0935 },
  { name: 'Av. Paseo de la República → Vía Expresa',   lng: -77.0340, lat: -12.0980 },
  { name: 'Vía Expresa (S)',                           lng: -77.0365, lat: -12.1050 },
  { name: 'Exit Benavides',                            lng: -77.0365, lat: -12.1095 },
  { name: 'Av. Alfredo Benavides',                     lng: -77.0345, lat: -12.1160 },
  { name: 'Ca. San Martín → Av. Reducto',              lng: -77.0320, lat: -12.1185 },
  { name: 'Av. Armendáriz',                            lng: -77.0295, lat: -12.1200 },
  { name: 'Av. José Larco (return)',                   lng: -77.0285, lat: -12.1185 },
  { name: 'Av. Reducto → Av. 28 de Julio',             lng: -77.0310, lat: -12.1190 },
  { name: 'Av. 28 de Julio 1014 — Llegada',            lng: -77.0305, lat: -12.1195 },
]

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [stops, setStops] = useState(defaultStops)
  const [isAddingStop, setIsAddingStop] = useState(false)
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('supabase_url') || '')
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('supabase_anon_key') || '')
  const [isSharing, setIsSharing] = useState(false)

  const handleSetSupabaseUrl = useCallback((url) => {
    setSupabaseUrl(url)
    localStorage.setItem('supabase_url', url)
  }, [])

  const handleSetSupabaseKey = useCallback((key) => {
    setSupabaseKey(key)
    localStorage.setItem('supabase_anon_key', key)
  }, [])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return
    sb.from('routes').select('*').order('id', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data?.length > 0 && data[0].stops?.length > 1) {
          setStops(data[0].stops)
        }
      })
      .catch(() => {})
  }, [supabaseUrl, supabaseKey])

  const saveRoute = useCallback(async () => {
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return
    const { error } = await sb.from('routes').insert({ stops, name: 'Ruta principal' })
    if (!error) {
      const updated = [...stops]
      updated[updated.length - 1] = { ...updated[updated.length - 1], name: updated[updated.length - 1].name + ' ✓' }
      setTimeout(() => setStops(updated), 100)
    }
  }, [supabaseUrl, supabaseKey, stops])

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
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        stops={stops}
        setStops={setStops}
        isAddingStop={isAddingStop}
        setIsAddingStop={setIsAddingStop}
        defaultStops={defaultStops}
        supabaseUrl={supabaseUrl}
        setSupabaseUrl={handleSetSupabaseUrl}
        supabaseKey={supabaseKey}
        setSupabaseKey={handleSetSupabaseKey}
        isSharing={isSharing}
        setIsSharing={setIsSharing}
        saveRoute={saveRoute}
      />
      <QuickActionButton onClick={() => setRecenterTrigger(t => t + 1)} />
    </div>
  )
}

export default App
