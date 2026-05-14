import { useState, useEffect, useCallback, useRef } from 'react'
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Flag, LocateOff } from 'lucide-react'
import { getSupabase, getDeviceId, getDeviceName } from '../lib/supabase'

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
  longitude: -77.0315, latitude: -12.1202, zoom: 15, pitch: 60, bearing: 0,
}

const lineStyle = {
  id: 'route-line',
  type: 'line',
  paint: { 'line-color': '#5893DE', 'line-width': 5, 'line-opacity': 0.9 },
}

const previewLineStyle = {
  id: 'preview-line',
  type: 'line',
  paint: {
    'line-color': '#5893DE',
    'line-width': 5,
    'line-opacity': 0.8,
    'line-dasharray': [3, 4],
  },
}

const fullPreviewLineStyle = {
  id: 'full-preview-line',
  type: 'line',
  paint: {
    'line-color': '#5893DE',
    'line-width': 5,
    'line-opacity': 0.6,
  },
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
    while (segIdx < dist.length - 1 && acc + dist[segIdx] < target) { acc += dist[segIdx]; segIdx++ }
    const remain = target - acc
    const frac = dist[segIdx] > 0 ? remain / dist[segIdx] : 0
    const [lng1, lat1] = pts[segIdx]; const [lng2, lat2] = pts[segIdx + 1]
    result.push([lng1 + (lng2 - lng1) * frac, lat1 + (lat2 - lat1) * frac])
  }
  if (result.length < segments) result.push(pts[pts.length - 1])
  return result
}

function haversineDist(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const USER_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#06B6D4', '#84CC16']

function userColor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i)
  return USER_COLORS[Math.abs(h) % USER_COLORS.length]
}

function MapView({ isSidebarOpen, recenterTrigger, stops, setStops, isAddingStop, setIsAddingStop, supabaseUrl, supabaseKey, isSharing, setIsSharing, isAdmin, testSimActive, onToggleTestSim }) {
  const mapRef = useRef(null)
  const [userPos, setUserPos] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle')
  const [isRaceActive, setIsRaceActive] = useState(false)
  const [rutaMsg, setRutaMsg] = useState(false)
  const [rutaEndMsg, setRutaEndMsg] = useState(false)
  const [simPos, setSimPos] = useState(null)
  const [routeCoords, setRouteCoords] = useState(null)
  const [hoverPos, setHoverPos] = useState(null)
  const [previewRoute, setPreviewRoute] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const watchIdRef = useRef(null)
  const animRef = useRef(null)
  const simRef = useRef({ running: false })
  const previewCacheRef = useRef({})
  const previewTimeoutRef = useRef(null)
  const fullPreviewTimerRef = useRef(null)
  const fullPreviewCacheRef = useRef({})
  const stopIndicesRef = useRef([])
  const [simIdx, setSimIdx] = useState(0)
  const [confirmPosition, setConfirmPosition] = useState(null)
  const [fullPreviewCoords, setFullPreviewCoords] = useState(null)
  const [fullPreviewLoading, setFullPreviewLoading] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState({})
  const locationIntervalRef = useRef(null)
  const routeCoordsKeyRef = useRef('')

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = isAddingStop ? 'crosshair' : ''
    if (!isAddingStop) { setHoverPos(null); setPreviewRoute(null); setPreviewLoading(false) }
  }, [isAddingStop])

  useEffect(() => {
    const key = stops.map(s => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join('|')
    if (key === routeCoordsKeyRef.current || stops.length < 2 || !mapRef.current) return
    routeCoordsKeyRef.current = key
    const minLng = Math.min(...stops.map(s => s.lng))
    const maxLng = Math.max(...stops.map(s => s.lng))
    const minLat = Math.min(...stops.map(s => s.lat))
    const maxLat = Math.max(...stops.map(s => s.lat))
    mapRef.current.fitBounds([[minLng - 0.002, minLat - 0.002], [maxLng + 0.002, maxLat + 0.002]], {
      padding: 80, maxZoom: 15, duration: 1200,
    })
  }, [stops])

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
    setRouteCoords(coords); setSimPos(coords[0]); setSimIdx(0); simRef.current.running = true
    const duration = 90000
    const startTime = performance.now()
    const tick = (timestamp) => {
      if (!simRef.current.running) return
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const idx = Math.floor(progress * (coords.length - 1))
      setSimPos(coords[idx]); setSimIdx(idx)
      if (idx > 0 && idx < coords.length) {
        const [lng, lat] = coords[idx]; const [prevLng, prevLat] = coords[idx - 1]
        const heading = calcHeading(prevLat, prevLng, lat, lng)
        mapRef.current?.easeTo({ center: [lng, lat], bearing: heading, pitch: 60, zoom: 17, duration: 300 })
      }
      if (progress >= 1) {
        simRef.current.running = false; setIsRaceActive(false); setRouteCoords(null); setSimPos(null); setSimIdx(0)
        setRutaEndMsg(true); mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 1500 })
        setTimeout(() => setRutaEndMsg(false), 4000); return
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [setSimIdx])

  useEffect(() => {
    if (!isRaceActive) {
      animRef.current && cancelAnimationFrame(animRef.current); simRef.current.running = false
      watchIdRef.current && navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null
      return
    }
    const stopStr = stops.map(s => `${s.lng},${s.lat}`).join(';')
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${stopStr}?geometries=geojson&overview=full`
    let cancelled = false
    fetch(osrmUrl)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data?.routes?.[0]?.geometry?.coordinates?.length > 0) runSimulation(data.routes[0].geometry.coordinates)
        else runSimulation(interpolateRoute(stops))
      })
      .catch(() => { if (!cancelled) runSimulation(interpolateRoute(stops)) })
    return () => { cancelled = true; animRef.current && cancelAnimationFrame(animRef.current); simRef.current.running = false; setSimIdx(0) }
  }, [isRaceActive, runSimulation, stops])

  const recenter = useCallback(() => {
    if (!isRaceActive && userPos && mapRef.current) {
      const [lat, lng] = userPos
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15, pitch: 60, duration: 1000 })
    }
  }, [userPos, isRaceActive])

  useEffect(() => { if (recenterTrigger > 0) recenter() }, [recenterTrigger, recenter])
  useEffect(() => { if (rutaEndMsg) { const t = setTimeout(() => setRutaEndMsg(false), 4000); return () => clearTimeout(t) } }, [rutaEndMsg])
  useEffect(() => { if (rutaMsg) { const t = setTimeout(() => setRutaMsg(false), 3000); return () => clearTimeout(t) } }, [rutaMsg])

  useEffect(() => {
    if (stops.length < 2 || isRaceActive) { setFullPreviewCoords(null); setFullPreviewLoading(false); return }
    const cacheKey = stops.map(s => `${s.lng.toFixed(5)},${s.lat.toFixed(5)}`).join('|')
    if (fullPreviewCacheRef.current[cacheKey]) {
      setFullPreviewCoords(fullPreviewCacheRef.current[cacheKey]); setFullPreviewLoading(false); return
    }
    setFullPreviewCoords(interpolateRoute(stops))
    setFullPreviewLoading(true)
    if (fullPreviewTimerRef.current) clearTimeout(fullPreviewTimerRef.current)
    fullPreviewTimerRef.current = setTimeout(async () => {
      const stopStr = stops.map(s => `${s.lng},${s.lat}`).join(';')
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${stopStr}?geometries=geojson&overview=full`
        )
        const data = await res.json()
        if (data?.routes?.[0]?.geometry?.coordinates?.length > 0) {
          const coords = data.routes[0].geometry.coordinates
          fullPreviewCacheRef.current[cacheKey] = coords
          const keys = Object.keys(fullPreviewCacheRef.current)
          if (keys.length > 50) delete fullPreviewCacheRef.current[keys[0]]
          setFullPreviewCoords(coords)
        }
      } catch {}
      setFullPreviewLoading(false)
    }, 500)
    return () => { if (fullPreviewTimerRef.current) clearTimeout(fullPreviewTimerRef.current) }
  }, [stops, isRaceActive])

  useEffect(() => {
    if (!routeCoords || stops.length < 2) { stopIndicesRef.current = []; return }
    const indices = stops.map(stop => {
      let minDist = Infinity, minIdx = 0
      for (let i = 0; i < routeCoords.length; i++) {
        const [lng, lat] = routeCoords[i]
        const d = (lng - stop.lng) ** 2 + (lat - stop.lat) ** 2
        if (d < minDist) { minDist = d; minIdx = i }
      }
      return minIdx
    })
    stopIndicesRef.current = indices
  }, [routeCoords, stops])

  useEffect(() => {
    if (!isSharing || !userPos || !supabaseUrl || !supabaseKey) {
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null }
      return
    }
    const send = async () => {
      const sb = getSupabase(supabaseUrl, supabaseKey)
      if (!sb) return
      const [lat, lng] = userPos
      const heading = isSharing ? 0 : 0
      await sb.from('locations').upsert({
        device_id: getDeviceId(),
        name: getDeviceName() || getDeviceId().slice(0, 8),
        lat, lng, heading,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_id', ignoreDuplicates: false }).maybeSingle()
    }
    send()
    locationIntervalRef.current = setInterval(send, 3000)
    return () => { if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null } }
  }, [isSharing, userPos, supabaseUrl, supabaseKey])

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) { setRemoteUsers({}); return }
    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return

    sb.from('locations').select('*')
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach(row => { if (row.device_id !== getDeviceId()) map[row.device_id] = row })
          setRemoteUsers(map)
        }
      })
      .catch(() => {})

    const channel = sb.channel('locations-remote')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        (payload) => {
          const row = payload.new
          if (row.device_id === getDeviceId()) return
          setRemoteUsers(prev => ({ ...prev, [row.device_id]: row }))
        }
      )
      .subscribe()

    const pollTimer = setInterval(async () => {
      try {
        const { data } = await sb.from('locations').select('*')
        if (data) {
          const map = {}
          data.forEach(row => { if (row.device_id !== getDeviceId()) map[row.device_id] = row })
          setRemoteUsers(map)
        }
      } catch {}
    }, 5000)

    return () => {
      sb.removeChannel(channel)
      clearInterval(pollTimer)
    }
  }, [supabaseUrl, supabaseKey])

  useEffect(() => {
    if (!testSimActive || !supabaseUrl || !supabaseKey) {
      if (testSimActive === false) {
        const sb = getSupabase(supabaseUrl, supabaseKey)
        if (sb) sb.from('locations').delete().like('device_id', 'test-%').then(() => {})
      }
      return
    }

    const vehicles = [
      { name: 'Taxi 1', waypoints: [{ lng: -77.033, lat: -12.120 }, { lng: -77.030, lat: -12.118 }, { lng: -77.029, lat: -12.114 }, { lng: -77.030, lat: -12.110 }, { lng: -77.033, lat: -12.108 }, { lng: -77.036, lat: -12.110 }, { lng: -77.035, lat: -12.115 }, { lng: -77.033, lat: -12.120 }] },
      { name: 'Bus 2', waypoints: [{ lng: -77.038, lat: -12.112 }, { lng: -77.036, lat: -12.109 }, { lng: -77.034, lat: -12.105 }, { lng: -77.032, lat: -12.100 }, { lng: -77.029, lat: -12.098 }, { lng: -77.026, lat: -12.098 }, { lng: -77.028, lat: -12.102 }, { lng: -77.031, lat: -12.104 }, { lng: -77.034, lat: -12.108 }, { lng: -77.036, lat: -12.112 }] },
      { name: 'Moto 3', waypoints: [{ lng: -77.033, lat: -12.118 }, { lng: -77.032, lat: -12.117 }, { lng: -77.030, lat: -12.117 }, { lng: -77.029, lat: -12.118 }, { lng: -77.030, lat: -12.119 }, { lng: -77.032, lat: -12.119 }] },
      { name: 'Camioneta 4', waypoints: [{ lng: -77.036, lat: -12.121 }, { lng: -77.039, lat: -12.120 }, { lng: -77.041, lat: -12.119 }, { lng: -77.043, lat: -12.118 }, { lng: -77.041, lat: -12.117 }, { lng: -77.038, lat: -12.118 }, { lng: -77.036, lat: -12.120 }] },
      { name: 'Scooter 5', waypoints: [{ lng: -77.029, lat: -12.116 }, { lng: -77.029, lat: -12.114 }, { lng: -77.029, lat: -12.112 }, { lng: -77.029, lat: -12.110 }, { lng: -77.029, lat: -12.112 }, { lng: -77.029, lat: -12.114 }, { lng: -77.029, lat: -12.116 }] },
    ]

    const routes = vehicles.map(v => ({ ...v, route: interpolateRoute(v.waypoints, 200) }))
    const state = routes.map(() => ({ idx: 0 }))
    const deviceIds = vehicles.map(v => 'test-' + v.name.toLowerCase().replace(' ', ''))

    const sb = getSupabase(supabaseUrl, supabaseKey)
    if (!sb) return

    const tick = async () => {
      for (let i = 0; i < vehicles.length; i++) {
        const route = routes[i].route
        state[i].idx = (state[i].idx + 1) % route.length
        const [lng, lat] = route[state[i].idx]
        const prev = route[state[i].idx === 0 ? route.length - 1 : state[i].idx - 1]
        const heading = calcHeading(prev[1], prev[0], lat, lng)
        try {
          await sb.from('locations').upsert({
            device_id: deviceIds[i],
            name: vehicles[i].name,
            lat, lng, heading,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'device_id', ignoreDuplicates: false })
        } catch {}
      }
    }

    tick()
    const interval = setInterval(tick, 3000)
    return () => clearInterval(interval)
  }, [testSimActive, supabaseUrl, supabaseKey])

  const handleToggleRace = () => {
    if (isRaceActive) {
      setIsRaceActive(false); setRouteCoords(null); setSimPos(null); setSimIdx(0)
      mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 1000 })
    } else {
      if (stops.length < 2) { setRutaMsg(true); setTimeout(() => setRutaMsg(false), 2000); return }
      setRouteCoords(null); setSimPos(null)
      setIsRaceActive(true); setRutaMsg(true)
      const first = stops[0]
      mapRef.current?.flyTo({ center: [first.lng, first.lat], zoom: 15, pitch: 60, duration: 1500 })
    }
  }

  const handleMapClick = useCallback(async (e) => {
    if (!isAddingStop || confirmPosition) return
    const { lng, lat } = e.lngLat
    const name = `Punto ${stops.length + 1}`
    setConfirmPosition({ lng, lat, name, street: null })
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lng=${lng}`
      )
      const data = await res.json()
      const addr = data?.address
      const parts = data?.display_name?.split(',').map(s => s.trim()) || []
      const road = addr?.road || addr?.pedestrian || addr?.street || addr?.footway || addr?.path || addr?.cycleway || ''
      const area = addr?.suburb || addr?.neighbourhood || addr?.quarter || addr?.city_district || addr?.city || ''
      const street = [road, area].filter(Boolean).join(', ') || parts.slice(0, 2).join(', ') || ''
      setConfirmPosition(prev => prev && prev.lng === lng && prev.lat === lat ? { ...prev, street } : prev)
    } catch {
      setConfirmPosition(prev => prev && prev.lng === lng && prev.lat === lat ? { ...prev, street: '' } : prev)
    }
    setHoverPos(null); setPreviewRoute(null); setPreviewLoading(false)
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
  }, [isAddingStop, stops.length, confirmPosition])

  const fetchPreviewRoute = useCallback(async (from, to) => {
    const key = `${from.lng.toFixed(4)},${from.lat.toFixed(4)}-${to[0].toFixed(4)},${to[1].toFixed(4)}`
    if (previewCacheRef.current[key]) {
      setPreviewRoute(previewCacheRef.current[key]); setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to[0]},${to[1]}?geometries=geojson&overview=full`
      )
      const data = await res.json()
      const coords = data?.routes?.[0]?.geometry?.coordinates
      if (coords?.length) {
        previewCacheRef.current[key] = coords
        const keys = Object.keys(previewCacheRef.current)
        if (keys.length > 100) delete previewCacheRef.current[keys[0]]
        if (isAddingStop) setPreviewRoute(coords)
      } else {
        setPreviewRoute(null)
      }
    } catch {
      setPreviewRoute(null)
    }
    if (isAddingStop) setPreviewLoading(false)
  }, [isAddingStop])

  const handleMapMove = useCallback((e) => {
    if (!isAddingStop || !e.lngLat || confirmPosition) return
    const pos = [e.lngLat.lng, e.lngLat.lat]
    setHoverPos(pos)
    if (stops.length === 0) { setPreviewRoute(null); return }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => {
      fetchPreviewRoute(stops[stops.length - 1], pos)
    }, 250)
  }, [isAddingStop, stops, fetchPreviewRoute, confirmPosition])

  const routeGeoJSON = routeCoords ? {
    type: 'Feature', properties: {},
    geometry: { type: 'LineString', coordinates: isRaceActive && simIdx > 0 ? routeCoords.slice(simIdx) : routeCoords },
  } : null
  const simLng = simPos ? simPos[0] : null; const simLat = simPos ? simPos[1] : null
  const completedStops = new Set()
  if (isRaceActive && simIdx > 0 && stopIndicesRef.current.length === stops.length) {
    stopIndicesRef.current.forEach((idx, i) => { if (simIdx >= idx) completedStops.add(i) })
  }

  const visibleUsers = Object.entries(remoteUsers).filter(([id, u]) => {
    if (id === getDeviceId()) return false
    if (isAdmin) return true
    if (!userPos) return false
    return haversineDist(userPos[0], userPos[1], u.lat, u.lng) <= 100
  })

  return (
    <>
      <Map
        ref={mapRef}
        mapStyle={osmStyle}
        initialViewState={initialView}
        style={{ width: '100%', height: '100dvh' }}
        attributionControl={false}
        onClick={handleMapClick}
        onMouseMove={handleMapMove}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            <Layer {...lineStyle} />
          </Source>
        )}

        {!isRaceActive && fullPreviewCoords && (
          <Source id="full-preview" type="geojson" data={{
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: fullPreviewCoords },
          }}>
            <Layer {...fullPreviewLineStyle} />
          </Source>
        )}

        {isAddingStop && previewRoute && (
          <Source id="preview" type="geojson" data={{
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: previewRoute },
          }}>
            <Layer {...previewLineStyle} />
          </Source>
        )}

        {simLng && simLat && (
          <Marker longitude={simLng} latitude={simLat} anchor="center">
            <div className="relative animate-pulse">
              <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                <Flag size={14} className="text-white" />
              </div>
            </div>
          </Marker>
        )}

        {!isRaceActive && userPos && (
          <Marker longitude={userPos[1]} latitude={userPos[0]} anchor="center">
            <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
              <Flag size={14} className="text-white" />
            </div>
          </Marker>
        )}

        {visibleUsers.map(([deviceId, user]) => {
          const color = userColor(deviceId)
          return (
            <Marker key={deviceId} longitude={user.lng} latitude={user.lat} anchor="center">
              <div className="relative group">
                <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: color }}>
                  <Flag size={14} className="text-white" />
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap z-10">
                  <div className="bg-[#111113] text-white text-[9px] px-1.5 py-0.5 rounded border border-white/10 shadow-lg flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {user.name || deviceId.slice(0, 8)}
                  </div>
                </div>
              </div>
            </Marker>
          )
        })}

        {stops.map((s, i) => (
          <Marker key={i} longitude={s.lng} latitude={s.lat} anchor="center">
            <div className="relative group cursor-pointer">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 transition-all ${
                completedStops.has(i) ? 'bg-green-500 border-green-300'
                  : isRaceActive ? 'bg-blue-500/80 border-blue-300'
                  : isAddingStop ? 'bg-green-500/80 border-green-300'
                  : 'bg-[#111113]/90 border-blue-500/50 hover:bg-[#1f1f22]'
              }`}>
                <Flag size={14} className="text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#111113] border border-white/20 flex items-center justify-center text-[9px] font-bold text-white shadow-lg">
                {i + 1}
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap">
                <div className="bg-[#111113] text-white text-[10px] px-2 py-1 rounded-lg border border-white/10 shadow-lg">
                  {i + 1}. {s.name}
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {isAddingStop && hoverPos && (
          <Marker longitude={hoverPos[0]} latitude={hoverPos[1]} anchor="center">
            <div className="relative">
              <div className={`w-8 h-8 rounded-full border-2 border-green-400 shadow-lg flex items-center justify-center ${
                previewLoading ? 'bg-green-400/20' : 'bg-green-400/40'
              }`}>
                {previewLoading ? (
                  <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Flag size={14} className="text-white" />
                )}
              </div>
              {!previewLoading && <div className="absolute inset-0 w-8 h-8 rounded-full bg-green-400/20 animate-ping" />}
            </div>
          </Marker>
        )}
      </Map>

      {!isSidebarOpen && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {geoStatus === 'denied' && (
            <button onClick={requestLocation}
              className="p-2.5 bg-[#111113] rounded-xl shadow-lg text-white hover:bg-[#1f1f22] border border-white/10 transition-all"
              title="Activar ubicación"><LocateOff size={18} /></button>
          )}
          {geoStatus === 'loading' && (
            <div className="p-2.5 bg-[#111113] rounded-xl shadow-lg text-white border border-white/10">
              <div className="w-[18px] h-[18px] border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {geoStatus === 'success' && isAdmin && (
            <button onClick={handleToggleRace}
              className={`p-2.5 rounded-xl shadow-lg border border-white/10 transition-all ${
                isRaceActive
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : stops.length < 2 ? 'bg-[#111113] text-gray-500 border-gray-500/30'
                  : 'bg-[#111113] text-blue-400 hover:bg-[#1f1f22]'
              }`}
              title={stops.length < 2 ? 'Agrega al menos 2 puntos' : (isRaceActive ? 'Detener ruta' : 'Iniciar ruta simulada')}
            ><Flag size={18} /></button>
          )}
          {geoStatus === 'unsupported' && (
            <div className="p-2.5 bg-red-500/20 rounded-xl shadow-lg text-red-400 border border-red-500/30 text-xs px-3">GPS no disponible</div>
          )}
        </div>
      )}

      {isAddingStop && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-blue-500/90 text-white px-4 py-2 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2">
          {previewLoading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Haz clic en el mapa para agregar un punto
        </div>
      )}

      {rutaMsg && stops.length < 2 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#111113] text-yellow-400 border border-yellow-500/30 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium">
          Se necesitan al menos 2 puntos para iniciar la ruta
        </div>
      )}

      {rutaMsg && stops.length >= 2 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#111113] text-green-400 border border-green-500/30 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-pulse">
          RUTA 1 DEL PILOTO INICIADA · {stops.length} puntos
        </div>
      )}

      {isRaceActive && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111113]/90 backdrop-blur-sm border border-green-500/30 px-4 py-2 rounded-xl shadow-2xl text-xs text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Ruta activa · {stops.length} puntos
        </div>
      )}

      {rutaEndMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#111113] text-yellow-400 border border-yellow-500/30 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-pulse">
          RUTA COMPLETADA — Presiona bandera para reiniciar
        </div>
      )}

      {confirmPosition && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmPosition(null)}
        >
          <div className="bg-[#111113] border border-white/20 rounded-2xl p-5 max-w-xs w-full shadow-2xl">
            <h3 className="text-white font-semibold text-sm mb-1">Agregar punto</h3>
            <div className="min-h-[20px] mb-2">
              {confirmPosition.street === null ? (
                <div className="flex items-center gap-2 text-white/60 text-xs">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Obteniendo dirección...
                </div>
              ) : (
                <p className="text-white/80 text-xs">{confirmPosition.street || 'Ubicación sin nombre'}</p>
              )}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mb-4">
              {confirmPosition.lat.toFixed(5)}, {confirmPosition.lng.toFixed(5)}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPosition(null)}
                className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button onClick={() => {
                setStops(p => [...p, { name: confirmPosition.name, lng: confirmPosition.lng, lat: confirmPosition.lat }])
                setConfirmPosition(null)
                setIsAddingStop(false)
              }}
                className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-all"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {fullPreviewLoading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-blue-500/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] text-white flex items-center gap-1.5 shadow-lg">
          <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Calculando ruta...
        </div>
      )}

      {isSharing && (
        <div className="fixed top-20 left-4 z-40 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/80 flex items-center gap-2 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {visibleUsers.length > 0 ? (
            <div className="flex items-center gap-1">
              {visibleUsers.map(([id]) => (
                <span key={id} className="w-2 h-2 rounded-full" style={{ backgroundColor: userColor(id) }} />
              ))}
              <span className="ml-0.5">{visibleUsers.length}</span>
            </div>
          ) : (
            <span>0 usuarios</span>
          )}
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40 bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white/70">
        &copy; OpenStreetMap
      </div>
    </>
  )
}

export default MapView
