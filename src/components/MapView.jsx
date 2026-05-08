import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Flag, LocateOff } from 'lucide-react'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const center = [-12.0464, -77.0428]

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

L.Marker.prototype.options.icon = defaultIcon

const userIcon = L.divIcon({
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `
    <div style="
      width:24px;height:24px;border-radius:50%;
      background:#3b82f6;border:3px solid white;
      box-shadow:0 0 0 4px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3);
    "></div>
  `,
})

function LocationMarker({ userPos }) {
  const map = useMap()

  useEffect(() => {
    if (userPos) {
      map.flyTo(userPos, 15, { duration: 1.5 })
    }
  }, [userPos, map])

  return userPos ? (
    <Marker position={userPos} icon={userIcon}>
      <Popup>Tu ubicación actual</Popup>
    </Marker>
  ) : null
}

function MapView({ isSidebarOpen, recenterTrigger }) {
  const [userPos, setUserPos] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle')
  const [rutaMsg, setRutaMsg] = useState(false)
  const mapRef = useRef(null)

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported')
      return
    }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude])
        setGeoStatus('success')
      },
      () => {
        setGeoStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  const recenter = useCallback(() => {
    if (userPos && mapRef.current) {
      mapRef.current.flyTo(userPos, 15, { duration: 1 })
    }
  }, [userPos])

  useEffect(() => {
    if (recenterTrigger > 0) recenter()
  }, [recenterTrigger, recenter])

  useEffect(() => {
    if (rutaMsg) {
      const t = setTimeout(() => setRutaMsg(false), 3000)
      return () => clearTimeout(t)
    }
  }, [rutaMsg])

  return (
    <>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={13}
        zoomControl={false}
        className="w-full h-full z-0"
        style={{ height: '100dvh', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center}>
          <Popup>Lima, Perú</Popup>
        </Marker>
        <LocationMarker userPos={userPos} />
      </MapContainer>

      {!isSidebarOpen && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {geoStatus === 'denied' && (
            <button
              onClick={requestLocation}
              className="p-2.5 bg-[#111113] rounded-xl shadow-lg text-white hover:bg-[#1f1f22] transition-all border border-white/10"
              title="Activar ubicación"
            >
              <LocateOff size={18} />
            </button>
          )}
          {geoStatus === 'loading' && (
            <div className="p-2.5 bg-[#111113] rounded-xl shadow-lg text-white border border-white/10">
              <div className="w-[18px] h-[18px] border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {geoStatus === 'success' && (
            <button
              onClick={() => setRutaMsg(true)}
              className="p-2.5 bg-[#111113] rounded-xl shadow-lg text-blue-400 hover:bg-[#1f1f22] transition-all border border-white/10"
              title="Iniciar ruta"
            >
              <Flag size={18} />
            </button>
          )}
          {geoStatus === 'unsupported' && (
            <div className="p-2.5 bg-red-500/20 rounded-xl shadow-lg text-red-400 border border-red-500/30 text-xs px-3">
              GPS no disponible
            </div>
          )}
        </div>
      )}

      {rutaMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#111113] text-green-400 border border-green-500/30 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium whitespace-nowrap animate-pulse">
          RUTA 1 DEL PILOTO INICIADA
        </div>
      )}
    </>
  )
}

export default MapView
