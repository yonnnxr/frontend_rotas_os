import { useState } from 'react'

interface LoginProps {
  onLogin: (token: string, teamId: string, teamName: string, teamCode: string) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [teamCode, setTeamCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!teamCode.trim()) {
      setError('Digite o código da equipe')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${apiUrl}/validate-team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team_code: teamCode })
      })
      
      if (!response.ok) {
        throw new Error('Código de equipe inválido')
      }
      
      const data = await response.json()
      onLogin(data.token, data.id, data.name, teamCode)
    } catch (error) {
      console.error('Erro no login:', error)
      setError(error instanceof Error ? error.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Ordens de Serviço</h1>
          <p className="mt-2 text-gray-600">Entre com o código da sua equipe</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="team-code" className="block text-sm font-medium text-gray-700 mb-1">
              Código da Equipe
            </label>
            <input 
              type="text"
              id="team-code"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite o código da equipe"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
} 