import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareGnssTrace, matchGnssTrace } from './gnssMatcher.js'

const point = (lng, t, extra = {}) => ({ point: [lng, -12.1], timestamp: t, accuracy: 5, speedKmh: 20, isMoving: true, ...extra })

test('stationary GNSS jitter does not become a trajectory', () => {
  const fixes = [point(-77, 1, { speedKmh: 0, isMoving: false }), point(-77.00001, 3, { speedKmh: 0, isMoving: false }), point(-77.00002, 5, { speedKmh: 0, isMoving: false })]
  assert.deepEqual(prepareGnssTrace(fixes), [])
})

test('moving fixes need clear displacement before adding another road point', () => {
  const fixes = [point(-77, 1), point(-76.99998, 3), point(-76.99996, 5), point(-76.9998, 9), point(-76.9996, 13)]
  const segments = prepareGnssTrace(fixes)
  assert.equal(segments.length, 1)
  assert.deepEqual(segments[0].map(fix => fix.timestamp), [1, 9, 13])
})

test('impossible jumps and long gaps do not connect roads', () => {
  const fixes = [point(-77, 1), point(-76.9998, 3), point(-76.9996, 5), point(-76.98, 7), point(-76.9798, 9), point(-76.9796, 11), point(-76.9794, 80)]
  const segments = prepareGnssTrace(fixes)
  assert.equal(segments.length, 2)
  assert.equal(segments[0].length, 3)
  assert.equal(segments[1].length, 3)
})

test('OSRM match uses observation time and accuracy, hides low-confidence paths', async () => {
  const fixes = [point(-77, 100), point(-76.9998, 102), point(-76.9996, 104)]
  let requested
  const fetcher = async url => {
    requested = new URL(url)
    return { ok: true, json: async () => ({ code: 'Ok', matchings: [{ confidence: 0.8, geometry: { coordinates: [[-77, -12.1], [-76.9996, -12.1]] } }, { confidence: 0.3, geometry: { coordinates: [[-77, -12.1], [-76.99, -12.1]] } }] }) }
  }
  const result = await matchGnssTrace(fixes, { fetcher })
  assert.equal(requested.pathname.startsWith('/match/v1/driving/'), true)
  assert.equal(requested.searchParams.get('timestamps'), '100;102;104')
  assert.equal(requested.searchParams.get('radiuses'), '5;5;5')
  assert.equal(result.lines.length, 1)
  assert.equal(result.confidence, 0.8)
})

test('HTTP 400 NoMatch means uncertain trace, not a service failure', async () => {
  const fixes = [point(-77, 100), point(-76.9998, 102), point(-76.9996, 104)]
  const result = await matchGnssTrace(fixes, { fetcher: async () => ({ ok: false, status: 400, json: async () => ({ code: 'NoMatch' }) }) })
  assert.equal(result.status, 'uncertain')
  assert.deepEqual(result.lines, [])
})
