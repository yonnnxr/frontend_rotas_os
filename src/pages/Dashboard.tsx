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
  const [showInstructions, setShowInstructions] = useState(false)
  const [instructions, setInstructions] = useState<RouteInstruction[]>([])
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [userMarker, setUserMarker] = useState<L.Marker | null>(null)
  const [routeStarted, setRouteStarted] = useState(false)
  const [currentOrderIndex, setCurrentOrderIndex] = useState(-1)
  
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
          
          // Adiciona marcador na posição do usuário, ou atualiza se já existir
          updateUserMarker(latitude, longitude);
          
          // Centraliza o mapa na posição do usuário
          map.setView([latitude, longitude], 15);
          
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
  
  // Função para atualizar o marcador do usuário
  const updateUserMarker = (lat: number, lng: number) => {
    if (!map) return;
    
    // Remove o marcador existente se houver
    if (userMarker) {
      userMarker.remove();
    }
    
    // Cria um ícone personalizado para o usuário
    const userIcon = L.divIcon({
      className: 'user-location-icon',
      html: `<div style="background-color:#4285F4;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    // Adiciona um novo marcador
    const newMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
    newMarker.bindPopup('Sua localização atual');
    
    setUserMarker(newMarker);
  };
  
  // Inicia o monitoramento contínuo da localização
  const startLocationTracking = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocalização não é suportada pelo seu navegador');
      return;
    }
    
    // Primeiro obtém a localização inicial
    getCurrentLocation();
    
    // Inicia o monitoramento contínuo
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        setUserLocation({
          lat: latitude,
          lng: longitude,
          accuracy
        });
        
        updateUserMarker(latitude, longitude);
        
        // Se a rota foi iniciada, atualiza a navegação
        if (routeStarted && optimizedRoute) {
          updateNavigationToNextOrder(latitude, longitude);
        }
      },
      (error) => {
        console.error('Erro ao monitorar localização:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
    
    // Guarda o ID do monitoramento para limpeza posterior
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  };
  
  // Função para atualizar a navegação para a próxima ordem
  const updateNavigationToNextOrder = (userLat: number, userLng: number) => {
    if (!optimizedRoute || !optimizedRoute.features || optimizedRoute.features.length === 0) return;
    
    // Filtra apenas os pontos (ordens)
    const orderFeatures = optimizedRoute.features.filter((feature: GeoJSONFeature) => 
      feature.geometry && feature.geometry.type === 'Point'
    );
    
    if (orderFeatures.length === 0) return;
    
    // Se não temos um índice atual ou já chegamos ao final, encontre a ordem mais próxima
    if (currentOrderIndex < 0 || currentOrderIndex >= orderFeatures.length) {
      findNearestOrder(userLat, userLng, orderFeatures);
      return;
    }
    
    // Obtém a ordem atual
    const currentOrder = orderFeatures[currentOrderIndex];
    const coords = currentOrder.geometry.coordinates as number[];
    
    // Corrigimos a longitude (mesma correção usada em displayOrders)
    const orderLng = coords[0] - 12;
    const orderLat = coords[1];
    
    // Calcula a distância até a ordem atual
    const distance = calculateDistance(userLat, userLng, orderLat, orderLng);
    
    // Se estiver a menos de 50 metros da ordem atual, avance para a próxima
    if (distance < 0.05) { // 50 metros
      // Marca a ordem atual como concluída (visual)
      highlightCompletedOrder(currentOrderIndex);
      
      // Avança para a próxima ordem
      if (currentOrderIndex < orderFeatures.length - 1) {
        setCurrentOrderIndex(currentOrderIndex + 1);
        
        // Atualiza as instruções para a próxima ordem
        const nextOrder = orderFeatures[currentOrderIndex + 1];
        navigateToOrder(nextOrder);
      } else {
        // Chegou ao final de todas as ordens
        alert('Parabéns! Você concluiu todas as ordens de serviço.');
        setRouteStarted(false);
      }
    }
  };
  
  // Função para destacar uma ordem como concluída
  const highlightCompletedOrder = (index: number) => {
    if (!markersLayer) return;
    
    // Essa função seria implementada para alterar visualmente o marcador no mapa
    // Por exemplo, mudando a cor para verde ou adicionando um ícone de check
    // Requer acesso aos marcadores individuais, que precisariam ser armazenados
    console.log(`Ordem ${index} concluída`); // Usar o index para evitar erro TS6133
  };
  
  // Função para calcular a distância entre dois pontos (em km)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distância em km
  };
  
  // Função para encontrar a ordem mais próxima
  const findNearestOrder = (userLat: number, userLng: number, orderFeatures: GeoJSONFeature[]) => {
    if (!orderFeatures.length) return;
    
    let nearestIndex = -1;
    let minDistance = Number.MAX_VALUE;
    
    orderFeatures.forEach((feature, index) => {
      const coords = feature.geometry.coordinates as number[];
      
      // Corrigimos a longitude (mesma correção usada em displayOrders)
      const orderLng = coords[0] - 12;
      const orderLat = coords[1];
      
      const distance = calculateDistance(userLat, userLng, orderLat, orderLng);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });
    
    if (nearestIndex >= 0) {
      setCurrentOrderIndex(nearestIndex);
      navigateToOrder(orderFeatures[nearestIndex]);
    }
  };
  
  // Função para navegar até uma ordem específica
  const navigateToOrder = (order: GeoJSONFeature) => {
    if (!map || !userLocation) return;
    
    const coords = order.geometry.coordinates as number[];
    
    // Corrigimos a longitude (mesma correção usada em displayOrders)
    const orderLng = coords[0] - 12;
    const orderLat = coords[1];
    
    // Tipagem segura para userLocation que sabemos não ser null neste ponto
    const location = userLocation as UserLocation; // Sabemos que não é null devido ao check acima
    
    // Solicita uma rota de navegação da posição atual até a ordem
    handleOptimizeRouteToPoint(location.lat, location.lng, orderLat, orderLng);
    
    // Exibe uma mensagem informativa
    const props = order.properties || {};
    const ordemServico = props.ordem_servico || props.nroos || 'N/A';
    const distancia = calculateDistance(location.lat, location.lng, orderLat, orderLng);
    
    // Atualiza o marcador para destacar a ordem atual
    if (markersLayer) {
      // Aqui poderia ser implementada a lógica para destacar visualmente a ordem atual
    }
    
    // Abre o popup da ordem no mapa
    if (map) {
      setTimeout(() => {
        L.popup()
          .setLatLng([orderLat, orderLng])
          .setContent(`
            <div>
              <strong>Próxima OS:</strong> ${ordemServico}<br>
              <strong>Distância:</strong> ${distancia.toFixed(2)} km<br>
              <strong>Tempo estimado:</strong> ${(distancia / 0.5).toFixed(0)} min<br>
              <em>Siga as instruções na tela</em>
            </div>
          `)
          .openOn(map);
      }, 1000);
    }
  };
  
  // Função para iniciar a rota
  const handleStartRoute = async () => {
    try {
      setLoading(true);
      
      // Primeiro, obtém a localização atual
      getCurrentLocation();
      
      // Inicia o monitoramento contínuo da localização
      startLocationTracking();
      
      // Marca que a rota foi iniciada
      setRouteStarted(true);
      
      // Reseta o índice da ordem atual
      setCurrentOrderIndex(-1);
      
      // Usa a API para obter uma rota otimizada a partir da localização atual
      if (userLocation) {
        await handleOptimizeRoute(userLocation.lat, userLocation.lng);
      } else {
        // Se ainda não temos a localização, vamos esperar um pouco e tentar novamente
        setTimeout(async () => {
          if (userLocation) {
            // Garantir a tipagem correta de userLocation
            const location = userLocation as UserLocation;
            await handleOptimizeRoute(location.lat, location.lng);
          } else {
            // Se ainda não temos a localização, usamos a rota sem ponto de partida
            await handleOptimizeRoute();
          }
        }, 2000);
      }
      
    } catch (error) {
      console.error('Erro ao iniciar rota:', error);
      alert(error instanceof Error ? error.message : 'Erro ao iniciar rota');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para solicitar uma rota otimizada para um ponto específico
  const handleOptimizeRouteToPoint = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      if (!token) {
        onLogout()
        return
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const url = `${apiUrl}/api/navigation?start_lat=${startLat}&start_lng=${startLng}&end_lat=${endLat}&end_lng=${endLng}&profile=car`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Erro ao obter rota de navegação: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Limpa a camada de rota atual
      if (routeLayer) {
        routeLayer.clearLayers()
      }
      
      // Adiciona a nova rota ao mapa
      if (data.features && data.features.length > 0 && map && routeLayer) {
        const route = data.features[0]
        
        L.geoJSON(route as any, {
          style: {
            color: route.properties?.color || '#0066CC',
            weight: route.properties?.weight || 5,
            opacity: route.properties?.opacity || 0.8
          }
        }).addTo(routeLayer)
        
        // Atualiza estatísticas
        if (data.metadata) {
          setStats(prev => ({
            ...prev,
            routeDistance: data.metadata.distance || 0,
            routeDuration: data.metadata.duration || 0
          }))
        }
        
        // Atualiza instruções se disponíveis
        if (data.metadata?.instructions) {
          setInstructions(data.metadata.instructions)
          setShowInstructions(true)
        }
      }
      
      // Centraliza o mapa para mostrar toda a rota
      if (map) {
        const bounds = L.latLngBounds([
          [startLat, startLng],
          [endLat, endLng]
        ])
        map.fitBounds(bounds, { padding: [50, 50] })
      }
      
      // Garantir tipagem correta nos lugares onde filtramos features 
      // Adicionar a tipagem explícita para o feature no data.features.filter
      if (routeStarted && userLocation && data.features) {
        const orderFeatures = data.features.filter((feature: GeoJSONFeature) => 
          feature.geometry && feature.geometry.type === 'Point'
        );
        
        if (orderFeatures.length > 0) {
          findNearestOrder(userLocation.lat, userLocation.lng, orderFeatures);
        }
      }
    } catch (error) {
      console.error('Erro ao obter rota de navegação:', error)
      alert(error instanceof Error ? error.message : 'Erro ao obter rota de navegação')
    } finally {
      setLoading(false)
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
    
    markersLayer.clearLayers()
    
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
  const handleOptimizeRoute = async (startLat?: number, startLng?: number) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const teamId = localStorage.getItem('team_id')
      
      if (!token || !teamId) {
        onLogout()
        return
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      let url = `${apiUrl}/api/teams/${teamId}/optimized-route?consider_traffic=true&profile=car`
      
      // Se fornecido um ponto de partida, adiciona à URL
      if (startLat !== undefined && startLng !== undefined) {
        url += `&start_lat=${startLat}&start_lng=${startLng}`
      }
      
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
      
      // Se a rota já foi iniciada, encontra a ordem mais próxima para navegar
      if (routeStarted && userLocation && data.features) {
        const orderFeatures = data.features.filter((feature: GeoJSONFeature) => 
          feature.geometry && feature.geometry.type === 'Point'
        )
        
        if (orderFeatures.length > 0) {
          findNearestOrder(userLocation.lat, userLocation.lng, orderFeatures)
        }
      }
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
    setRouteStarted(false)
    
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
            {!routeStarted ? (
              <button
                onClick={handleStartRoute}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                {loading ? 'Iniciando...' : 'Começar Rota'}
              </button>
            ) : (
              <>
                <button
                  onClick={getCurrentLocation}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Minha Localização
                </button>
                
                <button
                  onClick={handleGetInstructions}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
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
                  Finalizar Rota
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
                {instructions.map((instruction: RouteInstruction) => (
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