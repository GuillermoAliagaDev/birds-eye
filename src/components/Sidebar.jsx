import { useState, useEffect } from 'react'
import { X, Menu, Layers, MapPin, Settings } from 'lucide-react'

const menuItems = [
  { icon: Layers, label: 'Capas' },
  { icon: MapPin, label: 'Puntos' },
  { icon: Settings, label: 'Ajustes' },
]

function Sidebar({ isOpen, onToggle }) {
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
            MUV - Bird's Eye
          </h2>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={() => setActiveItem(i)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm
                transition-all duration-200
                ${activeItem === i
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'}
              `}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 text-xs text-gray-500 text-center">
          Panel GIS v1.0
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onToggle}
        />
      )}

      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-3 bg-[#111113] rounded-xl shadow-lg text-white hover:bg-[#1a1a1d] transition-all"
        >
          <Menu size={22} />
        </button>
      )}
    </>
  )
}

export default Sidebar
