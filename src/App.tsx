import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <BrowserRouter basename="/Otimizador_de_rotas">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App 