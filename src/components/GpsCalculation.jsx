import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { matchGnssTrace } from '../lib/gnssMatcher'

const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'
const samples = [
  { name: 'Beta11', start: [-77.02463681666667, -12.09053405], source: 'gnss', accuracy: 5, stoppedUntil: 60, speed: 0.926 },
  { name: 'Beta10', start: [-76.99460665, -12.10091535], source: 'gnss', accuracy: 5.5, stoppedUntil: 0, speed: 8.8896 },
  { name: 'MUV003', start: [-76.982597, -12.12077], source: 'lbs', accuracy: 550, stoppedUntil: 90, speed: 0 },
]
const colorOf = id => `hsl(${Math.round(id * 137.508) % 360} 78% 52%)`
const meters = (a, b) => Math.hypot((a[0] - b[0]) * 108700, (a[1] - b[1]) * 111100)
const offset = (p, east, north) => [p[0] + east / 108700, p[1] + north / 111100]
const rand = seed => { const x = Math.sin(seed * 127.1 + 78.233) * 43758.5453; return x - Math.floor(x) }
const lineFeature = points => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: {} })
const lineCollection = lines => ({ type: 'FeatureCollection', features: lines.map(lineFeature) })
const line = (id, color, dashed = false) => ({ id, type: 'line', paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.85, ...(dashed ? { 'line-dasharray': [2, 2] } : {}) } })
const makeRoad = points => {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + meters(points[i - 1], points[i]))
  return { points, lengths, total: lengths.at(-1) }
}
const roadPosition = (road, travel) => {
  let i = 1
  while (i < road.lengths.length - 1 && road.lengths[i] < travel) i++
  const a = road.points[i - 1], b = road.points[i]
  const segment = road.lengths[i] - road.lengths[i - 1]
  const fraction = segment ? Math.min(1, Math.max(0, (travel - road.lengths[i - 1]) / segment)) : 0
  return { point: [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction], heading: (Math.atan2((b[0] - a[0]) * 108700, (b[1] - a[1]) * 111100) * 180 / Math.PI + 360) % 360 }
}
const initialDevice = id => {
  const sample = samples[id]
  const anchor = sample?.start || offset(samples[id % 3].start, (Math.floor(id / 3) % 5 - 2) * 380, (Math.floor(id / 15) - 1) * 450)
  const source = sample?.source || (id % 4 === 0 ? 'gnss' : 'lbs')
  const initialReported = source === 'gnss' || id === 2 ? anchor : null
  return {
    id, name: sample?.name || `SIM${String(id + 1).padStart(2, '0')}`, truth: anchor, reported: initialReported,
    source, accuracy: sample?.accuracy || (source === 'lbs' ? 550 : 5.5),
    speedKmh: sample?.speed || 0, stoppedUntil: sample?.stoppedUntil || 0,
    sampleTime: id === 2 ? -19 : (source === 'gnss' ? 0 : null), nextSample: source === 'lbs' ? 0 : 2,
    heading: 0, road: null, travel: 0, routing: false, failures: 0, pending: [],
    truthPath: [anchor], reportedPath: initialReported ? [initialReported] : [],
    gnssFixes: source === 'gnss' ? [{ point: anchor, timestamp: 1789656050, accuracy: sample?.accuracy || 5.5, speedKmh: sample?.speed || 0, isMoving: id !== 0 }] : [],
  }
}
function CarIcon({ id, selected, ghost = false }) {
  return <svg width={selected ? 30 : 24} height={selected ? 46 : 37} viewBox="0 0 30 46" aria-hidden="true" style={{ opacity: ghost ? 0.42 : 1, filter: 'drop-shadow(0 2px 3px #0009)' }}>
    <path d="M8 2 Q15 -1 22 2 L26 10 L27 35 Q26 43 22 44 L8 44 Q4 43 3 35 L4 10 Z" fill={colorOf(id)} stroke="white" strokeWidth="1.5" />
    <path d="M8 12 L10 7 Q15 5 20 7 L22 12 Z M7 30 Q15 32 23 30 L22 37 Q15 39 8 37 Z" fill="#18212b" />
    <path d="M6 15 L4 17 M24 15 L26 17" stroke="#e8edf3" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 3 L11 3 M19 3 L22 3" stroke="#fff7c2" strokeWidth="2" strokeLinecap="round" />
  </svg>
}

export default function GpsCalculation() {
  const [count, setCount] = useState(12)
  const [runId, setRunId] = useState(0)
  const [lbsInterval, setLbsInterval] = useState(30)
  const [latency, setLatency] = useState(8)
  const [accuracy, setAccuracy] = useState(550)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [selected, setSelected] = useState(0)
  const [snapshot, setSnapshot] = useState({ time: 0, devices: Array.from({ length: 12 }, (_, i) => initialDevice(i)), routeErrors: 0 })
  const [matchResult, setMatchResult] = useState({ lines: [], confidence: null, status: 'insufficient' })
  const engine = useRef(null)
  const settings = useRef({ lbsInterval, latency, accuracy, speed, playing })
  settings.current = { lbsInterval, latency, accuracy, speed, playing }

  useEffect(() => {
    const controller = new AbortController()
    const timers = []
    const world = { time: 0, devices: Array.from({ length: count }, (_, i) => initialDevice(i)), routeErrors: 0 }
    engine.current = world
    setSnapshot({ ...world, devices: [...world.devices] })
    const publish = () => setSnapshot({ ...world, devices: world.devices.map(d => ({ ...d })) })
    const requestRoad = async d => {
      if (d.routing || controller.signal.aborted) return
      d.routing = true
      const attempt = d.failures + Math.floor(world.time / 10)
      const angle = rand(d.id * 53 + attempt * 31 + 1) * Math.PI * 2
      const radius = 700 + rand(d.id * 71 + attempt * 43 + 2) * 1800
      const target = offset(d.truth, Math.cos(angle) * radius, Math.sin(angle) * radius)
      const from = `${d.truth[0]},${d.truth[1]}`
      const to = `${target[0]},${target[1]}`
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from};${to}?geometries=geojson&overview=full`, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        const points = data.routes?.[0]?.geometry?.coordinates
        if (data.code !== 'Ok' || !points?.length) throw new Error(data.message || 'No route')
        const road = makeRoad(points)
        if (road.total < 100 || road.total > 12000) throw new Error('Unusable route')
        d.road = road
        d.travel = 0
        d.truth = road.points[0]
        d.failures = 0
      } catch (error) {
        if (error.name !== 'AbortError') { d.failures++; world.routeErrors++ }
      } finally { d.routing = false; if (!controller.signal.aborted) publish() }
    }
    world.devices.forEach((d, i) => timers.push(window.setTimeout(() => requestRoad(d), i * 800)))
    const timer = window.setInterval(() => {
      if (!settings.current.playing) return
      const { lbsInterval, latency, accuracy, speed } = settings.current
      world.time += speed
      const time = world.time
      for (const d of world.devices) {
        if (!d.road && !d.routing && d.failures && Math.floor(time) % 12 === d.id % 12) requestRoad(d)
        if (d.road && time >= d.stoppedUntil) {
          d.speedKmh = d.id === 1 ? 3.5 + 5.4 * (0.5 + 0.5 * Math.sin(time / 22)) : 15 + (d.id % 7) * 2
          d.travel = Math.min(d.road.total, d.travel + d.speedKmh / 3.6 * speed)
          const position = roadPosition(d.road, d.travel)
          d.truth = position.point
          d.heading = position.heading
          d.truthPath.push(d.truth)
          if (d.truthPath.length > 500) d.truthPath.shift()
          if (d.travel >= d.road.total) { d.road = null; d.speedKmh = 0; d.stoppedUntil = time + 8 + rand(d.id * 43 + Math.floor(time)) * 18; requestRoad(d) }
        } else if (time < d.stoppedUntil) d.speedKmh = d.id === 0 ? 0.926 : 0
        if (d.source === 'gnss' && time >= d.nextSample) {
          const noise = d.id === 0 ? 1.5 : 5
          const angle = rand(d.id * 101 + Math.floor(time)) * Math.PI * 2
          d.reported = offset(d.truth, Math.cos(angle) * noise, Math.sin(angle) * noise)
          d.sampleTime = time
          d.nextSample = time + 2
          d.reportedPath.push(d.reported)
          d.gnssFixes.push({ point: d.reported, timestamp: 1789656050 + time, accuracy: d.accuracy,
            speedKmh: d.speedKmh, isMoving: time >= d.stoppedUntil && d.speedKmh > 2 })
          if (d.gnssFixes.length > 100) d.gnssFixes.shift()
        }
        if (d.source === 'lbs' && time >= d.nextSample) {
          const angle = rand(d.id * 103 + Math.floor(time)) * Math.PI * 2
          const radius = Math.sqrt(rand(d.id * 107 + Math.floor(time) + 1)) * accuracy
          const observed = offset(d.truth, Math.cos(angle) * radius, Math.sin(angle) * radius)
          const sampleTime = time
          d.pending.push({ point: observed, sampleTime, arrival: time + latency + rand(d.id * 109 + Math.floor(time)) * latency })
          d.nextSample = time + lbsInterval
          d.accuracy = accuracy
        }
        const ready = d.pending.filter(p => p.arrival <= time).sort((a, b) => a.arrival - b.arrival)
        d.pending = d.pending.filter(p => p.arrival > time)
        for (const p of ready) {
          if (d.sampleTime != null && p.sampleTime < d.sampleTime) continue
          d.reported = p.point
          d.sampleTime = p.sampleTime
          d.reportedPath.push(p.point)
        }
        if (d.reportedPath.length > 100) d.reportedPath = d.reportedPath.slice(-100)
      }
      publish()
    }, 1000)
    return () => { controller.abort(); timers.forEach(window.clearTimeout); window.clearInterval(timer); if (engine.current === world) engine.current = null }
  }, [count, runId])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setMatchResult({ lines: [], confidence: null, status: 'insufficient' })
    const updateMatch = async () => {
      const d = engine.current?.devices[selected]
      if (!d || d.source !== 'gnss') return
      try {
        const result = await matchGnssTrace(d.gnssFixes, { signal: controller.signal })
        if (active) setMatchResult(result)
      } catch (error) {
        if (active && error.name !== 'AbortError') setMatchResult(previous => ({ ...previous, status: 'error' }))
      }
    }
    updateMatch()
    const timer = window.setInterval(updateMatch, 12000)
    return () => { active = false; controller.abort(); window.clearInterval(timer) }
  }, [selected, count, runId])

  const device = snapshot.devices[selected]
  const age = device?.sampleTime == null ? null : Math.round(snapshot.time - device.sampleTime)
  const error = device?.reported ? Math.round(meters(device.truth, device.reported)) : null
  const truthLine = useMemo(() => lineFeature(device?.truthPath || []), [device])
  const reportedLine = useMemo(() => lineFeature(device?.reportedPath || []), [device])
  const matchedLines = useMemo(() => lineCollection(matchResult.lines), [matchResult.lines])

  return <div className="h-dvh w-full bg-[#111113] text-white flex flex-col md:flex-row">
    <aside className="w-full md:w-80 shrink-0 p-4 space-y-4 overflow-y-auto border-b md:border-b-0 md:border-r border-white/10 max-h-[45vh] md:max-h-none">
      <div className="flex items-center justify-between gap-2"><div><h1 className="text-lg font-bold">GPS calculation</h1><p className="text-xs text-gray-400">Simulación local · GNSS vs LBS</p></div><a href="/" className="text-xs text-blue-300 hover:underline">Volver al mapa</a></div>
      <p className="text-xs text-gray-400 leading-relaxed">Cada vehículo elige destinos nuevos de forma independiente y sigue calles calculadas con OSRM. Las posiciones LBS llegan tarde, se repiten y pueden desviarse cientos de metros.</p>
      <label className="block text-xs">Dispositivos: <strong>{count}</strong><input aria-label="Dispositivos" className="w-full accent-blue-400" type="range" min="1" max="30" value={count} onChange={e => { setCount(Number(e.target.value)); setSelected(id => Math.min(id, Number(e.target.value) - 1)) }} /></label>
      <label className="block text-xs">Intervalo LBS: <strong>{lbsInterval}s</strong><input aria-label="Intervalo LBS" className="w-full accent-blue-400" type="range" min="10" max="90" step="5" value={lbsInterval} onChange={e => setLbsInterval(Number(e.target.value))} /></label>
      <label className="block text-xs">Latencia: <strong>{latency}s</strong><input aria-label="Latencia" className="w-full accent-blue-400" type="range" min="0" max="40" step="2" value={latency} onChange={e => setLatency(Number(e.target.value))} /></label>
      <label className="block text-xs">Error LBS: <strong>{accuracy}m</strong><input aria-label="Error LBS" className="w-full accent-blue-400" type="range" min="0" max="1000" step="50" value={accuracy} onChange={e => setAccuracy(Number(e.target.value))} /></label>
      <label className="block text-xs">Velocidad del tiempo: <strong>{speed}×</strong><input aria-label="Velocidad del tiempo" className="w-full accent-blue-400" type="range" min="1" max="10" value={speed} onChange={e => setSpeed(Number(e.target.value))} /></label>
      <div className="flex gap-2"><button className="rounded-lg bg-blue-500 px-3 py-2 text-xs" onClick={() => setPlaying(!playing)}>{playing ? 'Pausar' : 'Continuar'}</button><button className="rounded-lg bg-white/10 px-3 py-2 text-xs" onClick={() => setRunId(n => n + 1)}>Reiniciar</button></div>
      <div className="border-t border-white/10 pt-3 text-xs space-y-1"><div>Tiempo simulado: {Math.round(snapshot.time)}s</div><div>Vehículo: {device?.name || '—'} · {device?.source.toUpperCase() || '—'}</div><div>Estado: {device?.source === 'lbs' ? 'NO_FIX' : device?.id === 0 ? 'FIX_2D' : 'FIX_3D'} · {device?.speedKmh > 1 ? 'en movimiento' : 'detenido'}</div><div>Velocidad: {device?.speedKmh.toFixed(1) || '0.0'} km/h</div><div>Edad de posición: {age == null ? 'esperando' : `${age}s`}</div><div>Precisión declarada: {device?.accuracy || '—'}m</div><div>Desfase frente a posición simulada: {error == null ? 'esperando' : `${error}m`}</div><div>Rutas pendientes: {snapshot.devices.filter(d => !d.road).length}</div>{snapshot.routeErrors > 0 && <div className="text-amber-300">Rutas fallidas: {snapshot.routeErrors} · reintentando</div>}</div>
      <div className="text-xs text-emerald-300">GNSS en calles: {device?.source !== 'gnss' ? 'solo GNSS' : matchResult.status === 'matched' ? `coincidencia ${Math.round(matchResult.confidence * 100)}%` : matchResult.status === 'insufficient' ? 'esperando puntos en movimiento' : matchResult.status === 'uncertain' ? 'ruta incierta; se omite' : 'servicio no disponible'}</div>
      <div className="flex flex-wrap items-center gap-3 text-xs"><span className="text-cyan-300">● Posición simulada</span><span className="text-orange-300">● Reportada</span><span className="text-emerald-300">● GNSS en calles</span></div>
      <div className="grid grid-cols-6 gap-1">{snapshot.devices.map(d => <button key={d.id} onClick={() => setSelected(d.id)} title={d.name} className={`rounded py-1 text-[10px] ${selected === d.id ? 'ring-2 ring-white' : 'hover:ring-1 hover:ring-white/50'}`} style={{ backgroundColor: colorOf(d.id) }}>{d.id + 1}</button>)}</div>
    </aside>
    <main className="flex-1 min-h-0 relative"><Map initialViewState={{ longitude: -77.005, latitude: -12.106, zoom: 12 }} mapStyle={mapStyle} style={{ width: '100%', height: '100%' }}><NavigationControl position="top-right" />
      {device?.truthPath.length > 1 && <Source id="truth-path" type="geojson" data={truthLine}><Layer {...line('truth-line', '#22d3ee', true)} /></Source>}
      {device?.reportedPath.length > 1 && <Source id="reported-path" type="geojson" data={reportedLine}><Layer {...line('reported-line', '#fb923c')} /></Source>}
      {device?.source === 'gnss' && matchResult.lines.length > 0 && <Source id="matched-path" type="geojson" data={matchedLines}><Layer {...line('matched-line', '#10b981')} /></Source>}
      {snapshot.devices.map(d => <div key={d.id}>{d.source === 'lbs' && <Marker longitude={d.truth[0]} latitude={d.truth[1]} anchor="center" rotation={d.heading} rotationAlignment="map"><CarIcon id={d.id} selected={selected === d.id} ghost /></Marker>}{d.reported && <Marker longitude={d.reported[0]} latitude={d.reported[1]} anchor="center" rotation={d.source === 'gnss' ? d.heading : 0} rotationAlignment="map"><button onClick={() => setSelected(d.id)} title={`${d.name} · ${d.source.toUpperCase()}`} aria-label={`${d.name} · ${d.source.toUpperCase()}`}><CarIcon id={d.id} selected={selected === d.id} /></button></Marker>}</div>)}
    </Map></main>
  </div>
}
