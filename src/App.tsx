import { useState, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import './index.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  // Verifica se o usuário está logado ao carregar a página
  useEffect(() => {
    const token = localStorage.getItem('token')
    const teamId = localStorage.getItem('team_id')
    
    if (token && teamId) {
      setIsLoggedIn(true)
    }
    
    setLoading(false)
  }, [])

  // Função para lidar com o login bem-sucedido
  const handleLogin = () => {
    setIsLoggedIn(true)
  }

  // Função para lidar com o logout
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('team_id')
    localStorage.removeItem('team_name')
    setIsLoggedIn(false)
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  // Renderiza a página de login ou o dashboard baseado no estado de login
  return (
    <BrowserRouter basename="/">
      {isLoggedIn ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </BrowserRouter>
  )
}

export default App 