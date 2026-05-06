import { Zap } from 'lucide-react'

function QuickActionButton() {
  return (
    <button
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 
                 w-16 h-16 rounded-full 
                 bg-gradient-to-br from-blue-500 to-purple-600 
                 hover:from-blue-600 hover:to-purple-700
                 shadow-2xl shadow-purple-500/50
                 flex items-center justify-center
                 transition-all duration-300 
                 hover:scale-110 active:scale-95"
      onClick={() => alert('Acción Rápida!')}
    >
      <Zap size={28} className="text-white" />
    </button>
  )
}

export default QuickActionButton
