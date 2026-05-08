import { LocateFixed } from 'lucide-react'

function QuickActionButton({ onClick }) {
  return (
    <button
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 
                 w-14 h-14 md:w-16 md:h-16 rounded-full 
                 bg-gradient-to-br from-blue-500 to-purple-600 
                 hover:from-blue-600 hover:to-purple-700
                 shadow-2xl shadow-purple-500/50
                 flex items-center justify-center
                 transition-all duration-300 
                 hover:scale-110 active:scale-95"
      onClick={onClick}
    >
      <LocateFixed size={24} className="text-white md:w-7 md:h-7" />
    </button>
  )
}

export default QuickActionButton
