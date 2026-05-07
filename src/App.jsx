import { useState } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import QuickActionButton from './components/QuickActionButton'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="relative w-full h-dvh">
      <MapView />
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <QuickActionButton />
    </div>
  )
}

export default App
