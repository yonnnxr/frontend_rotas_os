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

interface UserLocation {
  lat: number
  lng: number
  accuracy: number
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
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  
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
  
  // Função para obter a localização atual do usuário
  const getCurrentLocation = () => {
    if (!map) return;
    
    setLoading(true);
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Atualiza o estado com a localização do usuário
          setUserLocation({
            lat: latitude,
            lng: longitude,
            accuracy
          });
          
          // Centraliza o mapa na posição do usuário e adiciona um marcador
          map.setView([latitude, longitude], 15);
          
          // Adiciona um marcador para a localização do usuário
          const userIcon = L.divIcon({
            className: 'user-location-icon',
            html: `<div style="background-color:#4285F4;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          
          // Remove marcadores antigos e adiciona o novo
          if (markersLayer) {
            // Remove apenas marcadores de usuário anteriores
            markersLayer.eachLayer(layer => {
              if ((layer as any)._icon?.classList.contains('user-location-icon')) {
                markersLayer.removeLayer(layer);
              }
            });
            
            // Adiciona o novo marcador
            const newMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(markersLayer);
            newMarker.bindPopup('Sua localização atual');
          }
          
          setLoading(false);
        },
        (error) => {
          console.error('Erro ao obter localização:', error.message);
          alert(`Não foi possível obter sua localização: ${error.message}`);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocalização não é suportada pelo seu navegador');
      setLoading(false);
    }
  };

  // Função para abrir navegação no Google Maps para uma ordem de serviço
  const openGoogleMapsNavigation = (lat: number, lng: number) => {
    if (!userLocation) {
      alert('Obtenha sua localização atual primeiro');
      getCurrentLocation();
      return;
    }
    
    // Cria uma URL para o Google Maps com direções da posição atual até a ordem de serviço
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${lat},${lng}&travelmode=driving`;
    
    // Abre em uma nova aba
    window.open(googleMapsUrl, '_blank');
  };

  // Função para abrir navegação para rota otimizada no Google Maps
  const openOptimizedRouteInMaps = async () => {
    try {
      setLoading(true);
      
      // Primeiro, obtém a localização atual se não tiver
      if (!userLocation) {
        await new Promise<void>((resolve, reject) => {
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setUserLocation({
                  lat: latitude,
                  lng: longitude,
                  accuracy
                });
                resolve();
              },
              (error) => {
                alert(`Não foi possível obter sua localização: ${error.message}`);
                setLoading(false);
                reject(new Error('Localização necessária para iniciar navegação'));
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          } else {
            alert('Geolocalização não é suportada pelo seu navegador');
            setLoading(false);
            reject(new Error('Geolocalização não suportada'));
          }
        });
      }
      
      // Obtém rota otimizada do backend
      const token = localStorage.getItem('token');
      const teamId = localStorage.getItem('team_id');
      
      if (!token || !teamId) {
        onLogout();
        return;
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const url = `${apiUrl}/api/teams/${teamId}/optimized-route?consider_traffic=true&profile=car`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao otimizar rota: ${response.status}`);
      }
      
      const data: GeoJSONData = await response.json();
      
      // Filtra apenas os pontos (ordens)
      const orderFeatures = data.features.filter(feature => 
        feature.geometry && feature.geometry.type === 'Point'
      );
      
      if (orderFeatures.length === 0) {
        alert('Não há ordens de serviço para navegar');
        setLoading(false);
        return;
      }
      
      // Extrai coordenadas na ordem correta
      const waypoints = orderFeatures
        .sort((a, b) => {
          const orderA = a.properties?.route_order || 0;
          const orderB = b.properties?.route_order || 0;
          return orderA - orderB;
        })
        .map(feature => {
          const coords = feature.geometry.coordinates as number[];
          // Corrigimos a longitude (mesma correção usada em displayOrders)
          return {
            lat: coords[1],
            lng: coords[0] - 12
          };
        });
      
      // Se temos pontos, abre o Google Maps com waypoints
      if (waypoints.length > 0) {
        let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lng}`;
        
        // O último ponto é o destino
        const destination = waypoints.pop();
        googleMapsUrl += `&destination=${destination?.lat},${destination?.lng}`;
        
        // Adiciona pontos intermediários (máximo de 8 no Google Maps)
        if (waypoints.length > 0) {
          // Google Maps limita a 10 waypoints, então pegamos no máximo 8 (deixando 1 para origin e 1 para destination)
          const limitedWaypoints = waypoints.slice(0, 8);
          const waypointsStr = limitedWaypoints
            .map(wp => `${wp.lat},${wp.lng}`)
            .join('|');
          
          googleMapsUrl += `&waypoints=${waypointsStr}`;
        }
        
        googleMapsUrl += '&travelmode=driving';
        
        // Abre em uma nova aba
        window.open(googleMapsUrl, '_blank');
      }
      
      // Atualiza a visualização no mapa também
      displayOrders(data);
      
    } catch (error) {
      console.error('Erro ao abrir navegação:', error);
      alert(error instanceof Error ? error.message : 'Erro ao abrir navegação');
    } finally {
      setLoading(false);
    }
  };
  
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
    
    // Limpa apenas os marcadores de ordens, preservando o marcador do usuário
    markersLayer.eachLayer(layer => {
      if (!(layer as any)._icon?.classList.contains('user-location-icon')) {
        markersLayer.removeLayer(layer);
      }
    });
    
    // Verifica se temos dados para exibir
    if (!geojsonData?.features?.length) {
      setStats(prev => ({ ...prev, ordersCount: 0 }))
      return
    }
    
    // Filtra apenas as ordens de serviço (pontos)
    const orderFeatures = geojsonData.features.filter((feature: GeoJSONFeature) => 
      feature.geometry && feature.geometry.type === 'Point'
    )
    
    // Atualiza estatísticas
    setStats(prev => ({ ...prev, ordersCount: orderFeatures.length }))
    
    // Cria um grupo de coordenadas para calcular o centro
    const points: [number, number][] = []
    
    // Adiciona os pontos ao mapa
    orderFeatures.forEach((feature: GeoJSONFeature) => {
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
        
        // Configura o popup com botão para navegação
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
          popupContent += `<strong>Localidade:</strong> ${props.localidade || props.municipio}<br>`
        }
        
        // Adiciona botão para navegação via Google Maps
        popupContent += `
          <button 
            onclick="window.dispatchEvent(new CustomEvent('navigate-to-order', {detail: {lat: ${lat}, lng: ${lng}}}));"
            style="background-color:#1a73e8;color:white;border:none;border-radius:4px;padding:5px 10px;margin-top:8px;cursor:pointer;width:100%;"
          >
            Navegar até aqui
          </button>
        </div>`
        
        marker.bindPopup(popupContent)
      } catch (error) {
        console.error('Erro ao adicionar ponto:', error)
      }
    })
    
    // Exibe a rota, se houver (apenas visualmente)
    displayRoute(geojsonData)
    
    // Ajusta o zoom para mostrar todos os pontos
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points))
    }
    
    // Adiciona listener para eventos de navegação
    window.addEventListener('navigate-to-order', ((e: CustomEvent) => {
      const { lat, lng } = e.detail;
      openGoogleMapsNavigation(lat, lng);
    }) as EventListener);
  }
  
  // Função para exibir a rota visualmente (apenas visualização, sem navegação interna)
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
              onClick={getCurrentLocation}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Minha Localização
            </button>
            
            <button
              onClick={openOptimizedRouteInMaps}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Navegar com Google Maps
            </button>
          </div>
          
          {optimizedRoute && stats.routeDistance > 0 && (
            <div className="text-sm text-gray-700 font-medium">
              Rota: {stats.routeDistance.toFixed(1)} km ({stats.routeDuration.toFixed(0)} min)
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-full h-full relative">
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
      </div>
    </div>
  )
} 