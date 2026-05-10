import { useState, useEffect } from 'react'
import { X, Menu, Layers, MapPin, Settings, Plus, Trash2, RotateCcw, Map } from 'lucide-react'

const menuItems = [
  { icon: Map, label: 'Mapa' },
  { icon: MapPin, label: 'Puntos' },
  { icon: Settings, label: 'Ajustes' },
]

function Sidebar({ isOpen, onToggle, stops, setStops, isAddingStop, setIsAddingStop, defaultStops }) {
  const [activeItem, setActiveItem] = useState(1)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const updateName = (idx, name) => {
    setStops(prev => prev.map((s, i) => i === idx ? { ...s, name } : s))
  }

  const deleteStop = (idx) => {
    setStops(prev => prev.filter((_, i) => i !== idx))
  }

  const clearAll = () => setStops([])
  const restoreDefault = () => setStops(defaultStops)

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
            <div className="p-6 text-gray-500 text-xs text-center">Configuración del mapa</div>
          )}

          {activeItem === 1 && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/80">
                  Puntos de ruta <span className="text-blue-400">({stops.length})</span>
                </span>
              </div>

              <button
                onClick={() => setIsAddingStop(!isAddingStop)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs transition-all ${isAddingStop
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
              >
                <Plus size={14} />
                {isAddingStop ? 'Haz clic en el mapa...' : 'Agregar punto'}
              </button>

              {stops.length === 0 && (
                <div className="py-8 text-gray-600 text-xs text-center">
                  No hay puntos. Agrega uno haciendo clic en el mapa.
                </div>
              )}

              <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                {stops.map((s, i) => (
                  <div key={i} className="group flex items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg p-2 transition-colors">
                    <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 text-[11px] flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <input
                        value={s.name}
                        onChange={(e) => updateName(i, e.target.value)}
                        className="w-full bg-transparent text-white text-xs border-b border-transparent focus:border-blue-500/50 outline-none px-1 py-0.5"
                        placeholder="Nombre del punto"
                      />
                      <div className="text-[9px] text-gray-600 font-mono px-1">
                        {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteStop(i)}
                      className="p-1.5 text-red-400/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {stops.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <button onClick={restoreDefault}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <RotateCcw size={12} />
                    Restaurar demo
                  </button>
                  <button onClick={clearAll}
                    className="flex-1 py-2 rounded-lg text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
            </div>
          )}

          {activeItem === 2 && (
            <div className="p-6 text-gray-500 text-xs text-center">Próximamente</div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 text-[10px] text-gray-600 text-center">
          {stops.length} puntos · Simulación con OSRM
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
