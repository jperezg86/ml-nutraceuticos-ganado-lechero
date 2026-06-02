import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Explorer from './components/Explorer'
import Monitor from './components/Monitor'
import Registros from './components/Registros'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  // id_vaca que Explorer debe abrir automáticamente al navegar desde Registros
  const [explorerVaca, setExplorerVaca] = useState(null)

  // Navega al Explorer y pre-selecciona una vaca
  const goToVaca = useCallback((id_vaca) => {
    setExplorerVaca(id_vaca)
    setActiveTab('explorer')
  }, [])

  // Cuando el usuario cambia de tab manualmente, limpiamos el deep-link
  const handleTabChange = useCallback((tab) => {
    if (tab !== 'explorer') setExplorerVaca(null)
    setActiveTab(tab)
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':  return <Dashboard />
      case 'explorer':   return <Explorer initialVacaId={explorerVaca} onVacaOpen={() => setExplorerVaca(null)} />
      case 'monitor':    return <Monitor />
      case 'registros':  return <Registros onGoToVaca={goToVaca} />
      default:           return <Dashboard />
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="app-main">
        {renderTab()}
      </main>
    </div>
  )
}
