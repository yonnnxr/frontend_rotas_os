import { createContext, useContext, useState, useEffect } from 'react'
import { auth, Team } from '@/services/supabase'

interface AuthContextType {
  team: Team | null
  signIn: (code: string) => Promise<void>
  signOut: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [team, setTeam] = useState<Team | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verifica se já existe uma equipe autenticada
    const team = auth.getTeam()
    setTeam(team)
    setIsLoading(false)
  }, [])

  const signIn = async (code: string) => {
    try {
      const team = await auth.signInWithTeamCode(code)
      setTeam(team)
    } catch (error) {
      throw error
    }
  }

  const signOut = () => {
    auth.signOut()
    setTeam(null)
  }

  return (
    <AuthContext.Provider value={{ team, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
} 