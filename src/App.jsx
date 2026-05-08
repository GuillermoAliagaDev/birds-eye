import { useState } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import QuickActionButton from './components/QuickActionButton'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)

  return (
    <div className="relative w-full h-dvh">
      <MapView
        isSidebarOpen={isSidebarOpen}
        recenterTrigger={recenterTrigger}
      />
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <QuickActionButton onClick={() => setRecenterTrigger(t => t + 1)} />
    </div>
  )
}

export default App
