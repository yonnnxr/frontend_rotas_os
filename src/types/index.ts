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
  code: string
}

export interface LoginResponse {
  id: string
  name: string
  token: string
}

// Estendendo o tipo Window para incluir nossa propriedade de última atualização de rota
declare global {
  interface Window {
    ultimaAtualizacaoRota?: number;
  }
} 