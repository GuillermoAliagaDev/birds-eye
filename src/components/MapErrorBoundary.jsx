import { Component } from 'react'

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-dvh bg-[#111113] flex flex-col items-center justify-center text-white p-8 text-center">
          <div className="text-red-400 text-lg font-bold mb-2">Error al cargar el mapa</div>
          <div className="text-white/60 text-sm max-w-md">
            {this.state.error.message}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default MapErrorBoundary
