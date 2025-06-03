const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export type Coordinates = [number, number]

export type Team = {
  id: string
  name: string
}

export type ServiceOrder = {
  ROWID: number
  nroos: number
  grupo: number
  descgrupo: string
  servsolicitado: number
  descrservsolicitado: string
  servexec: number | null
  descrservexec: string | null
  matricula: string
  dv: string
  localizacao: string
  codlogr: number
  tipologr: string | null
  logradouro: string
  num: number
  compl: string | null
  bairro: string
  localidade: string
  municipio: string
  datainclusao: string
  datafimexecos: string | null
  dataexecprogemp: string
  databaixa: string | null
  situacao: string
  equipeexec: string
}

export type ServiceOrderFeature = {
  type: 'Feature'
  properties: ServiceOrder & {
    type: 'service_order'
  }
  geometry: {
    type: 'Point'
    coordinates: Coordinates
  }
}

export type GeoJSONResponse = {
  type: 'FeatureCollection'
  features: ServiceOrderFeature[]
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      mode: 'cors',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('API Request Error:', error)
    throw error
  }
}

export const auth = {
  signInWithTeamCode: async (code: string): Promise<Team> => {
    try {
      const response = await fetch(`${API_URL}/validate-team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ team_code: code }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Erro ao autenticar equipe')
      }

      const data = await response.json()
      localStorage.setItem('team', JSON.stringify(data))
      return data
    } catch (error) {
      console.error('Login Error:', error)
      throw error
    }
  },

  signOut: () => {
    localStorage.removeItem('team')
  },

  getTeam: (): Team | null => {
    const team = localStorage.getItem('team')
    return team ? JSON.parse(team) : null
  }
}

export const api = {
  post: <T>(endpoint: string, data: any): Promise<T> => {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getTeams: (): Promise<Team[]> => {
    return request<Team[]>('/api/teams')
  },

  getTeamOrders: (teamId: string): Promise<GeoJSONResponse> => {
    return request<GeoJSONResponse>(`/api/teams/${teamId}/geojson`)
  },
} 