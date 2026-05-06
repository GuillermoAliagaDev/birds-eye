import { useState } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import QuickActionButton from './components/QuickActionButton'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="relative w-full h-screen">
      <MapView />
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <QuickActionButton />
    </div>
  )
}

export default App
