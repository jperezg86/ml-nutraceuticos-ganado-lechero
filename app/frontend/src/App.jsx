import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Predictor from './components/Predictor'
import Explorer from './components/Explorer'
import Monitor from './components/Monitor'
import Registros from './components/Registros'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':  return <Dashboard />
      case 'predictor':  return <Predictor />
      case 'explorer':   return <Explorer />
      case 'monitor':    return <Monitor />
      case 'registros':  return <Registros />
      default:           return <Dashboard />
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="app-main">
        {renderTab()}
      </main>
    </div>
  )
}
