// Interfaces de tipos compartilhados no sistema

export interface GeoJSONFeature {
  type: string
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, any>
}

export interface GeoJSONData {
  type: string
  features: GeoJSONFeature[]
  metadata?: Record<string, any>
}

export interface UserLocation {
  lat: number
  lng: number
  accuracy: number
}

export interface OSPoint {
  lat: number
  lng: number
  order: number
  id: string
  description: string
  feature: GeoJSONFeature
  distanceFromUser?: number
  status?: string
}

// Interfaces para autenticação
export interface LoginCredentials {
  team_code: string
  password: string
}

export interface LoginResponse {
  token: string
  team_id: string
  team_name: string
  team_code: string
} 