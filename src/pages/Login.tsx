import { useState, useEffect } from 'react'
import { LoginResponse } from '../types'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [teamCode, setTeamCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiUrl, setApiUrl] = useState('')

  // Detectar URL da API e status do servidor
  useEffect(() => {
    const apiEndpoint = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    setApiUrl(apiEndpoint)
    
    // Verifica se a API está online
    const checkApiStatus = async () => {
      try {
        // Usa um endpoint que sabemos que existe (não precisamos do /health)
        const response = await fetch(`${apiEndpoint}/api/teams`, { 
          method: 'GET',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          console.warn(`API não está respondendo corretamente: ${response.status}`)
        } else {
          console.log('API está online')
        }
      } catch (err) {
        console.error('Erro ao verificar status da API:', err)
      }
    }
    
    checkApiStatus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!teamCode) {
      setError('Digite o código da equipe')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      console.log(`Tentando login em: ${apiUrl}/api/auth/team`)
      
      const response = await fetch(`${apiUrl}/api/auth/team`, {
        method: 'POST',
        mode: 'cors', // Explicitamente define CORS mode
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: teamCode // Modificado para usar 'code' em vez de 'team_code'
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Sem detalhes do erro')
        console.error(`Erro na resposta: Status ${response.status}, Detalhes: ${errorText}`)
        
        throw new Error(
          response.status === 401
            ? 'Código da equipe inválido'
            : response.status === 404
              ? 'Equipe não encontrada'
              : `Erro ao fazer login (${response.status})`
        )
      }
      
      const data: LoginResponse = await response.json()
      
      // Salva os dados no localStorage
      localStorage.setItem('token', data.token)
      localStorage.setItem('team_id', data.id)
      localStorage.setItem('team_name', data.name)
      localStorage.setItem('team_code', teamCode)
      
      // Notifica o componente pai
      onLogin()
    } catch (err) {
      console.error('Erro completo:', err)
      setError(err instanceof Error 
        ? err.message 
        : 'Erro desconhecido ao conectar ao servidor. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }

  // Alternativa de login offline para desenvolvimento/testes
  const handleDevLogin = () => {
    if (import.meta.env.DEV || window.location.hostname === 'localhost') {
      localStorage.setItem('token', 'dev-token')
      localStorage.setItem('team_id', 'dev-team')
      localStorage.setItem('team_name', 'Equipe de Desenvolvimento')
      localStorage.setItem('team_code', 'DEV123')
      onLogin()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
            Sistema de Ordens de Serviço
          </h2>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    <p className="mt-2 text-xs text-red-700">
                      URL da API: {apiUrl}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label
                htmlFor="team_code"
                className="block text-sm font-medium text-gray-700"
              >
                Código da Equipe
              </label>
              <div className="mt-1">
                <input
                  id="team_code"
                  name="team_code"
                  type="text"
                  required
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Digite o código da equipe"
                />
              </div>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </div>
            
            {(import.meta.env.DEV || window.location.hostname === 'localhost') && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDevLogin}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Modo de Desenvolvimento
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
} 