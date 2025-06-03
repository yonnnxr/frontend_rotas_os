import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Tipos
interface DashboardProps {
  onLogout: () => void
}

interface GeoJSONFeature {
  type: string
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, any>
}

interface GeoJSONData {
  type: string
  features: GeoJSONFeature[]
  metadata?: Record<string, any>
}

interface RouteInstruction {
  index: number
  description: string
  distance: number
  duration: number
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [markersLayer, setMarkersLayer] = useState<L.LayerGroup | null>(null)
  const [routeLayer, setRouteLayer] = useState<L.LayerGroup | null>(null)
  const [optimizedRoute, setOptimizedRoute] = useState<GeoJSONData | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    ordersCount: 0,
    routeDistance: 0,
    routeDuration: 0,
  })
  const [showInstructions, setShowInstructions] = useState(false)
  const [instructions, setInstructions] = useState<RouteInstruction[]>([])
  
  // Inicializa o mapa
  useEffect(() => {
    if (!mapRef.current || map) return

    // Região de Anastácio, MS
    const newMap = L.map(mapRef.current).setView([-20.48, -55.80], 12)
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(newMap)
    
    const newMarkersLayer = L.layerGroup().addTo(newMap)
    const newRouteLayer = L.layerGroup().addTo(newMap)
    
    setMap(newMap)
    setMarkersLayer(newMarkersLayer)
    setRouteLayer(newRouteLayer)
    
    // Cleanup na desmontagem
    return () => {
      newMap.remove()
    }
  }, [])
  
  // Carrega as ordens de serviço quando o componente é montado
  useEffect(() => {
    if (!map || !markersLayer) return
    loadOrders()
  }, [map, markersLayer])
  
  // Função para carregar as ordens de serviço
  const loadOrders = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const teamId = localStorage.getItem('team_id')
      
      if (!token || !teamId) {
        onLogout()
        return
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const url = `${apiUrl}/api/teams/${teamId}/geojson`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.error('Erro de autenticação, fazendo logout')
          onLogout()
          return
        }
        
        // Tenta rota alternativa
        const fallbackResponse = await fetch(`${apiUrl}/orders`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
        
        if (fallbackResponse.ok) {
          const geojsonData = await fallbackResponse.json()
          displayOrders(geojsonData)
          return
        }
        
        throw new Error('Erro ao carregar ordens de serviço')
      }
      
      const geojsonData = await response.json()
      displayOrders(geojsonData)
    } catch (error) {
      console.error('Erro ao carregar ordens:', error)
      alert(error instanceof Error ? error.message : 'Erro ao carregar ordens')
    } finally {
      setLoading(false)
    }
  }
  
  // Função para exibir as ordens no mapa
  const displayOrders = (geojsonData: GeoJSONData) => {
    if (!map || !markersLayer) return
    
    markersLayer.clearLayers()
    
    // Verifica se temos dados para exibir
    if (!geojsonData?.features?.length) {
      setStats(prev => ({ ...prev, ordersCount: 0 }))
      return
    }
    
    // Filtra apenas as ordens de serviço (pontos)
    const orderFeatures = geojsonData.features.filter(feature => 
      feature.geometry && feature.geometry.type === 'Point'
    )
    
    // Atualiza estatísticas
    setStats(prev => ({ ...prev, ordersCount: orderFeatures.length }))
    
    // Cria um grupo de coordenadas para calcular o centro
    const points: [number, number][] = []
    
    // Adiciona os pontos ao mapa
    orderFeatures.forEach((feature) => {
      try {
        if (!feature.geometry?.coordinates || feature.geometry.coordinates.length < 2) return
        
        // No GeoJSON, o formato é [longitude, latitude]
        const coords = feature.geometry.coordinates as [number, number]
        
        // Correção para Anastácio (deslocamento de 12 graus para oeste)
        const origLng = coords[0]
        const origLat = coords[1]
        const lng = origLng - 12
        const lat = origLat
        
        // Adiciona à lista de pontos
        points.push([lat, lng])
        
        // Propriedades do ponto
        const props = feature.properties || {}
        const orderNumber = props.route_order || ''
        
        // Determina a cor com base na situação
        let color = '#DC2626' // Vermelho (pendente)
        const situacao = (props.situacao || props.status || '').toLowerCase()
        
        if (situacao.includes('exec')) {
          color = '#10B981' // Verde
        } else if (situacao.includes('prog')) {
          color = '#F59E0B' // Laranja
        }
        
        // Cria o marcador circular
        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: color,
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(markersLayer)
        
        // Adiciona o número da ordem, se disponível
        if (orderNumber) {
          L.marker([lat, lng], {
            icon: L.divIcon({
              className: 'order-number-icon',
              html: `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;background-color:white;border:2px solid #1a73e8;border-radius:50%;color:#1a73e8;font-weight:bold;font-size:12px;">${orderNumber}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
          }).addTo(markersLayer)
        }
        
        // Configura o popup
        const ordemServico = props.ordem_servico || props.nroos || 'N/A'
        const status = props.status || props.situacao || 'Pendente'
        const equipe = props.equipe || props.equipeexec || localStorage.getItem('team_name')
        
        let popupContent = `
          <div>
            <strong>OS:</strong> ${ordemServico}<br>
            <strong>Status:</strong> ${status}<br>
            <strong>Equipe:</strong> ${equipe}<br>
        `
        
        if (props.route_order) {
          popupContent += `<strong>Ordem na Rota:</strong> ${props.route_order}<br>`
        }
        
        if (props.descgrupo) {
          popupContent += `<strong>Grupo:</strong> ${props.descgrupo}<br>`
        }
        
        if (props.logradouro) {
          popupContent += `<strong>Endereço:</strong> ${props.logradouro}, ${props.num || 'S/N'}`
          if (props.bairro) popupContent += `, ${props.bairro}`
          popupContent += `<br>`
        }
        
        if (props.localidade || props.municipio) {
          popupContent += `<strong>Localidade:</strong> ${props.localidade || props.municipio}`
        }
        
        popupContent += '</div>'
        marker.bindPopup(popupContent)
      } catch (error) {
        console.error('Erro ao adicionar ponto:', error)
      }
    })
    
    // Exibe a rota, se houver
    displayRoute(geojsonData)
    
    // Ajusta o zoom para mostrar todos os pontos
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points))
    }
  }
  
  // Função para exibir a rota
  const displayRoute = (geojsonData: GeoJSONData) => {
    if (!map || !routeLayer) return
    
    routeLayer.clearLayers()
    
    // Verifica se há uma rota para exibir
    const routeFeatures = geojsonData.features.filter(feature => 
      feature.geometry.type === 'LineString' || 
      feature.properties?.type === 'route' || 
      feature.properties?.type === 'traffic_route'
    )
    
    if (routeFeatures.length === 0) {
      setStats(prev => ({ ...prev, routeDistance: 0, routeDuration: 0 }))
      return
    }
    
    // Adiciona cada rota ao mapa
    routeFeatures.forEach(feature => {
      try {
        const props = feature.properties || {}
        const color = props.color || '#0066CC'
        const weight = props.weight || 4
        const opacity = props.opacity || 0.7
        
        // Cria a linha da rota
        L.geoJSON(feature as any, {
          style: {
            color,
            weight,
            opacity
          }
        }).addTo(routeLayer)
        
        // Atualiza as estatísticas
        if (props.distance || props.duration) {
          setStats(prev => ({
            ...prev,
            routeDistance: props.distance || 0,
            routeDuration: props.duration || 0
          }))
        }
      } catch (error) {
        console.error('Erro ao exibir rota:', error)
      }
    })
    
    // Armazena a rota otimizada
    setOptimizedRoute(geojsonData)
  }
  
  // Função para otimizar a rota
  const handleOptimizeRoute = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const teamId = localStorage.getItem('team_id')
      
      if (!token || !teamId) {
        onLogout()
        return
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const url = `${apiUrl}/api/teams/${teamId}/optimized-route?consider_traffic=true&profile=car`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Erro ao otimizar rota: ${response.status}`)
      }
      
      const data = await response.json()
      displayOrders(data)
      setOptimizedRoute(data)
    } catch (error) {
      console.error('Erro ao otimizar rota:', error)
      alert(error instanceof Error ? error.message : 'Erro ao otimizar rota')
    } finally {
      setLoading(false)
    }
  }
  
  // Função para obter instruções de rota
  const handleGetInstructions = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const teamId = localStorage.getItem('team_id')
      
      if (!token || !teamId) {
        onLogout()
        return
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const url = `${apiUrl}/api/teams/${teamId}/route-instructions?profile=car`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Erro ao obter instruções: ${response.status}`)
      }
      
      const data = await response.json()
      setInstructions(data.instructions || [])
      setShowInstructions(true)
    } catch (error) {
      console.error('Erro ao obter instruções:', error)
      alert(error instanceof Error ? error.message : 'Erro ao obter instruções')
    } finally {
      setLoading(false)
    }
  }
  
  // Função para limpar a rota
  const handleClearRoute = () => {
    if (!routeLayer) return
    
    routeLayer.clearLayers()
    setOptimizedRoute(null)
    setInstructions([])
    setShowInstructions(false)
    setStats(prev => ({ ...prev, routeDistance: 0, routeDuration: 0 }))
    
    // Recarrega as ordens de serviço para remover os números de ordem
    loadOrders()
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold text-gray-900">Sistema de Ordens de Serviço</h1>
            <div className="flex items-center">
              <span className="mr-4 text-sm text-gray-600">
                {stats.ordersCount} ordens de serviço
              </span>
              <button
                onClick={onLogout}
                className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-100 border-b">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={handleOptimizeRoute}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              {loading ? 'Otimizando...' : 'Otimizar Rota'}
            </button>
            
            {optimizedRoute && (
              <>
                <button
                  onClick={handleGetInstructions}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Instruções
                </button>
                
                <button
                  onClick={handleClearRoute}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Limpar Rota
                </button>
              </>
            )}
          </div>
          
          {optimizedRoute && stats.routeDistance > 0 && (
            <div className="text-sm text-gray-700 font-medium">
              Rota: {stats.routeDistance.toFixed(1)} km ({stats.routeDuration.toFixed(0)} min)
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className={`${showInstructions ? 'w-3/4' : 'w-full'} h-full relative`}>
          <div ref={mapRef} className="h-full w-full"></div>
          
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
              <div className="p-4 rounded-md bg-white shadow-md text-center">
                <svg className="animate-spin h-8 w-8 mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-2 text-gray-700">Carregando...</p>
              </div>
            </div>
          )}
        </div>
        
        {showInstructions && (
          <div className="w-1/4 bg-white shadow-inner p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Instruções de Rota</h3>
              <button 
                onClick={() => setShowInstructions(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-100 rounded">
              <p><strong>Distância total:</strong> {stats.routeDistance.toFixed(1)} km</p>
              <p><strong>Duração estimada:</strong> {stats.routeDuration.toFixed(0)} min</p>
              <p><strong>Ordens de serviço:</strong> {stats.ordersCount}</p>
            </div>
            
            <h4 className="font-medium mb-2">Passo a passo:</h4>
            {instructions.length > 0 ? (
              <ul className="space-y-3">
                {instructions.map((instruction) => (
                  <li key={instruction.index} className="border-b pb-2 last:border-b-0">
                    <div className="flex items-start">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">
                        {instruction.index}
                      </span>
                      <div>
                        <p className="text-sm">{instruction.description}</p>
                        <p className="text-xs text-gray-500">
                          {instruction.distance.toFixed(1)} km | {instruction.duration.toFixed(0)} min
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Carregando instruções...</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 