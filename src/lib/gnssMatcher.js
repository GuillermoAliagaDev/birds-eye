// Coordinates are [longitude, latitude]. Keep this independent of the simulator
// so the same trace processing can be used for recorded device messages.
const earthDistance = (a, b) => {
  const toRad = Math.PI / 180
  const dLat = (b[1] - a[1]) * toRad
  const dLon = (b[0] - a[0]) * toRad
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2
  return 12742000 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function prepareGnssTrace(observations) {
  const sorted = observations.filter(o =>
    Array.isArray(o.point) && o.point.length === 2 &&
    Number.isFinite(o.point[0]) && Number.isFinite(o.point[1]) &&
    Math.abs(o.point[0]) <= 180 && Math.abs(o.point[1]) <= 90 &&
    Number.isFinite(o.timestamp) && Number.isFinite(o.accuracy) &&
    o.accuracy > 0 && o.accuracy <= 35
  ).sort((a, b) => a.timestamp - b.timestamp)
  const segments = []
  let current = []
  for (const point of sorted) {
    const previous = current.at(-1)
    if (previous) {
      const elapsed = point.timestamp - previous.timestamp
      if (elapsed <= 0) continue
      const displacement = earthDistance(previous.point, point.point)
      // Small movements are indistinguishable from GNSS noise. While stopped,
      // retain the newest timestamp; while moving, wait for a clear displacement.
      if (displacement <= Math.max(8, previous.accuracy + point.accuracy)) {
        if (point.isMoving === false || point.speedKmh < 2) current[current.length - 1] = point
        continue
      }
      // A long outage or implausible leap must not become a connected road line.
      if (elapsed > 60 || displacement > 40 * elapsed + 3 * (previous.accuracy + point.accuracy)) {
        if (current.length >= 3) segments.push(current)
        current = []
      }
    }
    current.push(point)
  }
  if (current.length >= 3) segments.push(current)
  return segments.map(segment => segment.slice(-50))
}

export async function matchGnssTrace(observations, { fetcher = fetch, signal, endpoint = 'https://router.project-osrm.org' } = {}) {
  const segments = prepareGnssTrace(observations)
  if (!segments.length) return { lines: [], confidence: null, status: 'insufficient' }
  const lines = []
  const confidences = []
  for (const segment of segments.slice(-3)) {
    const coords = segment.map(o => `${o.point[0]},${o.point[1]}`).join(';')
    const params = new URLSearchParams({
      geometries: 'geojson', overview: 'full', tidy: 'true', gaps: 'split',
      timestamps: segment.map(o => Math.floor(o.timestamp)).join(';'),
      radiuses: segment.map(o => Math.max(3, Math.min(35, o.accuracy))).join(';'),
    })
    const response = await fetcher(`${endpoint}/match/v1/driving/${coords}?${params}`, { signal })
    const data = await response.json()
    if (data.code === 'NoMatch') continue
    if (!response.ok) throw new Error(data.message || `OSRM HTTP ${response.status}`)
    if (data.code !== 'Ok') throw new Error(data.message || data.code || 'OSRM match failed')
    for (const matching of data.matchings || []) {
      const points = matching.geometry?.coordinates
      if (matching.confidence >= 0.6 && points?.length >= 2) {
        lines.push(points)
        confidences.push(matching.confidence)
      }
    }
  }
  return {
    lines,
    confidence: confidences.length ? Math.min(...confidences) : null,
    status: lines.length ? 'matched' : 'uncertain',
  }
}
