import { X, Menu } from 'lucide-react'

function Sidebar({ isOpen, onToggle }) {
  return (
    <>
      <div
        className={`fixed top-4 left-4 z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="w-72 bg-black backdrop-blur-lg rounded-2xl border border-white/30 shadow-xl p-4 text-white">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Birds Eye</h2>
            <button
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm opacity-80 mb-4">Panel de funciones GIS</p>
          <div className="space-y-2">
            <div className="p-3 bg-white/10 rounded-xl hover:bg-white/20 cursor-pointer transition-colors">
              Función 1
            </div>
            <div className="p-3 bg-white/10 rounded-xl hover:bg-white/20 cursor-pointer transition-colors">
              Función 2
            </div>
            <div className="p-3 bg-white/10 rounded-xl hover:bg-white/20 cursor-pointer transition-colors">
              Función 3
            </div>
          </div>
        </div>
      </div>

      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 shadow-lg text-white hover:bg-white/30 transition-all"
        >
          <Menu size={24} />
        </button>
      )}
    </>
  )
}

export default Sidebar
