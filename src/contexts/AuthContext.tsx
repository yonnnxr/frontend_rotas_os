import { createContext, useContext, useState, ReactNode } from 'react'
import { api } from '@/services/api'

interface Team {
  id: string
  name: string
}

interface AuthContextType {
  team: Team | null
  signIn: (code: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<Team | null>(() => {
    const storedTeam = localStorage.getItem('@OtimizadorRotas:team')
    return storedTeam ? JSON.parse(storedTeam) : null
  })

  const signIn = async (code: string) => {
    try {
      const response = await api.post('/auth/team', { code })
      const team = response.data

      localStorage.setItem('@OtimizadorRotas:team', JSON.stringify(team))
      setTeam(team)
    } catch (error) {
      console.error('Erro ao autenticar:', error)
      throw error
    }
  }

  const signOut = () => {
    localStorage.removeItem('@OtimizadorRotas:team')
    setTeam(null)
  }

  return (
    <AuthContext.Provider value={{ team, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 