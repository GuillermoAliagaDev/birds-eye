import { useState, useEffect, useCallback, useRef } from 'react'
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Flag, LocateOff, Navigation } from 'lucide-react'

const osmStyle = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

const initialView = {
  longitude: -77.0315,
  latitude: -12.1202,
  zoom: 15,
  pitch: 60,
  bearing: 0,
}

const stops = [
  { num: 1, name: 'Partida: Av. 28 de Julio 1014',           lng: -77.0315, lat: -12.1202 },
  { num: 2, name: 'NW Av. 28 de Julio → Av. José Larco',      lng: -77.0299, lat: -12.1178 },
  { num: 3, name: 'Av. José Larco → Av. Arequipa',            lng: -77.0298, lat: -12.1120 },
  { num: 4, name: 'Av. Arequipa (keep left)',                  lng: -77.0320, lat: -12.1070 },
  { num: 5, name: 'Av. Arequipa → Jirón Torre Ugarte',        lng: -77.0310, lat: -12.1015 },
  { num: 6, name: 'Av. César Vallejo / Álvarez de Arenales',   lng: -77.0330, lat: -12.0985 },
  { num: 7, name: 'Av. Jorge Basadre → Av. Camino Real',      lng: -77.0300, lat: -12.0955 },
  { num: 8, name: 'Av. Camino Real → Av. Emilio Cavenecia',   lng: -77.0265, lat: -12.0955 },
  { num: 9, name: 'Av. Los Conquistadores',                   lng: -77.0240, lat: -12.0990 },
  { num: 10, name: 'C. La República → Sta. Cruz',             lng: -77.0250, lat: -12.1040 },
  { num: 11, name: 'Av. Angamos Oeste',                       lng: -77.0260, lat: -12.1055 },
  { num: 12, name: 'Av. Angamos Este → Gral. Suárez',         lng: -77.0300, lat: -12.1045 },
  { num: 13, name: 'Av. Petit Thouars (N)',                   lng: -77.0335, lat: -12.1010 },
  { num: 14, name: 'Av. Javier Prado Este',                   lng: -77.0355, lat: -12.0985 },
  { num: 15, name: 'Av. Ricardo Rivera → Juan de Arona',      lng: -77.0325, lat: -12.0950 },
  { num: 16, name: 'Av. República de Colombia',               lng: -77.0295, lat: -12.0935 },
  { num: 17, name: 'Av. Paseo de la República → Vía Expresa', lng: -77.0340, lat: -12.0980 },
  { num: 18, name: 'Vía Expresa (S)',                         lng: -77.0365, lat: -12.1050 },
  { num: 19, name: 'Exit Benavides',                          lng: -77.0365, lat: -12.1095 },
  { num: 20, name: 'Av. Alfredo Benavides',                   lng: -77.0345, lat: -12.1160 },
  { num: 21, name: 'Ca. San Martín → Av. Reducto',            lng: -77.0320, lat: -12.1185 },
  { num: 22, name: 'Av. Armendáriz',                          lng: -77.0295, lat: -12.1200 },
  { num: 23, name: 'Av. José Larco (return)',                 lng: -77.0285, lat: -12.1185 },
  { num: 24, name: 'Av. Reducto → Av. 28 de Julio',           lng: -77.0310, lat: -12.1190 },
  { num: 25, name: 'Av. 28 de Julio 1014 — Llegada',          lng: -77.0305, lat: -12.1195 },
]

const lineStyle = {
  id: 'route-line',
  type: 'line',
  paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 },
}

function calcHeading(lat1, lng1, lat2, lng2) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180)
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function interpolateRoute(wpts, segments = 600) {
  if (wpts.length < 2) return wpts
  const pts = wpts.map(s => [s.lng, s.lat])
  const dist = []
  for (let i = 1; i < pts.length; i++) {
    const [lng1, lat1] = pts[i - 1]; const [lng2, lat2] = pts[i]
    dist.push(Math.sqrt((lng2 - lng1) ** 2 + (lat2 - lat1) ** 2) * 111000)
  }
  const total = dist.reduce((a, b) => a + b, 0)
  const result = [pts[0]]
  let acc = 0; let segIdx = 0
  for (let i = 1; i < segments; i++) {
    const target = (i / segments) * total
    while (segIdx < dist.length - 1 && acc + dist[segIdx] < target) {
      acc += dist[segIdx]; segIdx++
    }
    const remain = target - acc
    const frac = dist[segIdx] > 0 ? remain / dist[segIdx] : 0
    const [lng1, lat1] = pts[segIdx]; const [lng2, lat2] = pts[segIdx + 1]
    result.push([lng1 + (lng2 - lng1) * frac, lat1 + (lat2 - lat1) * frac])
  }
  if (result.length < segments) {
    result.push(pts[pts.length - 1])
  }
  return result
}

function MapView({ isSidebarOpen, recenterTrigger }) {
  const mapRef = useRef(null)
  const [userPos, setUserPos] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle')
  const [isRaceActive, setIsRaceActive] = useState(false)
  const [rutaMsg, setRutaMsg] = useState(false)
  const [rutaEndMsg, setRutaEndMsg] = useState(false)
  const [simPos, setSimPos] = useState(null)
  const [routeCoords, setRouteCoords] = useState(null)
  const watchIdRef = useRef(null)
  const animRef = useRef(null)
  const simRef = useRef({ running: false })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus('unsupported'); return }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude
        setUserPos([lat, lng]); setGeoStatus('success')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  useEffect(() => { requestLocation() }, [requestLocation])

  const runSimulation = useCallback((coords) => {
    setRouteCoords(coords)
    setSimPos(coords[0])
    simRef.current.running = true

    const duration = 90000
    const startTime = performance.now()

    const tick = (timestamp) => {
      if (!simRef.current.running) return
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const idx = Math.floor(progress * (coords.length - 1))
      setSimPos(coords[idx])

      if (idx > 0 && idx < coords.length) {
        const [lng, lat] = coords[idx]
        const [prevLng, prevLat] = coords[idx - 1]
        const heading = calcHeading(prevLat, prevLng, lat, lng)
        mapRef.current?.easeTo({
          center: [lng, lat], bearing: heading, pitch: 60, zoom: 17, duration: 300,
        })
      }
      if (progress >= 1) {
        simRef.current.running = false
        setIsRaceActive(false)
        setRouteCoords(null)
        setSimPos(null)
        setRutaEndMsg(true)
        mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 1500 })
        setTimeout(() => setRutaEndMsg(false), 4000)
        return
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (!isRaceActive) {
      animRef.current && cancelAnimationFrame(animRef.current)
      simRef.current.running = false
      watchIdRef.current && navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      return
    }

    const stopCoords = stops.map(s => `${s.lng},${s.lat}`).join(';')
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${stopCoords}?geometries=geojson&overview=full`
    let cancelled = false

    fetch(osrmUrl)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data?.routes?.[0]?.geometry?.coordinates?.length > 0) {
          runSimulation(data.routes[0].geometry.coordinates)
        } else {
          runSimulation(interpolateRoute(stops))
        }
      })
      .catch(() => {
        if (!cancelled) runSimulation(interpolateRoute(stops))
      })

    return () => { cancelled = true; animRef.current && cancelAnimationFrame(animRef.current); simRef.current.running = false }
  }, [isRaceActive, runSimulation])

  const recenter = useCallback(() => {
    if (!isRaceActive && userPos && mapRef.current) {
      const [lat, lng] = userPos
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15, pitch: 60, duration: 1000 })
    }
  }, [userPos, isRaceActive])

  useEffect(() => { if (recenterTrigger > 0) recenter() }, [recenterTrigger, recenter])

  useEffect(() => {
    if (rutaEndMsg) { const t = setTimeout(() => setRutaEndMsg(false), 4000); return () => clearTimeout(t) }
  }, [rutaEndMsg])

  useEffect(() => {
    if (rutaMsg) { const t = setTimeout(() => setRutaMsg(false), 3000); return () => clearTimeout(t) }
  }, [rutaMsg])

  const handleToggleRace = () => {
    if (isRaceActive) {
      setIsRaceActive(false)
      setRouteCoords(null); setSimPos(null)
      mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 1000 })
    } else {
      setRouteCoords(null); setSimPos(null)
      setIsRaceActive(true); setRutaMsg(true)
      mapRef.current?.flyTo({ center: [-77.0315, -12.1202], zoom: 15, pitch: 60, duration: 1500 })
    }
  }

  const routeGeoJSON = routeCoords ? {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: routeCoords },
  } : null

  const simLng = simPos ? simPos[0] : null
  const simLat = simPos ? simPos[1] : null

  return (
    <>
      <Map
        ref={mapRef}
        mapStyle={osmStyle}
        initialViewState={initialView}
        style={{ width: '100%', height: '100dvh' }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            <Layer {...lineStyle} />
          </Source>
        )}

        {simLng && simLat && (
          <Marker longitude={simLng} latitude={simLat} anchor="center">
            <div className="relative animate-pulse">
              <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <Navigation size={12} className="text-white" />
              </div>
            </div>
          </Marker>
        )}

        {!isRaceActive && userPos && (
          <Marker longitude={userPos[1]} latitude={userPos[0]} anchor="center">
            <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
          </Marker>
        )}

        {stops.map((s) => (
          <Marker key={s.num} longitude={s.lng} latitude={s.lat} anchor="center">
            <div className="relative group cursor-pointer">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2 transition-all ${
                isRaceActive
                  ? 'bg-blue-500/80 text-white border-blue-300'
                  : 'bg-[#111113]/90 text-blue-400 border-blue-500/50 hover:bg-[#1f1f22]'
              }`}>
                {s.num}
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap">
                <div className="bg-[#111113] text-white text-[10px] px-2 py-1 rounded-lg border border-white/10 shadow-lg">
                  {s.num}. {s.name}
                </div>
              </div>
            </div>
          </Marker>
        ))}
      </Map>

      {!isSidebarOpen && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {geoStatus === 'denied' && (
            <button onClick={requestLocation}
              className="p-2.5 bg-[#111113] rounded-xl shadow-lg text-white hover:bg-[#1f1f22] border border-white/10 transition-all"
              title="Activar ubicación"
            ><LocateOff size={18} /></button>
          )}
          {geoStatus === 'loading' && (
            <div className="p-2.5 bg-[#111113] rounded-xl shadow-lg text-white border border-white/10">
              <div className="w-[18px] h-[18px] border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {geoStatus === 'success' && (
            <button onClick={handleToggleRace}
              className={`p-2.5 rounded-xl shadow-lg border border-white/10 transition-all ${
                isRaceActive
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-[#111113] text-blue-400 hover:bg-[#1f1f22]'
              }`}
              title={isRaceActive ? 'Detener ruta' : 'Iniciar ruta simulada'}
            ><Flag size={18} /></button>
          )}
          {geoStatus === 'unsupported' && (
            <div className="p-2.5 bg-red-500/20 rounded-xl shadow-lg text-red-400 border border-red-500/30 text-xs px-3">
              GPS no disponible
            </div>
          )}
        </div>
      )}

      {rutaMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#111113] text-green-400 border border-green-500/30 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-pulse">
          RUTA 1 DEL PILOTO INICIADA
        </div>
      )}

      {isRaceActive && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111113]/90 backdrop-blur-sm border border-green-500/30 px-4 py-2 rounded-xl shadow-2xl text-xs text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Ruta activa · {stops.length} puntos
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40 bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white/70">
        &copy; OpenStreetMap
      </div>
      {rutaEndMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#111113] text-yellow-400 border border-yellow-500/30 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-pulse">
          RUTA COMPLETADA — Presiona bandera para reiniciar
        </div>
      )}
    </>
  )
}

export default MapView
