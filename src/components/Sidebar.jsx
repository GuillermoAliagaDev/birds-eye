import { useState, useEffect } from 'react'
import { X, Menu, MapPin, Settings, Plus, Trash2, Save, Wifi, WifiOff, Route, LogIn } from 'lucide-react'
import { getSupabase, getDeviceId, getDeviceName, setDeviceName } from '../lib/supabase'

const menuItems = [
  { icon: Route, label: 'Rutas' },
  { icon: Settings, label: 'Ajustes' },
]

function Sidebar({
  isOpen, onToggle, stops, setStops, isAddingStop, setIsAddingStop,
  supabaseUrl, setSupabaseUrl, supabaseKey, setSupabaseKey,
  isSharing, setIsSharing, isAdmin, setIsAdmin, supabaseStatus,
  // testSimActive, onToggleTestSim,
  routes, activeRouteId, onSelectRoute, onCreateRoute, onSaveRoute, onDeleteRoute,
  deviceName, onDeviceNameChange,
}) {
  const [activeItem, setActiveItem] = useState(0)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      <aside
        className={`
          fixed inset-y-0 left-0 z-40
          bg-[#111113] text-white
          transition-transform duration-300 ease-out
          flex flex-col
          md:w-72 w-full
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MapPin size={20} className="text-blue-400" />
            Bird's Eye
          </h2>
          <button onClick={onToggle} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex gap-1 px-3 pt-3 pb-1 border-b border-white/5">
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={() => setActiveItem(i)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs
                transition-all duration-200
                ${activeItem === i
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'}
              `}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto">
          {activeItem === 0 && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/80">
                  Rutas <span className="text-blue-400">({routes.length})</span>
                </span>
              </div>

              {isAdmin && (
                <button onClick={onCreateRoute}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                >
                  <Plus size={14} />
                  Nueva ruta
                </button>
              )}

              {routes.length === 0 && (
                <div className="py-8 text-gray-600 text-xs text-center">
                  {isAdmin ? 'Crea una nueva ruta.' : 'Espera a que el admin agregue una.'}
                </div>
              )}

              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {routes.map(route => {
                  const isActive = route.id === activeRouteId
                  return (
                    <div key={route.id} className={`rounded-lg transition-colors ${isActive ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/[0.03] border border-transparent'}`}>
                      <button
                        onClick={() => onSelectRoute(route.id)}
                        className="w-full flex items-center gap-2 p-2.5"
                      >
                        <Route size={14} className={`shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-xs text-white truncate">{route.name}</div>
                          <div className="text-[10px] text-gray-500">{route.stops?.length || 0} paradas</div>
                        </div>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </button>

                      {isActive && (
                        <div className="px-2 pb-2 border-t border-blue-500/10 pt-2">
                          {stops.length > 0 && (
                            <div className="space-y-0.5 max-h-[30vh] overflow-y-auto mb-2">
                              {stops.map((s, i) => (
                                <div key={i} className="flex items-center gap-1.5 py-1 rounded hover:bg-white/[0.03] group">
                                  <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] flex items-center justify-center font-bold shrink-0">
                                    {i + 1}
                                  </span>
                                  {isAdmin ? (
                                    <input value={s.name} onChange={e => {
                                      const copy = [...stops]
                                      copy[i] = { ...copy[i], name: e.target.value }
                                      setStops(copy)
                                    }}
                                      className="flex-1 bg-transparent text-white text-[11px] border-b border-transparent focus:border-blue-500/50 outline-none px-1 py-0.5"
                                      placeholder="Nombre de la parada"
                                    />
                                  ) : (
                                    <span className="text-[11px] text-white/80 truncate">{s.name}</span>
                                  )}
                                  {isAdmin && (
                                    <button onClick={() => setStops(prev => prev.filter((_, j) => j !== i))}
                                      className="p-1 text-red-400/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {stops.length === 0 && (
                            <div className="text-[10px] text-gray-600 text-center py-2">Ruta sin paradas</div>
                          )}

                          {isAdmin && (
                            <div className="flex flex-col gap-1.5 pt-1">
                              <button onClick={() => setIsAddingStop(true)}
                                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all border ${
                                  isAddingStop
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-white/5'
                                }`}
                              >
                                <Plus size={12} />
                                {isAddingStop ? 'Haz clic en el mapa...' : 'Agregar parada'}
                              </button>
                              <div className="flex gap-2">
                                <button onClick={onSaveRoute}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all"
                                >
                                  <Save size={12} />
                                  Guardar
                                </button>
                                <button onClick={() => onDeleteRoute(route.id)}
                                  className="p-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                                  title="Eliminar ruta"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeItem === 1 && (
            <div className="p-3 space-y-4">
              <div className="text-xs font-semibold text-white/80">Conexión Supabase</div>

              <input value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)}
                placeholder="URL del proyecto"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
              />
              <input value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)}
                placeholder="Anon Key (public)"
                type="password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
              />

              <div className="flex items-center gap-2 text-[10px]">
                {supabaseStatus === 'idle' && <span className="text-gray-500">Sin configurar</span>}
                {supabaseStatus === 'checking' && <>
                  <div className="w-2 h-2 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-blue-400">Verificando...</span>
                </>}
                {supabaseStatus === 'connected' && <>
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-400">Conectado</span>
                </>}
                {supabaseStatus === 'error' && <>
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-red-400">Error de conexión</span>
                </>}
              </div>

              {supabaseUrl && supabaseKey && supabaseStatus === 'connected' && (
                <>
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <div className="text-xs font-semibold text-white/80">Compartir ubicación</div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isSharing ? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-gray-500" />}
                        <span className="text-xs text-white/80">{isSharing ? 'Compartiendo' : 'Compartir ubicación'}</span>
                      </div>
                      <button onClick={() => setIsSharing(!isSharing)}
                        className={`relative w-10 h-5 rounded-full transition-all ${isSharing ? 'bg-green-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isSharing ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <input value={deviceName} onChange={e => { const v = e.target.value.slice(0, 16); setDeviceName(v); onDeviceNameChange(v) }}
                      placeholder="Tu nombre" maxLength={16}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LogIn size={14} className={isAdmin ? 'text-yellow-400' : 'text-gray-500'} />
                        <span className="text-xs text-white/80">Admin</span>
                      </div>
                      <button onClick={() => setIsAdmin(!isAdmin)}
                        className={`relative w-10 h-5 rounded-full transition-all ${isAdmin ? 'bg-yellow-500' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isAdmin ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <div className="text-[10px] text-gray-500 font-mono truncate">
                      ID: {getDeviceId().slice(0, 12)}…
                    </div>

                    {/* test-sim button commented out */}
                  </div>
                </>
              )}

              {!supabaseUrl && (
                <div className="text-[10px] text-gray-500 leading-relaxed">
                  Ingresa las credenciales de tu proyecto Supabase para comenzar.
                  Revisa el archivo <code className="text-blue-400">supabase-schema.sql</code> para crear las tablas.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 text-[10px] text-gray-600 text-center">
          {routes.length} rutas · {isAdmin ? 'Admin' : 'Visor'}
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onToggle} />
      )}

      {!isOpen && (
        <button onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-3 bg-[#111113] rounded-xl shadow-lg text-white hover:bg-[#1a1a1d] transition-all"
        >
          <Menu size={22} />
        </button>
      )}
    </>
  )
}

export default Sidebar
